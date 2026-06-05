import { track, useEditor, createShapeId, createBindingId } from 'tldraw';
import type { TLShapeId } from 'tldraw';
import { useEffect, useState, useRef } from 'react';

interface ConnectionOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  arrowColor: string;
  arrowDash: 'draw' | 'solid' | 'dashed' | 'dotted';
}

interface DragState {
  startShapeId: TLShapeId;
  startAnchor: { x: number; y: number };
  arrowId: TLShapeId;
  targetShapeId: TLShapeId | null;
  targetAnchor: { x: number; y: number } | null;
}

function getClosestPointOnRectangleEdge(nx: number, ny: number) {
  const x = Math.max(0, Math.min(1, nx));
  const y = Math.max(0, Math.min(1, ny));

  const dLeft = x;
  const dRight = 1 - x;
  const dTop = y;
  const dBottom = 1 - y;

  const minDist = Math.min(dLeft, dRight, dTop, dBottom);

  if (minDist === dTop) {
    return { x, y: 0 };
  } else if (minDist === dBottom) {
    return { x, y: 1 };
  } else if (minDist === dLeft) {
    return { x: 0, y };
  } else {
    return { x: 1, y };
  }
}

export const ConnectionOverlay = track(({ containerRef, arrowColor, arrowDash }: ConnectionOverlayProps) => {
  const editor = useEditor();
  const hoveredShapeId = editor.getHoveredShapeId();
  const selectedShapeIds = editor.getSelectedShapeIds();

  // Read camera to subscribe component to camera zoom/pan changes
  editor.getCamera();

  // Manage our active drag state
  const [activeDrag, setActiveDrag] = useState<DragState | null>(null);
  const activeDragRef = useRef<DragState | null>(null);
  activeDragRef.current = activeDrag;

  // Decide which shape should show its connection pins (when not dragging)
  let targetShapeId: TLShapeId | null = null;

  const editingShapeId = editor.getEditingShapeId();

  if (!activeDrag && !editingShapeId) {
    if (hoveredShapeId) {
      const shape = editor.getShape(hoveredShapeId);
      if (shape && (shape.type === 'geo' || shape.type === 'markdown')) {
        targetShapeId = hoveredShapeId;
      }
    } else if (selectedShapeIds.length === 1) {
      const shape = editor.getShape(selectedShapeIds[0]);
      if (shape && (shape.type === 'geo' || shape.type === 'markdown')) {
        targetShapeId = selectedShapeIds[0];
      }
    }
  }

  const renderPin = (
    shapeId: TLShapeId,
    anchor: { x: number; y: number },
    isTarget: boolean = false,
    onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void
  ) => {
    const shape = editor.getShape(shapeId);
    if (!shape) return null;

    const bounds = editor.getShapePageBounds(shapeId);
    if (!bounds) return null;

    const container = containerRef.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();

    // Map relative anchor coordinates to page point
    const pagePoint = {
      x: bounds.minX + anchor.x * bounds.width,
      y: bounds.minY + anchor.y * bounds.height,
    };

    // Convert page coordinates to screen coordinates
    const screenPoint = editor.pageToScreen(pagePoint);

    const left = screenPoint.x - containerRect.left;
    const top = screenPoint.y - containerRect.top;

    const isGlowing = isTarget;

    return (
      <button
        key={`${shapeId}-${anchor.x.toFixed(3)}-${anchor.y.toFixed(3)}`}
        className={`connector-pin ${isGlowing ? 'glow' : ''}`}
        style={{
          position: 'absolute',
          left: `${left}px`,
          top: `${top}px`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'auto',
        }}
        onPointerDown={onPointerDown}
      >
        <span className="pin-dot"></span>
      </button>
    );
  };

  const handlePinPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    shapeId: TLShapeId,
    anchor: { x: number; y: number }
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const bounds = editor.getShapePageBounds(shapeId);
    if (!bounds) return;

    const startPointPage = {
      x: bounds.minX + anchor.x * bounds.width,
      y: bounds.minY + anchor.y * bounds.height,
    };

    // Create the arrow shape programmatically
    const arrowId = createShapeId();
    editor.createShape({
      id: arrowId,
      type: 'arrow',
      x: startPointPage.x,
      y: startPointPage.y,
      props: {
        start: { x: 0, y: 0 },
        end: { x: 0.1, y: 0.1 },
        color: arrowColor as any,
        dash: arrowDash as any,
        size: 'm',
      } as any,
    });

    // Bind the start terminal of the arrow to the source shape
    editor.createBinding({
      id: createBindingId(),
      type: 'arrow',
      fromId: arrowId,
      toId: shapeId,
      props: {
        terminal: 'start',
        normalizedAnchor: anchor,
        isPrecise: true,
        isExact: false,
      },
    });

    const initialDragState: DragState = {
      startShapeId: shapeId,
      startAnchor: anchor,
      arrowId,
      targetShapeId: null,
      targetAnchor: null,
    };

    setActiveDrag(initialDragState);
  };

  useEffect(() => {
    if (!activeDrag) return;

    const handlePointerMove = (e: PointerEvent) => {
      const currentDrag = activeDragRef.current;
      if (!currentDrag) return;

      const container = containerRef.current;
      if (!container) return;

      const pagePoint = editor.screenToPage({ x: e.clientX, y: e.clientY });

      // Update arrow's end offset
      const arrow = editor.getShape(currentDrag.arrowId);
      if (arrow) {
        const dx = pagePoint.x - arrow.x;
        const dy = pagePoint.y - arrow.y;
        editor.updateShape({
          id: currentDrag.arrowId,
          type: 'arrow',
          props: {
            end: { x: dx, y: dy },
          },
        });
      }

      // Check if hovering over another geo or markdown shape
      const target = editor.getShapeAtPoint(pagePoint, {
        hitInside: true,
        filter: (shape) => shape.id !== currentDrag.startShapeId && (shape.type === 'geo' || shape.type === 'markdown'),
      });

      if (target) {
        const targetBounds = editor.getShapePageBounds(target.id);
        if (targetBounds) {
          // Find closest anchor on target shape's boundary
          const tnx = (pagePoint.x - targetBounds.minX) / targetBounds.width;
          const tny = (pagePoint.y - targetBounds.minY) / targetBounds.height;
          const targetAnchor = getClosestPointOnRectangleEdge(tnx, tny);

          setActiveDrag((prev) =>
            prev
              ? {
                  ...prev,
                  targetShapeId: target.id,
                  targetAnchor,
                }
              : null
          );
        }
      } else {
        setActiveDrag((prev) =>
          prev
            ? {
                ...prev,
                targetShapeId: null,
                targetAnchor: null,
              }
            : null
        );
      }
    };

    const handlePointerUp = () => {
      const currentDrag = activeDragRef.current;
      if (!currentDrag) return;

      // Handle connection binding on mouse release
      if (currentDrag.targetShapeId && currentDrag.targetAnchor) {
        editor.createBinding({
          id: createBindingId(),
          type: 'arrow',
          fromId: currentDrag.arrowId,
          toId: currentDrag.targetShapeId,
          props: {
            terminal: 'end',
            normalizedAnchor: currentDrag.targetAnchor,
            isPrecise: true,
            isExact: false,
          },
        });

        // Clear target shape selection and select the arrow
        editor.select(currentDrag.arrowId);
      } else {
        // If released in empty space, check if the arrow length is too short
        const arrow = editor.getShape(currentDrag.arrowId);
        if (arrow && arrow.type === 'arrow') {
          const dx = arrow.props.end.x;
          const dy = arrow.props.end.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          if (length < 15) {
            // Cancel/delete the arrow if it's too short
            editor.deleteShape(currentDrag.arrowId);
          }
        }
      }

      setActiveDrag(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const currentDrag = activeDragRef.current;
        if (currentDrag) {
          editor.deleteShape(currentDrag.arrowId);
          setActiveDrag(null);
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeDrag, editor, containerRef]);

  // Render pins for either the hovered/selected shape OR the drag-source & drag-target shapes
  return (
    <div
      className="connection-overlay-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {activeDrag ? (
        <>
          {renderPin(activeDrag.startShapeId, activeDrag.startAnchor, false)}
          {activeDrag.targetShapeId &&
            activeDrag.targetAnchor &&
            renderPin(activeDrag.targetShapeId, activeDrag.targetAnchor, true)}
        </>
      ) : (
        targetShapeId &&
        (() => {
          const bounds = editor.getShapePageBounds(targetShapeId);
          if (!bounds) return null;

          const pagePoint = editor.inputs.currentPagePoint;

          // Check if cursor is near any of the shape's four corners
          const zoom = editor.getZoomLevel();
          const threshold = 20 / zoom; // 20 screen pixels threshold

          const corners = [
            { x: bounds.minX, y: bounds.minY },
            { x: bounds.maxX, y: bounds.minY },
            { x: bounds.minX, y: bounds.maxY },
            { x: bounds.maxX, y: bounds.maxY },
          ];

          const isNearCorner = corners.some((c) => {
            const dx = pagePoint.x - c.x;
            const dy = pagePoint.y - c.y;
            return dx * dx + dy * dy < threshold * threshold;
          });

          // Do not render the linkage pin if the cursor is near a corner (reveals scaling handles)
          if (isNearCorner) return null;

          const nx = (pagePoint.x - bounds.minX) / bounds.width;
          const ny = (pagePoint.y - bounds.minY) / bounds.height;
          const anchor = getClosestPointOnRectangleEdge(nx, ny);
          return renderPin(targetShapeId, anchor, false, (e) =>
            handlePinPointerDown(e, targetShapeId!, anchor)
          );
        })()
      )}
    </div>
  );
});

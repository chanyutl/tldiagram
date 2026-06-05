import { useState, useEffect, useRef } from 'react';
import { Tldraw, Editor, createShapeId, createBindingId, toRichText } from 'tldraw';
import 'tldraw/tldraw.css';
import './App.css';
import { ConnectionOverlay } from './components/ConnectionOverlay';
import { MarkdownShapeUtil } from './components/MarkdownShapeUtil';

const customShapeUtils = [MarkdownShapeUtil];


interface Ripple {
  x: number;
  y: number;
  id: number;
}

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const arrowColor = 'violet';
  const arrowDash = 'solid';
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    pageX: number;
    pageY: number;
  } | null>(null);

  // References for shortcut click handling
  const shortcutClickStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isShortcutClickOnEmptyRef = useRef<boolean>(false);

  // Hook up shortcuts and mouse listeners when editor is ready
  useEffect(() => {
    if (!editor || !containerRef.current) return;

    const canvasContainer = containerRef.current.querySelector('.tl-canvas');
    if (!canvasContainer) return;

    // 1. Ctrl + Shift + Left-click context menu creation
    const handlePointerDown = (e: PointerEvent) => {
      // Check for left click (button 0) with Ctrl + Shift pressed
      if (e.button !== 0 || !e.ctrlKey || !e.shiftKey) return;

      // Verify that we are clicking on the canvas, not a sidebar/UI
      const target = e.target as HTMLElement;
      if (!canvasContainer.contains(target)) return;

      // Check if we are clicking on empty canvas space (no hovered shape)
      const hoveredShapeId = editor.getHoveredShapeId();
      if (!hoveredShapeId) {
        // Intercept to prevent default selection drawing
        e.preventDefault();
        e.stopPropagation();

        shortcutClickStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
        isShortcutClickOnEmptyRef.current = true;
      } else {
        isShortcutClickOnEmptyRef.current = false;
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.button !== 0 || !isShortcutClickOnEmptyRef.current || !shortcutClickStartRef.current) return;

      const dx = e.clientX - shortcutClickStartRef.current.x;
      const dy = e.clientY - shortcutClickStartRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const duration = Date.now() - shortcutClickStartRef.current.time;

      // If they didn't drag to pan (dist < 5px) and it was a relatively quick click
      if (dist < 5 && duration < 300) {
        e.preventDefault();
        e.stopPropagation();

        // Visual ripple at click location
        const containerRect = containerRef.current!.getBoundingClientRect();
        const rx = e.clientX - containerRect.left;
        const ry = e.clientY - containerRect.top;
        const newRipple = { x: rx, y: ry, id: Date.now() };
        setRipples((prev) => [...prev, newRipple]);

        // Clean up ripple after animation
        setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
        }, 600);

        // Convert mouse viewport point to canvas page coordinates
        const pagePoint = editor.screenToPage({ x: e.clientX, y: e.clientY });

        setContextMenu({
          isOpen: true,
          x: e.clientX,
          y: e.clientY,
          pageX: pagePoint.x,
          pageY: pagePoint.y,
        });
      }

      isShortcutClickOnEmptyRef.current = false;
      shortcutClickStartRef.current = null;
    };

    // 2. Ctrl-D / Cmd-D Duplication Shortcut
    const handleKeyDown = (e: KeyboardEvent) => {
      const isD = e.key.toLowerCase() === 'd';
      const isMetaOrCtrl = e.ctrlKey || e.metaKey;
      
      if (isMetaOrCtrl && isD) {
        const selectedIds = editor.getSelectedShapeIds();
        if (selectedIds.length > 0) {
          e.preventDefault();
          // Duplicate shapes with offset of +30px
          editor.duplicateShapes(selectedIds, { x: 30, y: 30 });
        }
      }
    };

    // Attach listeners in capture phase to intercept tldraw canvas logic
    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('pointerup', handlePointerUp, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('pointerup', handlePointerUp, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor, arrowColor]);

  const handleMount = (editorInstance: Editor) => {
    setEditor(editorInstance);
    // Focus canvas initially
    editorInstance.focus();
  };

  // Template Loader: Flowchart
  const loadFlowchart = () => {
    if (!editor) return;
    editor.selectAll();
    editor.deleteShapes(editor.getSelectedShapeIds());

    const startId = createShapeId();
    const processId = createShapeId();
    const endId = createShapeId();

    editor.createShapes([
      {
        id: startId,
        type: 'geo',
        x: 100,
        y: 200,
        props: { geo: 'rectangle', w: 120, h: 60, richText: toRichText('Start Process'), color: 'green' } as any,
      },
      {
        id: processId,
        type: 'geo',
        x: 320,
        y: 190,
        props: { geo: 'rectangle', w: 160, h: 80, richText: toRichText('Analyze Request'), color: 'blue' } as any,
      },
      {
        id: endId,
        type: 'geo',
        x: 580,
        y: 200,
        props: { geo: 'rectangle', w: 120, h: 60, richText: toRichText('Success End'), color: 'red' } as any,
      },
    ]);

    // Connect Start to Process
    const arrow1Id = createShapeId();
    editor.createShape({
      id: arrow1Id,
      type: 'arrow',
      x: 220,
      y: 230,
      props: {
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        color: arrowColor,
        dash: arrowDash,
      } as any,
    });

    editor.createBinding({
      id: createBindingId(),
      type: 'arrow',
      fromId: arrow1Id,
      toId: startId,
      props: { terminal: 'start', normalizedAnchor: { x: 1, y: 0.5 }, isPrecise: true, isExact: false },
    });

    editor.createBinding({
      id: createBindingId(),
      type: 'arrow',
      fromId: arrow1Id,
      toId: processId,
      props: { terminal: 'end', normalizedAnchor: { x: 0, y: 0.5 }, isPrecise: true, isExact: false },
    });

    // Connect Process to End
    const arrow2Id = createShapeId();
    editor.createShape({
      id: arrow2Id,
      type: 'arrow',
      x: 480,
      y: 230,
      props: {
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        color: arrowColor,
        dash: arrowDash,
      } as any,
    });

    editor.createBinding({
      id: createBindingId(),
      type: 'arrow',
      fromId: arrow2Id,
      toId: processId,
      props: { terminal: 'start', normalizedAnchor: { x: 1, y: 0.5 }, isPrecise: true, isExact: false },
    });

    editor.createBinding({
      id: createBindingId(),
      type: 'arrow',
      fromId: arrow2Id,
      toId: endId,
      props: { terminal: 'end', normalizedAnchor: { x: 0, y: 0.5 }, isPrecise: true, isExact: false },
    });

    setTimeout(() => {
      editor.zoomToFit();
    }, 100);
  };

  // Template Loader: Mindmap
  const loadMindmap = () => {
    if (!editor) return;
    editor.selectAll();
    editor.deleteShapes(editor.getSelectedShapeIds());

    const centerId = createShapeId();
    const ideaAId = createShapeId();
    const ideaBId = createShapeId();
    const ideaCId = createShapeId();
    const ideaDId = createShapeId();

    editor.createShapes([
      {
        id: centerId,
        type: 'geo',
        x: 300,
        y: 280,
        props: { geo: 'rectangle', w: 160, h: 80, richText: toRichText('Product Strategy'), color: 'violet' } as any,
      },
      {
        id: ideaAId,
        type: 'geo',
        x: 60,
        y: 150,
        props: { geo: 'rectangle', w: 130, h: 60, richText: toRichText('User Research'), color: 'blue' } as any,
      },
      {
        id: ideaBId,
        type: 'geo',
        x: 60,
        y: 410,
        props: { geo: 'rectangle', w: 130, h: 60, richText: toRichText('Competitors'), color: 'grey' } as any,
      },
      {
        id: ideaCId,
        type: 'geo',
        x: 570,
        y: 150,
        props: { geo: 'rectangle', w: 130, h: 60, richText: toRichText('Marketing Plan'), color: 'orange' } as any,
      },
      {
        id: ideaDId,
        type: 'geo',
        x: 570,
        y: 410,
        props: { geo: 'rectangle', w: 130, h: 60, richText: toRichText('Launch Timeline'), color: 'green' } as any,
      },
    ]);

    const bindings = [
      { from: centerId, to: ideaAId, startAnchor: { x: 0, y: 0.25 }, endAnchor: { x: 1, y: 0.5 } },
      { from: centerId, to: ideaBId, startAnchor: { x: 0, y: 0.75 }, endAnchor: { x: 1, y: 0.5 } },
      { from: centerId, to: ideaCId, startAnchor: { x: 1, y: 0.25 }, endAnchor: { x: 0, y: 0.5 } },
      { from: centerId, to: ideaDId, startAnchor: { x: 1, y: 0.75 }, endAnchor: { x: 0, y: 0.5 } },
    ];

    bindings.forEach((b) => {
      const arrowId = createShapeId();
      editor.createShape({
        id: arrowId,
        type: 'arrow',
        x: 300,
        y: 300,
        props: {
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          color: arrowColor,
          dash: arrowDash,
        } as any,
      });

      editor.createBinding({
        id: createBindingId(),
        type: 'arrow',
        fromId: arrowId,
        toId: b.from,
        props: { terminal: 'start', normalizedAnchor: b.startAnchor, isPrecise: true, isExact: false },
      });

      editor.createBinding({
        id: createBindingId(),
        type: 'arrow',
        fromId: arrowId,
        toId: b.to,
        props: { terminal: 'end', normalizedAnchor: b.endAnchor, isPrecise: true, isExact: false },
      });
    });

    setTimeout(() => {
      editor.zoomToFit();
    }, 100);
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    window.addEventListener('pointerdown', handleClose);
    return () => window.removeEventListener('pointerdown', handleClose);
  }, [contextMenu]);

  const spawnShape = (type: 'rectangle' | 'circle' | 'text' | 'markdown') => {
    if (!editor || !contextMenu) return;
    const shapeId = createShapeId();
    if (type === 'rectangle') {
      editor.createShape({
        id: shapeId,
        type: 'geo',
        x: contextMenu.pageX - 75,
        y: contextMenu.pageY - 40,
        props: {
          geo: 'rectangle',
          w: 150,
          h: 80,
          richText: toRichText('Double click to edit'),
          color: arrowColor,
        } as any,
      });
    } else if (type === 'circle') {
      editor.createShape({
        id: shapeId,
        type: 'geo',
        x: contextMenu.pageX - 60,
        y: contextMenu.pageY - 60,
        props: {
          geo: 'oval',
          w: 120,
          h: 120,
          richText: toRichText('Concept'),
          color: arrowColor,
        } as any,
      });
    } else if (type === 'text') {
      editor.createShape({
        id: shapeId,
        type: 'text',
        x: contextMenu.pageX - 50,
        y: contextMenu.pageY - 20,
        props: {
          richText: toRichText('Label'),
          color: arrowColor,
        } as any,
      });
    } else if (type === 'markdown') {
      editor.createShape({
        id: shapeId,
        type: 'markdown',
        x: contextMenu.pageX - 200,
        y: contextMenu.pageY - 150,
        props: {
          w: 400,
          h: 300,
          text: '# Markdown\nDouble click to edit.',
          color: 'black',
        } as any,
      });
    }
    editor.select(shapeId);
    editor.setEditingShape(shapeId);
  };

  return (
    <div className="app-container">
      {/* Interactive Diagramming Canvas */}
      <main className="canvas-container" ref={containerRef}>
        {/* Click ripples */}
        {ripples.map((r) => (
          <div
            key={r.id}
            className="ripple"
            style={{
              left: `${r.x}px`,
              top: `${r.y}px`,
            }}
          />
        ))}

        <Tldraw onMount={handleMount} shapeUtils={customShapeUtils}>
          {/* Pinpoint overlay handles */}
          <ConnectionOverlay
            containerRef={containerRef}
            arrowColor={arrowColor}
            arrowDash={arrowDash}
          />
        </Tldraw>
      </main>

      {contextMenu && (
        <div
          className="custom-context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              spawnShape('rectangle');
              setContextMenu(null);
            }}
          >
            <span>Add Block</span>
            <span className="shortcut">Rect</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              spawnShape('markdown');
              setContextMenu(null);
            }}
          >
            <span>Add Markdown</span>
            <span className="shortcut">MD</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              spawnShape('circle');
              setContextMenu(null);
            }}
          >
            <span>Add Concept</span>
            <span className="shortcut">Circle</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              spawnShape('text');
              setContextMenu(null);
            }}
          >
            <span>Add Label</span>
            <span className="shortcut">Text</span>
          </button>
          <div className="context-menu-separator" />
          <button
            className="context-menu-item"
            onClick={() => {
              loadFlowchart();
              setContextMenu(null);
            }}
          >
            <span>Flowchart</span>
            <span className="shortcut">➔</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              loadMindmap();
              setContextMenu(null);
            }}
          >
            <span>Mindmap</span>
            <span className="shortcut">➔</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default App;

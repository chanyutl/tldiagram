import { useState, useEffect, useRef } from 'react';
import { Tldraw, Editor, createShapeId, toRichText } from 'tldraw';
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
            <div className="context-menu-item-left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="context-menu-icon">
                <rect x="3" y="3" width="18" height="18" rx="3"/>
              </svg>
              <span>Block</span>
            </div>
            <span className="shortcut">Rect</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              spawnShape('markdown');
              setContextMenu(null);
            }}
          >
            <div className="context-menu-item-left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="context-menu-icon">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
              <span>Markdown</span>
            </div>
            <span className="shortcut">MD</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              spawnShape('text');
              setContextMenu(null);
            }}
          >
            <div className="context-menu-item-left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="context-menu-icon">
                <polyline points="4 7 4 4 20 4 20 7"/>
                <line x1="9" y1="20" x2="15" y2="20"/>
                <line x1="12" y1="4" x2="12" y2="20"/>
              </svg>
              <span>Label</span>
            </div>
            <span className="shortcut">Text</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default App;

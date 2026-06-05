import { 
  BaseBoxShapeUtil, 
  DefaultColorStyle, 
  DEFAULT_THEME,
  HTMLContainer, 
  T
} from 'tldraw';
import type {
  TLBaseBoxShape,
  TLDefaultColorStyle
} from 'tldraw';
import { parseMarkdown } from '../utils/markdownParser';

// Register the custom shape props in the global TLGlobalShapePropsMap
declare module 'tldraw' {
  interface TLGlobalShapePropsMap {
    'markdown': {
      w: number;
      h: number;
      text: string;
      color: TLDefaultColorStyle;
    };
  }
}

// Define the shape type using TLBaseBoxShape intersection
export type MarkdownShape = TLBaseBoxShape & {
  type: 'markdown';
  props: {
    w: number;
    h: number;
    text: string;
    color: TLDefaultColorStyle;
  };
};

export class MarkdownShapeUtil extends BaseBoxShapeUtil<MarkdownShape> {
  static override type = 'markdown' as const;

  // Define properties that should be persisted in the store
  static override props = {
    w: T.number,
    h: T.number,
    text: T.string,
    color: DefaultColorStyle,
  };

  // Provide initial default shape properties
  override getDefaultProps(): MarkdownShape['props'] {
    return {
      w: 400,
      h: 300,
      text: '# Markdown\nDouble click to edit.',
      color: 'black',
    };
  }

  // Allow double-click to edit
  override canEdit(_shape: MarkdownShape) {
    return true;
  }


  // Required implementation of abstract member getIndicatorPath for selection highlights
  override getIndicatorPath(shape: MarkdownShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }

  // Render method of the shape utility
  override component(shape: MarkdownShape) {
    const isEditing = this.editor.getEditingShapeId() === shape.id;
    const isDarkMode = this.editor.user.getIsDarkMode();
    
    // Resolve current theme colors based on tldraw theme configurations
    const theme = DEFAULT_THEME.colors[isDarkMode ? 'dark' : 'light'];
    const resolvedColor = theme[shape.props.color];

    const textColor = isDarkMode ? '#f1f5f9' : '#0f172a';
    const cardBg = resolvedColor.semi;
    const cardBorder = resolvedColor.solid;

    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: 'all',
          boxSizing: 'border-box',
        }}
      >
        <div
          className={`md-block-container ${isDarkMode ? 'dark' : 'light'}`}
          style={{
            backgroundColor: cardBg,
            borderColor: cardBorder,
            color: textColor,
            width: '100%',
            height: '100%',
          }}
        >
          {isEditing ? (
            <textarea
              value={shape.props.text}
              onChange={(e) => {
                this.editor.updateShape({
                  id: shape.id,
                  type: 'markdown',
                  props: { text: e.target.value },
                });
              }}
              onKeyDown={(e) => {
                // Stop event propagation so keyboard keydown events don't trigger canvas shortcuts (e.g. Backspace deleting shape)
                e.stopPropagation();
                if (e.key === 'Escape') {
                  this.editor.setEditingShape(null);
                }
              }}
              onBlur={() => {
                this.editor.setEditingShape(null);
              }}
              className="md-textarea"
              autoFocus
              placeholder="Write markdown here..."
            />
          ) : (
            shape.props.text.trim() === '' ? (
              <em style={{ opacity: 0.5, fontSize: '14px' }}>Double-click to edit markdown...</em>
            ) : (
              parseMarkdown(shape.props.text)
            )
          )}
        </div>
      </HTMLContainer>
    );
  }

  override indicator(shape: MarkdownShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx="12" ry="12" />;
  }
}

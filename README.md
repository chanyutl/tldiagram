# My Custom tldraw Workspace

I was searching for a minimal, clean diagramming and flowchart tool to map out designs and notes. I found [tldraw](https://tldraw.dev/), and it was incredibly close to exactly what I wanted. However, to make it fit my daily coding and note-taking workflow perfectly, I needed a few custom tweaks and quality-of-life features.

This project is my personal workspace built on top of tldraw engine. It includes a handful of customized behaviors, keyboard shortcuts, and custom shapes that make diagramming feel more integrated for my specific needs.

---

## The Tweaks I Added

Here are the custom adjustments I made to adapt tldraw to my personal flow:

### 1. Custom Markdown Cards (`MarkdownShapeUtil`)
Standard text shapes are great, but I often need structured notes directly on the board.
* **Formatted Notes**: I added a custom markdown parser supporting headers, bold/italic text, links, bullet lists, tables, and rules.
* **Copyable Code Blocks**: Code blocks render with a "Copy" button to quickly grab snippets.
* **Scrolling Inside the Card**: Long markdown cards scroll internally when hovered. This prevents canvas panning/zooming from triggering when I just want to scroll through a text block.

### 2. Edge-Aligned Connection Overlay
Toggling back and forth to the arrow tool felt a bit slow for rapid flowcharting.
* **Hover-to-Link**: Hovering near any block or markdown card reveals a small violet pin.
* **Dragging Connections**: Dragging from a pin immediately creates a connector arrow and binds it to the nearest edge of the target shape.
* **Resizing-Friendly**: The pins automatically hide when the cursor gets close to the corners so that I don't accidentally click a connector pin when trying to resize a shape.

### 3. Workflow Shortcuts
* **Sleek Context Menu**: I set up a `Ctrl + Shift + Left-click` shortcut on empty canvas areas to summon a custom menu right at the cursor. This lets me quickly spawn blocks, markdown cards, labels, or handle file actions.
* **Ripple Feedback**: Added a gentle ripple animation on click/shortcuts to give me a subtle visual confirmation.
* **Offset Duplication**: I tweaked `Ctrl + D` / `Cmd + D` to duplicate selected shapes with a `+30px` offset, so the duplicates don't cover the original shapes.

### 4. Smart JSON Merge & Import
Since I import/export diagrams as JSON files frequently:
* **Merge Option**: Instead of just replacing the entire canvas on import, I added a merge mode. It offsets the imported shapes and automatically selects them so that they don't overlay existing shapes.

---

## Technology Stack

The project is built on:
* **Core Canvas**: [tldraw](https://github.com/tldraw/tldraw)
* **Frontend**: [React 19](https://react.dev/)
* **Build Tooling**: [Vite](https://vite.dev/) & [TypeScript](https://www.typescriptlang.org/)

---

## Getting Started

To run the workspace locally:

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the local development server**:
   ```bash
   npm run dev
   ```

3. **Build the production package**:
   ```bash
   npm run build
   ```

---

## Acknowledgements

A huge thank you to the tldraw team. Their canvas library is exceptionally well-designed and easy to extend.

import React, { useState } from 'react';

// Inline parser: parses bold, italic, code, links, strikethrough in a string and returns React nodes
export function parseInline(text: string): React.ReactNode[] {
  // Matches code block, links, bold, italic, strikethrough, or normal text
  const regex = /(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|__[^\n_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_)/g;
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="md-inline-code">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('[') && part.includes('](')) {
      const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        const linkText = match[1];
        const url = match[2];
        return (
          <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="md-link" onClick={(e) => e.stopPropagation()}>
            {linkText}
          </a>
        );
      }
    }
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return <del key={index}>{part.slice(2, -2)}</del>;
    }
    return part;
  });
}

// Beautiful code block component with a copy-to-clipboard button
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation(); // Stop click-through on tldraw canvas
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="md-code-block-container" onPointerDown={(e) => e.stopPropagation()}>
      <div className="md-code-block-header">
        <span className="md-code-block-lang">{language || 'code'}</span>
        <button className="md-code-block-copy-btn" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="md-code-block-pre">
        <code className="md-code-block-code">{code}</code>
      </pre>
    </div>
  );
}

// Table block component that renders standard markdown tables into stylized HTML tables
function TableBlock({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;

  const parseRow = (rowLine: string) => {
    const cells = rowLine.split('|').map(c => c.trim());
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();
    return cells;
  };

  const firstRow = parseRow(lines[0]);
  let hasHeader = false;
  let startIdx = 0;

  if (lines.length > 1) {
    const secondRow = parseRow(lines[1]);
    const isSeparator = secondRow.every(cell => /^[:-]+$/.test(cell));
    if (isSeparator) {
      hasHeader = true;
      startIdx = 2;
    }
  }

  const rows = lines.slice(startIdx).map(parseRow);

  return (
    <table className="md-table">
      {hasHeader && (
        <thead>
          <tr>
            {firstRow.map((cell, idx) => (
              <th key={idx}>{parseInline(cell)}</th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr key={rowIdx}>
            {row.map((cell, cellIdx) => (
              <td key={cellIdx}>{parseInline(cell)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Block parser that handles headers, lists, hr, tables, code blocks, and paragraphs
export function parseMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code Blocks
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      const codeText = codeLines.join('\n');
      blocks.push(
        <CodeBlock key={i} code={codeText} language={lang} />
      );
      continue;
    }

    // 2. Tables
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push(<TableBlock key={i} lines={tableLines} />);
      continue;
    }

    // 3. Horizontal Rules
    if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
      blocks.push(<hr key={i} className="md-hr" />);
      i++;
      continue;
    }

    // 4. Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      blocks.push(
        <HeadingTag key={i} className={`md-h${level}`}>
          {parseInline(headingText)}
        </HeadingTag>
      );
      i++;
      continue;
    }

    // 5. Unordered Lists
    if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('* ') || lines[i].trim().startsWith('- '))) {
        const itemText = lines[i].trim().slice(2);
        listItems.push(itemText);
        i++;
      }
      blocks.push(
        <ul key={i} className="md-ul">
          {listItems.map((item, idx) => (
            <li key={idx}>{parseInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // 6. Ordered Lists
    const olMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].trim().match(/^(\d+)\.\s+(.*)$/)) {
        const match = lines[i].trim().match(/^(\d+)\.\s+(.*)$/);
        if (match) {
          listItems.push(match[2]);
        }
        i++;
      }
      blocks.push(
        <ol key={i} className="md-ol">
          {listItems.map((item, idx) => (
            <li key={idx}>{parseInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // 7. Empty Lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // 8. Paragraphs (collect consecutive normal lines)
    const pLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !(lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) &&
      lines[i].trim() !== '---' &&
      lines[i].trim() !== '***' &&
      lines[i].trim() !== '___' &&
      !lines[i].match(/^(#{1,6})\s+/) &&
      !lines[i].trim().startsWith('* ') &&
      !lines[i].trim().startsWith('- ') &&
      !lines[i].trim().match(/^(\d+)\.\s+/)
    ) {
      pLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={i} className="md-p">
        {parseInline(pLines.join(' '))}
      </p>
    );
  }

  return <div className="markdown-body">{blocks}</div>;
}

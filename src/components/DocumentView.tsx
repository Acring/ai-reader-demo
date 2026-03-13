import { useCallback, useRef } from 'react';
import type { Paragraph, Highlight } from '../types';

interface DocumentViewProps {
  paragraphs: Paragraph[];
  highlights: Highlight[];
  activeCommentId: string | null;
  onSelect: (
    paragraphId: string,
    startOffset: number,
    endOffset: number,
    selectedText: string,
    rect: DOMRect,
  ) => void;
  onCommentClick: (commentId: string) => void;
}

/** Render paragraph text with highlight spans applied. */
function renderHighlightedText(
  text: string,
  highlights: Highlight[],
  activeCommentId: string | null,
  onCommentClick: (commentId: string) => void,
) {
  if (highlights.length === 0) return text;

  // Sort by startOffset
  const sorted = [...highlights].sort((a, b) => a.startOffset - b.startOffset);

  const parts: (string | { text: string; color: string; active: boolean; commentId?: string })[] = [];
  let cursor = 0;

  for (const h of sorted) {
    const start = Math.max(h.startOffset, cursor);
    const end = h.endOffset;
    if (start >= end) continue;

    if (cursor < start) {
      parts.push(text.slice(cursor, start));
    }
    parts.push({
      text: text.slice(start, end),
      color: h.color,
      active: h.commentId === activeCommentId && !!activeCommentId,
      commentId: h.commentId,
    });
    cursor = end;
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts.map((part, i) => {
    if (typeof part === 'string') return part;
    return (
      <mark
        key={i}
        className={`highlight-mark ${part.active ? 'active' : ''} ${part.commentId ? 'has-comment' : ''}`}
        style={{ backgroundColor: part.color + '40', borderBottomColor: part.color }}
        onClick={() => part.commentId && onCommentClick(part.commentId)}
      >
        {part.text}
      </mark>
    );
  });
}

export function DocumentView({
  paragraphs,
  highlights,
  activeCommentId,
  onSelect,
  onCommentClick,
}: DocumentViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const range = selection.getRangeAt(0);

    // Find the paragraph element
    let node: Node | null = range.startContainer;
    let paragraphEl: HTMLElement | null = null;
    while (node) {
      if (node instanceof HTMLElement && node.dataset.paragraphId) {
        paragraphEl = node;
        break;
      }
      node = node.parentElement;
    }
    if (!paragraphEl) return;

    const paragraphId = paragraphEl.dataset.paragraphId!;

    // Calculate text offsets within the paragraph
    const fullText = paragraphEl.textContent || '';
    const beforeRange = document.createRange();
    beforeRange.setStart(paragraphEl, 0);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = beforeRange.toString().length;
    const endOffset = startOffset + selectedText.length;

    // Validate offsets match the actual text
    if (fullText.slice(startOffset, endOffset) !== selectedText) {
      // Cross-paragraph selection, just use what we can
      return;
    }

    const rect = range.getBoundingClientRect();
    onSelect(paragraphId, startOffset, endOffset, selectedText, rect);
  }, [onSelect]);

  let currentPage = 0;

  return (
    <div className="document-view" ref={containerRef} onMouseUp={handleMouseUp}>
      {paragraphs.map((para) => {
        const paraHighlights = highlights.filter((h) => h.paragraphId === para.id);
        const showPageHeader = para.pageNum !== currentPage;
        if (showPageHeader) currentPage = para.pageNum;

        return (
          <div key={para.id}>
            {showPageHeader && (
              <div className="page-header">第 {para.pageNum} 页</div>
            )}
            <p className="paragraph" data-paragraph-id={para.id}>
              {renderHighlightedText(para.text, paraHighlights, activeCommentId, onCommentClick)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

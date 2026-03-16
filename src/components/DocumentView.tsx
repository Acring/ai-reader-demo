import { useCallback, useRef, useMemo } from 'react';
import type { Paragraph, Highlight } from '../types';
import { findTermMatches, type TermTypesMap, TERM_TYPE_COLORS } from '../termColors';

interface DocumentViewProps {
  paragraphs: Paragraph[];
  highlights: Highlight[];
  activeCommentId: string | null;
  termTypes: TermTypesMap | null;
  activeTerm: string | null;
  onSelect: (
    paragraphId: string,
    startOffset: number,
    endOffset: number,
    selectedText: string,
    rect: DOMRect,
  ) => void;
  onCommentClick: (commentId: string) => void;
  onTermClick: (term: string) => void;
}

type TextSegment =
  | { kind: 'plain'; text: string }
  | { kind: 'highlight'; text: string; color: string; active: boolean; commentId?: string }
  | { kind: 'term'; text: string; color: string; type: string };

/**
 * 将段落文本切分为 segments：先应用用户高亮，再对非高亮的纯文本片段进行术语着色。
 */
function buildSegments(
  text: string,
  highlights: Highlight[],
  activeCommentId: string | null,
  termTypes: TermTypesMap | null,
): TextSegment[] {
  // 第一步：按照高亮切分
  const rawParts: TextSegment[] = [];
  if (highlights.length === 0) {
    rawParts.push({ kind: 'plain', text });
  } else {
    const sorted = [...highlights].sort((a, b) => a.startOffset - b.startOffset);
    let cursor = 0;
    for (const h of sorted) {
      const start = Math.max(h.startOffset, cursor);
      const end = h.endOffset;
      if (start >= end) continue;
      if (cursor < start) {
        rawParts.push({ kind: 'plain', text: text.slice(cursor, start) });
      }
      rawParts.push({
        kind: 'highlight',
        text: text.slice(start, end),
        color: h.color,
        active: h.commentId === activeCommentId && !!activeCommentId,
        commentId: h.commentId,
      });
      cursor = end;
    }
    if (cursor < text.length) {
      rawParts.push({ kind: 'plain', text: text.slice(cursor) });
    }
  }

  if (!termTypes) return rawParts;

  // 第二步：对 plain 片段进行术语匹配着色
  const result: TextSegment[] = [];
  for (const part of rawParts) {
    if (part.kind !== 'plain') {
      result.push(part);
      continue;
    }
    const matches = findTermMatches(part.text, termTypes);
    if (matches.length === 0) {
      result.push(part);
      continue;
    }
    let cursor = 0;
    for (const m of matches) {
      if (m.start > cursor) {
        result.push({ kind: 'plain', text: part.text.slice(cursor, m.start) });
      }
      result.push({ kind: 'term', text: m.term, color: m.color, type: m.type });
      cursor = m.end;
    }
    if (cursor < part.text.length) {
      result.push({ kind: 'plain', text: part.text.slice(cursor) });
    }
  }
  return result;
}

function renderSegments(
  segments: TextSegment[],
  activeTerm: string | null,
  onCommentClick: (commentId: string) => void,
  onTermClick: (term: string) => void,
) {
  return segments.map((seg, i) => {
    switch (seg.kind) {
      case 'plain':
        return <span key={i}>{seg.text}</span>;
      case 'highlight':
        return (
          <mark
            key={i}
            className={`highlight-mark ${seg.active ? 'active' : ''} ${seg.commentId ? 'has-comment' : ''}`}
            style={{ backgroundColor: seg.color + '40', borderBottomColor: seg.color }}
            onClick={() => seg.commentId && onCommentClick(seg.commentId)}
          >
            {seg.text}
          </mark>
        );
      case 'term': {
        const isActive = activeTerm === seg.text;
        return (
          <span
            key={i}
            className={`term-colored ${isActive ? 'term-active' : ''}`}
            style={isActive ? { backgroundColor: seg.color, color: '#fff' } : { color: seg.color }}
            title={`${seg.text} [${TERM_TYPE_COLORS[seg.type]?.label ?? seg.type}]`}
            onClick={() => onTermClick(seg.text)}
          >
            {seg.text}
          </span>
        );
      }
    }
  });
}

export function DocumentView({
  paragraphs,
  highlights,
  activeCommentId,
  termTypes,
  activeTerm,
  onSelect,
  onCommentClick,
  onTermClick,
}: DocumentViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    const range = selection.getRangeAt(0);

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

    const fullText = paragraphEl.textContent || '';
    const beforeRange = document.createRange();
    beforeRange.setStart(paragraphEl, 0);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = beforeRange.toString().length;
    const endOffset = startOffset + selectedText.length;

    if (fullText.slice(startOffset, endOffset) !== selectedText) {
      return;
    }

    const rect = range.getBoundingClientRect();
    onSelect(paragraphId, startOffset, endOffset, selectedText, rect);
  }, [onSelect]);

  const renderedParagraphs = useMemo(() => {
    let currentPage = 0;
    return paragraphs.map((para) => {
      const paraHighlights = highlights.filter((h) => h.paragraphId === para.id);
      const showPageHeader = para.pageNum !== currentPage;
      if (showPageHeader) currentPage = para.pageNum;

      const segments = buildSegments(para.text, paraHighlights, activeCommentId, termTypes);
      const Tag = para.tag === 'p' ? 'p' : para.tag;
      const className = para.tag === 'p' ? 'paragraph' : `paragraph paragraph-${para.tag}`;

      return (
        <div key={para.id}>
          {showPageHeader && (
            <div className="page-header">第 {para.pageNum} 页</div>
          )}
          <Tag className={className} data-paragraph-id={para.id}>
            {renderSegments(segments, activeTerm, onCommentClick, onTermClick)}
          </Tag>
        </div>
      );
    });
  }, [paragraphs, highlights, activeCommentId, termTypes, activeTerm, onCommentClick, onTermClick]);

  return (
    <div className="document-view" ref={containerRef} onMouseUp={handleMouseUp}>
      {renderedParagraphs}
    </div>
  );
}

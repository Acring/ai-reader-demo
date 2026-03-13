import { useState, useCallback } from 'react';
import { usePDF } from './hooks/usePDF';
import { Toolbar } from './components/Toolbar';
import { DocumentView } from './components/DocumentView';
import { CommentSidebar } from './components/CommentSidebar';
import type { Highlight, Comment } from './types';
import './App.css';

let idCounter = 0;
function nextId(prefix: string) {
  return prefix + (++idCounter);
}

function App() {
  const { paragraphs, fileName, loading, loadPDF } = usePDF();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [color, setColor] = useState('#ff0000');
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  // Selection popup state
  const [selectionPopup, setSelectionPopup] = useState<{
    paragraphId: string;
    startOffset: number;
    endOffset: number;
    selectedText: string;
    x: number;
    y: number;
  } | null>(null);

  const handleSelect = useCallback(
    (
      paragraphId: string,
      startOffset: number,
      endOffset: number,
      selectedText: string,
      rect: DOMRect,
    ) => {
      setSelectionPopup({
        paragraphId,
        startOffset,
        endOffset,
        selectedText,
        x: rect.right,
        y: rect.bottom + 4,
      });
    },
    [],
  );

  const handleHighlight = useCallback(() => {
    if (!selectionPopup) return;
    const hlId = nextId('h');
    setHighlights((prev) => [
      ...prev,
      {
        id: hlId,
        paragraphId: selectionPopup.paragraphId,
        startOffset: selectionPopup.startOffset,
        endOffset: selectionPopup.endOffset,
        color,
      },
    ]);
    window.getSelection()?.removeAllRanges();
    setSelectionPopup(null);
  }, [selectionPopup, color]);

  const handleAddComment = useCallback(() => {
    if (!selectionPopup) return;
    const note = prompt('请输入批注内容:');
    if (!note) return;

    const hlId = nextId('h');
    const commentId = nextId('c');
    setHighlights((prev) => [
      ...prev,
      {
        id: hlId,
        paragraphId: selectionPopup.paragraphId,
        startOffset: selectionPopup.startOffset,
        endOffset: selectionPopup.endOffset,
        color,
        commentId,
      },
    ]);
    setComments((prev) => [
      ...prev,
      {
        id: commentId,
        highlightId: hlId,
        selectedText: selectionPopup.selectedText,
        content: note,
        createdAt: Date.now(),
      },
    ]);
    window.getSelection()?.removeAllRanges();
    setSelectionPopup(null);
  }, [selectionPopup, color]);

  const handleDeleteComment = useCallback((commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setHighlights((prev) => prev.filter((h) => h.commentId !== commentId));
    setActiveCommentId(null);
  }, []);

  const handleExport = useCallback(() => {
    // Build markdown with annotations as footnotes
    let md = `# ${fileName}\n\n`;
    const footnotes: string[] = [];

    for (const para of paragraphs) {
      const headingPrefix = para.tag === 'h1' ? '# ' : para.tag === 'h2' ? '## ' : para.tag === 'h3' ? '### ' : '';
      const paraHighlights = highlights.filter((h) => h.paragraphId === para.id);
      if (paraHighlights.length === 0) {
        md += headingPrefix + para.text + '\n\n';
      } else {
        // Apply highlights as **bold** markers and append comments as footnotes
        const sorted = [...paraHighlights].sort((a, b) => a.startOffset - b.startOffset);
        let cursor = 0;
        let line = '';
        for (const h of sorted) {
          if (h.startOffset > cursor) {
            line += para.text.slice(cursor, h.startOffset);
          }
          line += '==' + para.text.slice(h.startOffset, h.endOffset) + '==';
          if (h.commentId) {
            const comment = comments.find((c) => c.id === h.commentId);
            if (comment) {
              footnotes.push(comment.content);
              line += `[^${footnotes.length}]`;
            }
          }
          cursor = h.endOffset;
        }
        if (cursor < para.text.length) {
          line += para.text.slice(cursor);
        }
        md += headingPrefix + line + '\n\n';
      }
    }

    if (footnotes.length > 0) {
      md += '---\n\n';
      footnotes.forEach((note, i) => {
        md += `[^${i + 1}]: ${note}\n`;
      });
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.pdf$/i, '') + '.md';
    a.click();
    URL.revokeObjectURL(url);
  }, [paragraphs, highlights, comments, fileName]);

  return (
    <div className="app">
      <Toolbar
        color={color}
        onColorChange={setColor}
        onFileSelect={loadPDF}
        onExport={handleExport}
        hasContent={paragraphs.length > 0}
      />
      <div className="main-area">
        {loading ? (
          <div className="empty-state">
            <div className="spinner" />
            <p>正在解析 PDF...</p>
          </div>
        ) : paragraphs.length > 0 ? (
          <>
            <DocumentView
              paragraphs={paragraphs}
              highlights={highlights}
              activeCommentId={activeCommentId}
              onSelect={handleSelect}
              onCommentClick={setActiveCommentId}
            />
            <CommentSidebar
              comments={comments}
              activeCommentId={activeCommentId}
              onActiveChange={setActiveCommentId}
              onDelete={handleDeleteComment}
            />
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <p>点击上方「打开 PDF」选择文件</p>
          </div>
        )}
      </div>

      {selectionPopup && (
        <>
          <div
            className="selection-popup-backdrop"
            onClick={() => {
              window.getSelection()?.removeAllRanges();
              setSelectionPopup(null);
            }}
          />
          <div
            className="selection-popup"
            style={{ left: selectionPopup.x, top: selectionPopup.y }}
          >
            <button onClick={handleHighlight}>高亮</button>
            <button onClick={handleAddComment}>添加批注</button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;

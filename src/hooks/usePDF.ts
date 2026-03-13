import { useState, useCallback } from 'react';
import pdf2md from '@opendocsg/pdf2md';
import type { Paragraph, ParagraphTag } from '../types';

let idCounter = 0;
function nextId() {
  return 'p' + (++idCounter);
}

function inferTag(line: string): { tag: ParagraphTag; text: string } {
  // pdf2md 会把大量正文也标记为 ###，所以只识别 # 和 ##
  if (line.startsWith('# ') && !line.startsWith('## ')) return { tag: 'h1', text: line.slice(2) };
  if (line.startsWith('## ') && !line.startsWith('### ')) return { tag: 'h2', text: line.slice(3) };
  // ### 及更深层级当作正文
  const match = line.match(/^#{3,6}\s/);
  if (match) return { tag: 'p', text: line.slice(match[0].length) };
  return { tag: 'p', text: line };
}

export function usePDF() {
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);

  const loadPDF = useCallback(async (file: File) => {
    setLoading(true);
    setFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const markdown = await pdf2md(arrayBuffer);
      console.log('=== pdf2md raw output (first 3000 chars) ===');
      console.log(markdown.slice(0, 3000));

      const result: Paragraph[] = [];
      // Split by page breaks
      const pages = markdown.split('<!-- PAGE_BREAK -->\n');

      for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
        const pageContent = pages[pageIdx];
        // Split into paragraphs by blank lines
        const blocks = pageContent.split(/\n{2,}/);

        for (const block of blocks) {
          const trimmed = block.trim();
          if (!trimmed) continue;

          const { tag, text } = inferTag(trimmed);
          result.push({
            id: nextId(),
            pageNum: pageIdx + 1,
            text,
            tag,
          });
        }
      }

      setParagraphs(result);
    } finally {
      setLoading(false);
    }
  }, []);

  return { paragraphs, fileName, loading, loadPDF };
}

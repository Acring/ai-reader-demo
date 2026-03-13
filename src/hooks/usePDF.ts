import { useState, useCallback } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import type { Paragraph } from '../types';

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

let idCounter = 0;
function nextId() {
  return 'p' + (++idCounter);
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
      const doc = await getDocument({ data: arrayBuffer }).promise;
      const result: Paragraph[] = [];

      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();

        // Group text items into lines based on y-position,
        // then merge adjacent lines into paragraphs by gaps.
        const lines: { y: number; text: string; fontSize: number }[] = [];

        for (const item of content.items) {
          if (!('str' in item) || !item.str.trim()) continue;
          // item.transform: [scaleX, skewX, skewY, scaleY, x, y]
          const y = item.transform[5];
          const fontSize = Math.abs(item.transform[3]);
          const text = item.str;

          // Merge into existing line if same y (within tolerance)
          const existing = lines.find((l) => Math.abs(l.y - y) < fontSize * 0.3);
          if (existing) {
            existing.text += text;
          } else {
            lines.push({ y, text, fontSize });
          }
        }

        // Sort lines top to bottom (PDF y is bottom-up, so larger y = higher)
        lines.sort((a, b) => b.y - a.y);

        // Merge lines into paragraphs: if gap between lines > 1.5x fontSize, new paragraph
        let currentParagraph = '';
        let lastY = 0;
        let lastFontSize = 12;

        for (let j = 0; j < lines.length; j++) {
          const line = lines[j];
          if (j === 0) {
            currentParagraph = line.text;
            lastY = line.y;
            lastFontSize = line.fontSize;
            continue;
          }

          const gap = lastY - line.y;
          if (gap > lastFontSize * 1.8) {
            // Large gap — start new paragraph
            if (currentParagraph.trim()) {
              result.push({
                id: nextId(),
                pageNum: i,
                text: currentParagraph.trim(),
              });
            }
            currentParagraph = line.text;
          } else {
            currentParagraph += ' ' + line.text;
          }
          lastY = line.y;
          lastFontSize = line.fontSize;
        }

        if (currentParagraph.trim()) {
          result.push({
            id: nextId(),
            pageNum: i,
            text: currentParagraph.trim(),
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

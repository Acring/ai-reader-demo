export type ParagraphTag = 'h1' | 'h2' | 'h3' | 'p';

export interface Paragraph {
  id: string;
  pageNum: number;
  text: string;
  /** Semantic tag inferred from font size */
  tag: ParagraphTag;
}

export interface Highlight {
  id: string;
  /** paragraph id */
  paragraphId: string;
  /** start offset in paragraph text */
  startOffset: number;
  /** end offset in paragraph text */
  endOffset: number;
  color: string;
  commentId?: string;
}

export interface Comment {
  id: string;
  highlightId: string;
  /** the highlighted text snippet */
  selectedText: string;
  content: string;
  createdAt: number;
}

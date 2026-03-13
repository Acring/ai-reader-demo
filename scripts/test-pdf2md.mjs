import { readFileSync, writeFileSync } from 'fs';
import pdf2md from '@opendocsg/pdf2md';

const pdfPath = new URL('../public/test2.pdf', import.meta.url);
const buf = readFileSync(pdfPath);

const markdown = await pdf2md(buf.buffer);

// Write full output to file for inspection
writeFileSync('scripts/test-pdf2md-output.md', markdown, 'utf-8');

// Also print first 5000 chars to console
console.log('=== pdf2md output (first 5000 chars) ===\n');
console.log(markdown.slice(0, 5000));
console.log('\n=== Total length:', markdown.length, 'chars ===');

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// Extraction is an offline build step. Runtime never executes document content.
const base = new URL('../', import.meta.url);
const corpus = JSON.parse(readFileSync(new URL('src/data/hvll2026.json', base)));
const sources = [{ ...corpus.source, fileName: '2026 hvll bylaws.pdf' }];
const chunks = [...corpus.chunks];
const warnings = [];
for (const file of readdirSync(new URL('public/rules/', base)).filter((name) => /\.pdf$/i.test(name)).sort()) {
  const path = new URL(`public/rules/${encodeURIComponent(file)}`, base);
  const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (file === '2026 hvll bylaws.pdf') {
    // Refuse silent divergence from the substantive text already checked into the app.
    if (hash !== 'a6dc41245b83cd6f0ada7265dfd3d8b9a1c323f6c8a2ecc853c6761f39e14eba') throw new Error('The bylaws PDF changed. Reconcile src/data/hvll2026.json and source-checked answers before accepting a new hash.');
    const text = execFileSync('pdftotext', ['-layout', path.pathname.replace(/%20/g, ' '), '-'], { encoding: 'utf8' });
    const normalize = (value) => value.replace(/\s+/g, ' ').trim();
    if (!normalize(text).includes('No player may pitch more than 3 innings per game or more than 6 innings per week')) throw new Error('Bylaws changed: review the structured pitching rules before rebuilding.');
    sources[0].contentHash = hash;
    sources[0].url = `/rules/${encodeURIComponent(file)}`;
    continue;
  }
  const id = `local-${hash.slice(0, 16)}`;
  const title = file.replace(/\.pdf$/i, '').replace(/[_]/g, ' ');
  const year = file.match(/20\d\d/)?.[0] ?? (/6\.28\.24/.test(file) ? '2024' : '');
  const divisions = /rookie/i.test(file) ? ['Rookie Ball'] : ['All divisions'];
  const text = execFileSync('pdftotext', ['-layout', decodeURIComponent(path.pathname), '-'], { encoding: 'utf8', maxBuffer: 10_000_000 });
  let pages = text.split('\f');
  if (!pages.at(-1).trim()) pages.pop();
  const ocrPath = new URL(`server/data/ocr/${hash}.json`, base);
  const ocr = existsSync(ocrPath) ? JSON.parse(readFileSync(ocrPath)) : null;
  if (ocr) {
    if (ocr.contentHash !== hash || ocr.pages.length !== pages.length) throw new Error(`OCR does not match ${file}.`);
    pages = pages.map((page, index) => page.trim().length >= 60 ? page : ocr.pages.find((p) => p.page === index + 1)?.text ?? page);
  }
  sources.push({ id, title, year, fileName: file, pageCount: pages.length, contentHash: hash, historical: /rookie/i.test(file), reference: !/rookie/i.test(file), ocr: Boolean(ocr), url: `/rules/${encodeURIComponent(file)}` });
  pages.forEach((page, pageIndex) => {
    const plain = page.replace(/[ \t]+/g, ' ').trim();
    if (ocr) warnings.push({ file, page: pageIndex + 1, reason: 'OCR transcription; check the scanned original for omissions and recognition errors.' });
    if (plain.length < 60) warnings.push({ file, page: pageIndex + 1, reason: 'Little searchable text; image/map or scanned content may need visual review.' });
    let block = '';
    const add = () => { if (block.trim()) chunks.push({ id: `${id}:${pageIndex + 1}:${chunks.length}`, sourceId: id, title, section: title, page: pageIndex + 1, pages: [pageIndex + 1], divisions, year, text: block.trim() }); block = ''; };
    for (const paragraph of plain.split(/\n\s*\n/)) {
      if (block.length + paragraph.length > 1800) add();
      // Long OCR paragraphs are bounded with overlap so prompt size remains predictable.
      if (paragraph.length > 2400) { add(); for (let i = 0; i < paragraph.length; i += 1800) { block = paragraph.slice(i, i + 2100); add(); } }
      else block += `${paragraph}\n\n`;
    }
    add();
  });
}
const result = { sources, chunks, warnings };
writeFileSync(new URL('server/data/rules.json', base), `${JSON.stringify(result, null, 2)}\n`);
console.log(`Indexed ${sources.length} documents / ${chunks.length} passages. ${warnings.length} pages require visual review.`);

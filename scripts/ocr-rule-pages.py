"""Offline OCR cache for a scanned rules PDF. Requires Poppler and Tesseract.

Usage: python3 scripts/ocr-rule-pages.py 'public/rules/document.pdf'
Output is labelled machine-transcribed. Review the PDF before relying on it.
"""
from pathlib import Path
import hashlib, json, subprocess, sys, tempfile

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).resolve()
if source.parent != (root / 'public/rules').resolve() or source.suffix.lower() != '.pdf':
    raise SystemExit('Choose a PDF directly inside public/rules.')
digest = hashlib.sha256(source.read_bytes()).hexdigest()
pages = []
with tempfile.TemporaryDirectory(prefix='diamond-ocr-') as tmp:
    subprocess.run(['pdftoppm', '-r', '300', '-png', str(source), f'{tmp}/page'], check=True)
    for image in sorted(Path(tmp).glob('page-*.png'), key=lambda p: int(p.stem.split('-')[-1])):
        text = subprocess.check_output(['tesseract', str(image), 'stdout', '--psm', '3'], text=True)
        pages.append({'page': int(image.stem.split('-')[-1]), 'text': text})
target = root / 'server/data/ocr' / f'{digest}.json'
target.parent.mkdir(exist_ok=True, parents=True)
target.write_text(json.dumps({'fileName': source.name, 'contentHash': digest, 'method': 'Tesseract, 300 dpi, psm 3', 'review': 'Unreviewed machine transcription; check original pages.', 'pages': pages}, indent=2) + '\n')
print(f'Wrote {len(pages)} pages. Review the text, then run npm run assistant:index.')

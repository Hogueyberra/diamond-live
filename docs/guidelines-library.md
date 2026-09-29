# Guidelines library

## Included source

The 2026 Huntington Valley Little League Bylaws and Local Rules are indexed as 204 source sections covering PDF pages 2–55. Page 1 is a duplicate table of contents. All seven listed divisions, administration, conduct, playing rules, tournaments, and safety appendices are included.

The original wording and exceptions are preserved. PDF line wrapping/spacing is normalized and table cells are separated by `|`; original formatting remains available through the PDF link. Results are passages from documents, not generated answers or automatic rule enforcement.

- [Official PDF](https://dt5602vnjxv0c.cloudfront.net/portals/20562/docs/2026/2026%20hvll%20bylaws.pdf)
- [League document center](https://www.hvll.org/Default.aspx?tabid=1297730)
- Source SHA-256: `a6dc41245b83cd6f0ada7265dfd3d8b9a1c323f6c8a2ecc853c6761f39e14eba`
- Downloaded public source matched the supplied PDF exactly on September 29, 2026.

## Find a rule

1. Open **Rules**. The division starts with the selected team's division.
2. Search a few words such as `pitching innings`, `batting order`, or `playing time`. Use quotation marks for an exact phrase.
3. Narrow by division, document, or year. Division searches include general league sections because those may contain relevant conditions.
4. Open a result to read the entire passage and exceptions. Use **Open original document** to verify the cited PDF page and surrounding text.

Empty searches browse passages, with the selected division first. Matching words are highlighted. A missing result does not mean an activity is permitted or prohibited.

## Add another document

1. Choose **Add document** and select a PDF, UTF-8 text file, or Markdown file.
2. Enter a title, four-digit year, and applicable division. Choose **All divisions** when appropriate.
3. Choose **Read document**, review the extracted text and any missing-text warnings, then **Add to library**.
4. The original file and source passages are saved together in this browser. **Documents** opens the original or removes an import after confirmation.

PDF imports are indexed by page. Text/Markdown imports are indexed in text passages without fabricated page numbers. Limits: 20 MB and 150 PDF pages. Scanned PDFs need OCR before import; no OCR service is called. Password-protected files must be unlocked by their owner. Identical files are detected by content hash rather than overwritten.

## Local and shared storage

In the signed-out demo, imported documents are parsed locally and stored in IndexedDB. Document bytes and search text are not sent to a server. Parsing loads a PDF worker bundled with the app. Original files are exposed only as temporary local blob URLs. Clearing browser data removes imports; keep your original files. Local demo imports and coaching notes do not sync between devices.

The included league source is published with the app and available on phones and computers. New shared official sources should be checked for provenance, year, division, coverage, and extraction accuracy before they are added to the included index. User uploads are not automatically published.

## Remaining source collection

The separate Little League rulebook, any applicable fall-season or tournament supplements, and coaching practice guidelines have not yet been supplied. The 2026 source year does not itself confirm every provision applies to the demo fall season. Add those documents before calling the library complete for the Angels' actual season. Known internal source questions are retained in the source metadata and shown beside affected passages; the app does not choose an interpretation.

When a Supabase project is configured, signed-in teams use private shared libraries. Upload review identifies the selected team; both the original and extracted text are uploaded after confirmation. Existing browser imports can be shared individually from Documents. Viewers read shared documents; owners/coaches add, remove, and restore them. Documents refresh every 30 seconds/on focus. Original links are requested on click and expire after 60 seconds. Shared removal is recoverable from Removed documents. See [account setup](shared-storage-setup.md). Formal source approval/version history remains future work.

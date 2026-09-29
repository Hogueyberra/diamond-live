import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle, FileText, FolderOpen, MagnifyingGlass, Plus, Trash, UploadSimple, X } from '@phosphor-icons/react';
import { Button, Field, Modal } from './WorkspaceUI.jsx';
import corpus from './data/hvll2026.json';
import { searchGuidelines } from './guidelines.js';
import { parseGuidelineFile, listGuidelineDocuments, saveGuidelineDocument, deleteGuidelineDocument } from './guidelinesStorage.js';
import './guidelines.css';

const ALL = 'All divisions';
const PAGE_SIZE = 12;
const YEAR = '2026';
const sourceUrl = (source, page) => source?.url ? `${source.url.split('#')[0]}${page ? `#page=${page}` : ''}` : null;
const labels = (chunk) => (chunk.divisions ?? [ALL]).join(' · ');

function Highlight({ text, terms = [] }) {
  const words = [...new Set(terms)].filter(Boolean).sort((a, b) => b.length - a.length);
  if (!words.length) return text;
  const pattern = new RegExp(`(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return String(text).split(pattern).map((part, index) => words.some((word) => word.toLowerCase() === part.toLowerCase()) ? <mark key={index}>{part}</mark> : part);
}

function DocumentLink({ source, page, children = 'Open original document' }) {
  const [localUrl, setLocalUrl] = useState(null);
  useEffect(() => {
    if (!source?.blob) { setLocalUrl(null); return; }
    const url = URL.createObjectURL(source.blob);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);
  const href = sourceUrl(source, page) ?? (localUrl ? `${localUrl}${page && source.mimeType === 'application/pdf' ? `#page=${page}` : ''}` : null);
  return href ? <a className="cl-btn cl-btn--primary" href={href} target="_blank" rel="noreferrer">{children}<ArrowRight size={18} /></a> : null;
}

export function GuidelinesLibrary({ division: teamDivision = 'Minor B' }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [division, setDivision] = useState(teamDivision);
  const [sourceId, setSourceId] = useState('all');
  const [year, setYear] = useState('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [file, setFile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [importMeta, setImportMeta] = useState({ title: '', year: YEAR, division: teamDivision });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [removeId, setRemoveId] = useState(null);
  useEffect(() => {
    let active = true;
    listGuidelineDocuments().then((items) => { if (active) setDocuments(items); }).catch((reason) => { if (active) setLoadError(reason.message || 'Your imported documents could not be loaded.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => { setDivision(teamDivision); }, [teamDivision]);
  useEffect(() => { setLimit(PAGE_SIZE); }, [query, division, sourceId, year]);
  const sources = useMemo(() => [corpus.source, ...documents], [documents]);
  const chunks = useMemo(() => [...corpus.chunks, ...documents.flatMap((doc) => doc.chunks)], [documents]);
  const divisions = useMemo(() => [...new Set(chunks.flatMap((chunk) => chunk.divisions ?? []))].filter((value) => !['all', ALL].includes(value)).sort(), [chunks]);
  const years = useMemo(() => [...new Set(sources.map((source) => String(source.year)))].sort().reverse(), [sources]);
  const results = useMemo(() => searchGuidelines(chunks, query, { division: division === 'all' ? undefined : division, sourceId: sourceId === 'all' ? undefined : sourceId, year: year === 'all' ? undefined : year }), [chunks, query, division, sourceId, year]);
  const selectedSource = selected ? sources.find((source) => source.id === selected.sourceId) : null;
  const close = () => { if (!busy) { setModal(null); setDraft(null); setFile(null); setError(''); setRemoveId(null); } };
  const openUpload = () => { setError(''); setFile(null); setDraft(null); setImportMeta({ title: '', year: YEAR, division: teamDivision }); setModal('upload'); };

  async function parseFile(event) {
    event.preventDefault();
    if (!file) { setError('Choose a PDF, text, or Markdown file.'); return; }
    const metadata = importMeta;
    setBusy(true); setError(''); setProgress('Reading your document…');
    try {
      const parsed = await parseGuidelineFile(file, metadata, (value) => setProgress(typeof value === 'string' ? value : `Reading document${value?.page ? ` · page ${value.page} of ${value.total ?? '?'}` : '…'}`));
      setDraft(parsed);
    } catch (reason) { setError(reason.message || 'This document could not be read.'); }
    finally { setBusy(false); setProgress(''); }
  }
  async function saveFile() {
    setBusy(true); setError(''); setProgress('Saving in this browser…');
    try {
      await saveGuidelineDocument(draft);
      setDocuments((current) => [...current, draft]);
      setSourceId(draft.id); setDivision('all'); setYear('all'); setQuery('');
      setMessage(`${draft.title} is ready to search. This import is saved only in this browser.`);
      setModal(null); setDraft(null); setFile(null);
    } catch (reason) { setError(reason.message || 'The document could not be saved.'); }
    finally { setBusy(false); setProgress(''); }
  }
  async function removeDocument(id) {
    setBusy(true); setError('');
    try {
      await deleteGuidelineDocument(id);
      setDocuments((current) => current.filter((doc) => doc.id !== id));
      if (sourceId === id) setSourceId('all');
      setRemoveId(null); setMessage('Document removed from this browser.');
    } catch (reason) { setError(reason.message || 'The document could not be removed.'); }
    finally { setBusy(false); }
  }

  return <section className="gl-library" aria-label="Guidelines library">
    <div className="gl-intro"><div><span className="gl-source-badge"><CheckCircle size={18} />2026 HVLL bylaws included</span><p>Search the original wording. See the division, section, and source behind every result.</p></div><div className="gl-actions"><Button onClick={() => { setError(''); setModal('sources'); }}><FolderOpen size={18} />Documents <span>{sources.length}</span></Button><Button variant="primary" onClick={openUpload} disabled={loading || Boolean(loadError)}><Plus size={18} />Add document</Button></div></div>
    {loadError && <div role="alert" className="cw-alert">{loadError} The included HVLL bylaws are still searchable. Reload to retry loading your imports.</div>}
    {message && <p role="status" className="cw-success"><CheckCircle size={18} />{message}</p>}
    <div className="gl-search-panel">
      <label className="gl-search"><MagnifyingGlass size={24} /><span className="cw-sr-only">Search guidelines</span><input className="cl-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pitching, batting order, playing time…" /></label>
      <div className="gl-filters"><Field label="Division"><select className="cl-select" value={division} onChange={(event) => setDivision(event.target.value)}><option value="all">All divisions</option>{divisions.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Document"><select className="cl-select" value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="all">All documents</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}</select></Field><Field label="Year"><select className="cl-select" value={year} onChange={(event) => setYear(event.target.value)}><option value="all">All years</option>{years.map((item) => <option key={item}>{item}</option>)}</select></Field></div>
      <div className="gl-search-help"><p>{division !== 'all' ? 'Includes general league sections. Check each rule’s division and season conditions.' : 'Searches every division and general league guidance.'} Use quotes for an exact phrase.</p>{(query || division !== teamDivision || sourceId !== 'all' || year !== 'all') && <button className="cw-text-button" onClick={() => { setQuery(''); setDivision(teamDivision); setSourceId('all'); setYear('all'); }}>Reset filters<X size={15} /></button>}</div>
    </div>
    <div className="gl-results-heading"><h2>{query.trim() ? 'Search results' : 'Browse the guidelines'}</h2><p role="status">{loading ? 'Loading your documents…' : `${results.length} ${results.length === 1 ? 'reference' : 'references'}${query.trim() ? ' found' : ''}`}</p></div>
    {!results.length ? <div className="cl-card cw-empty"><MagnifyingGlass size={32} /><h3>No matching references</h3><p>Try fewer words, a different division, or all documents. The league bylaws refer to separate Little League rules that still need to be added.</p><Button onClick={() => { setQuery(''); setDivision('all'); setSourceId('all'); setYear('all'); }}>Browse all guidelines</Button></div> : <ol className="gl-results">{results.slice(0, limit).map((chunk) => {
      const source = sources.find((item) => item.id === chunk.sourceId);
      return <li key={chunk.id}><button className="gl-result" onClick={() => setSelected(chunk)}><span className="gl-result-top"><span>{labels(chunk)}</span><span>{chunk.category ?? 'Guidelines'}</span></span><h3><Highlight text={chunk.title} terms={chunk.matchTerms} /></h3><p className="gl-snippet"><Highlight text={chunk.snippet ?? chunk.text.slice(0, 240)} terms={chunk.matchTerms} /></p><span className="gl-citation"><BookOpen size={16} /><span>{source?.title} · {chunk.section ? `${chunk.section} · ` : ''}{chunk.page ? `p. ${chunk.page}` : 'Text document'} · {chunk.year}</span><ArrowRight size={20} /></span></button></li>;
    })}</ol>}
    {results.length > limit && <div className="gl-more"><Button onClick={() => setLimit((current) => current + PAGE_SIZE)}>Show more references <ArrowRight size={18} /></Button><span>Showing {Math.min(limit, results.length)} of {results.length}</span></div>}
    <aside className="gl-coverage"><BookOpen size={22} /><div><h3>Know what you’re searching</h3><p>The 2026 HVLL bylaws cover local playing rules, every listed division, league policies, tournaments, and safety. The separate Little League rulebook and later league updates are not included yet.</p><p>Results show document text, not an automatic ruling. Check the source and applicable season, including any fall or tournament supplements. Added documents stay in this browser and do not sync to other devices.</p></div></aside>

    {selected && <Modal title={selected.title} onClose={() => setSelected(null)}><div className="gl-detail-meta"><span>{labels(selected)}</span><span>{selected.category ?? 'Guidelines'}</span></div><p className="gl-detail-citation">{selectedSource?.title} · {selected.year} · {selected.section}{selected.page ? ` · page ${selected.page}` : ''}</p><div className="gl-original" tabIndex={0} role="region" aria-label="Original source passage"><Highlight text={selected.text} terms={selected.matchTerms} /></div><div className="gl-detail-footer">{selectedSource?.knownSourceQuestions?.filter((item) => item.sections.some((section) => section === selected.section || section.startsWith(`${selected.section}.`))).map((item) => <aside className="cw-evidence" key={item.sections.join()}><strong>Check related provisions</strong><p>{item.note}</p><span>{item.sections.join(" · ")}</span></aside>)}<DocumentLink source={selectedSource} page={selected.page} /><p className="cw-footnote">Extracted source text. Formatting may differ from the original. Read surrounding rules and exceptions in the document.</p></div></Modal>}
    {modal === 'sources' && <Modal title="Your guideline documents" onClose={close}>{error && <p className="cw-alert" role="alert">{error}</p>}<div className="gl-documents">{sources.map((source) => <article key={source.id} className="gl-document"><div className="gl-document-heading"><FileText size={24} /><div><h3>{source.title}</h3><p>{source.year} · {source.pageCount ?? '—'} pages · {source.id === corpus.source.id ? 'Included official source' : 'Imported · this browser only'}</p></div></div>{source.id === corpus.source.id && <p>Complete substantive text, pages 2–55. Page 1 is the table of contents. Page references use the PDF page numbers.</p>}<div className="gl-actions"><DocumentLink source={source} />{source.id !== corpus.source.id && (removeId === source.id ? <><span>Remove this import?</span><Button disabled={busy} onClick={() => removeDocument(source.id)}>Remove from this browser</Button><Button disabled={busy} onClick={() => setRemoveId(null)}>Keep document</Button></> : <Button onClick={() => setRemoveId(source.id)}><Trash size={17} />Remove</Button>)}</div></article>)}</div><p className="cw-footnote">Keep a copy of documents you import. Clearing browser data also clears your imports.</p></Modal>}
    {modal === 'upload' && <Modal title={draft ? 'Review your document' : 'Add a guideline document'} onClose={close}>{error && <p className="cw-alert" role="alert">{error}</p>}{busy && <p role="status" className="cw-success">{progress || 'Working…'}</p>}{draft ? <div className="gl-import-review"><div className="gl-document-heading"><FileText size={28} /><div><h3>{draft.title}</h3><p>{draft.year} · {draft.division} · {draft.pageCount} pages · {draft.chunks.length} searchable references</p></div></div><p>Check that the text is readable before adding it to your library.</p>{draft.warnings?.map((warning) => <p className="cw-alert" key={warning}>{warning}</p>)}<div className="gl-import-preview">{draft.chunks[0]?.text.slice(0, 1800)}</div><p className="cw-footnote">The original file and extracted text are saved in this browser only. Nothing is uploaded to a server.</p><div className="gl-actions"><Button variant="primary" disabled={busy} onClick={saveFile}>Add to library<ArrowRight size={18} /></Button><Button disabled={busy} onClick={() => { setDraft(null); setError(''); }}>Change details</Button></div></div> : <form className="cw-form" onSubmit={parseFile}><p>Import a rulebook, division supplement, or coaching guideline. PDF, text, or Markdown; up to 20 MB and 150 PDF pages.</p><Field label="Document file"><input className="cl-input gl-file" type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" required={!file} disabled={busy} onChange={(event) => { setFile(event.target.files[0] ?? null); setError(''); }} />{file && <span className="cw-footnote">Selected: {file.name}</span>}</Field><Field label="Document title"><input className="cl-input" name="title" maxLength={160} value={importMeta.title} onChange={(event) => setImportMeta({ ...importMeta, title: event.target.value })} required disabled={busy} placeholder="e.g. 2026 Minor B division supplement" /></Field><div className="cw-form-pair"><Field label="Year"><input className="cl-input" name="year" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} value={importMeta.year} onChange={(event) => setImportMeta({ ...importMeta, year: event.target.value })} required disabled={busy} /></Field><Field label="Applies to"><select className="cl-select" name="division" value={importMeta.division} onChange={(event) => setImportMeta({ ...importMeta, division: event.target.value })} disabled={busy}><option>{ALL}</option>{divisions.map((item) => <option key={item}>{item}</option>)}</select></Field></div><p className="cw-footnote">Use “All divisions” for a league-wide document. Scanned PDFs need selectable text before they can be searched.</p><Button variant="primary" type="submit" disabled={busy}><UploadSimple size={18} />Read document</Button></form>}</Modal>}
  </section>;
}

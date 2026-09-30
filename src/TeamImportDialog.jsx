import { useEffect, useMemo, useRef, useState } from 'react';
import { DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import { Button, Field, Modal } from './WorkspaceUI.jsx';
import { IMPORT_LIMIT_BYTES, ROSTER_TEMPLATE, SCHEDULE_TEMPLATE, parseRosterImport, parseScheduleImport } from './teamImport.js';
import './teamImport.css';

/** Parsing stays in the browser. Only the parent's explicit onImport callback can save data. */
export function TeamImportDialog({ kind, existingRecords = [], timeZone = 'America/Los_Angeles', onImport, onClose, busy = false, canImport = true, recovery, onPendingChange }) {
  const roster = kind === 'roster';
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewText, setPreviewText] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const fileRef = useRef(null);
  const readVersion = useRef(0);
  const submitting = useRef(false);
  const blocked = busy || saving || reading;
  const dirty = Boolean(text.trim());
  useEffect(() => { onPendingChange?.(dirty || saving); return () => onPendingChange?.(false); }, [dirty, saving, onPendingChange]);
  useEffect(() => {
    if (!dirty) return;
    const protect = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);
  useEffect(() => () => { readVersion.current += 1; }, []);
  // Rechecking against the latest records also catches items imported in another tab/device.
  const preview = useMemo(() => {
    if (previewText === null) return null;
    try { return roster ? parseRosterImport(previewText, { existingRecords }) : parseScheduleImport(previewText, { existingRecords, timeZone }); }
    catch (problem) { return { error: problem.message }; }
  }, [previewText, existingRecords, roster, timeZone]);

  function close() {
    if (blocked || submitting.current) return;
    if (dirty) setDiscard(true); else onClose();
  }
  async function readFile(file) {
    if (!file) return;
    setError(''); setPreviewText(null);
    if (file.size > IMPORT_LIMIT_BYTES) { setError('Use a file smaller than 1 MB.'); return; }
    if (!(roster ? /\.(csv|tsv|txt)$/i : /\.(csv|tsv|txt|ics)$/i).test(file.name)) { setError(roster ? 'Choose a CSV, TSV, or text file.' : 'Choose a CSV, TSV, text, or iCalendar (.ics) file.'); return; }
    const version = ++readVersion.current;
    setReading(true);
    try {
      const content = await file.text();
      if (version === readVersion.current) { setText(content); setFileName(file.name); }
    } catch { if (version === readVersion.current) setError('This file could not be read. Try saving a new copy, or paste its contents below.'); }
    finally { if (version === readVersion.current) setReading(false); }
  }
  async function importRows() {
    if (blocked || !canImport || submitting.current || !preview?.records?.length || preview.errorCount) return;
    submitting.current = true; setSaving(true); setAttempted(true); setError('');
    try {
      const saved = await onImport(preview.records);
      if (saved === false) { setError('The import was not saved. Check the workspace connection or resolve any conflicting changes, then retry.'); return; }
      onClose();
    } catch (problem) { setError(problem?.message || 'The import could not be saved. Your preview is still here; try again.'); }
    finally { submitting.current = false; setSaving(false); }
  }
  const template = roster ? ROSTER_TEMPLATE : SCHEDULE_TEMPLATE;
  return <Modal title={roster ? 'Bring in your players' : 'Bring in your schedule'} onClose={close}>
    <div className="ti-dialog">
      <p>{roster ? 'Start with your existing roster. Review the players, then add them together—ready for their first assessment.' : 'Bring games and practices into one team calendar. Review the dates and times before you add anything.'}</p>
      <details className="ti-source-help">
        <summary>Moving from GameChanger?</summary>
        {roster ? <><p>Copy player names into the box below, one per line. To include jersey numbers, use the CSV template or paste a table from a spreadsheet.</p><p>GameChanger documents a staff-only season stats CSV export. If you use that file as a starting point, copy the player names and numbers into our template and check that every rostered player is included. GameChanger stats and rankings are not imported.</p><a href="https://help.gc.com/hc/en-us/articles/360043583651-Exporting-Season-Stats" target="_blank" rel="noreferrer">GameChanger’s export instructions</a></> : <><p>In the GameChanger phone app, open your team, tap the gear, then choose <strong>Schedule Sync → Sync Schedule to Your Calendar</strong>. GameChanger provides an Apple / Google calendar route and a calendar link.</p><p>If you have saved the calendar as an <strong>.ics file</strong>, upload it here. Otherwise, use the CSV template to copy your games and practices. Calendar links cannot be pasted into this importer.</p><a href="https://help.gc.com/hc/en-us/articles/115005457626-Integrating-Your-Personal-Calendar" target="_blank" rel="noreferrer">GameChanger’s calendar instructions</a></>}
        <p className="cw-footnote">This is a one-time copy. Later changes in GameChanger do not update Diamond Live automatically.</p>
      </details>
      {recovery}
      {error && <p className="cw-alert" role="alert">{error}</p>}
      {discard ? <div className="ti-discard"><h3>{attempted ? 'Close this import preview?' : 'Discard this import preview?'}</h3><p>{attempted ? 'Your import may be in an unsynced team draft. Closing this preview does not remove pending changes. Use the workspace’s save recovery controls to retry or review the latest saved version.' : 'Your team has not been changed.'}</p><div className="ti-actions"><Button onClick={() => setDiscard(false)}>Keep reviewing</Button><Button onClick={onClose}>{attempted ? 'Close preview' : 'Discard import'}</Button></div></div> : <>
        {previewText === null ? <form className="cw-form" onSubmit={(event) => { event.preventDefault(); setError(''); setPreviewText(text); }}>
          <div className="ti-actions"><Button disabled={blocked} onClick={() => fileRef.current?.click()}><UploadSimple size={18} />Choose a file</Button><a className="ti-template" href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`} download={`diamond-live-${kind}-template.csv`}><DownloadSimple size={18} />Download CSV template</a></div>
          <input className="ti-file" ref={fileRef} type="file" aria-label={roster ? 'Roster file' : 'Schedule file'} accept={roster ? '.csv,.tsv,.txt' : '.csv,.tsv,.txt,.ics'} disabled={blocked} onChange={(event) => { readFile(event.target.files?.[0]); event.target.value = ''; }} />
          {fileName && <p className="cw-footnote">File: {fileName}</p>}
          <Field label={roster ? 'Player names or roster data' : 'Schedule data'}><textarea className="cl-textarea ti-input" rows={7} value={text} disabled={blocked} onChange={(event) => { setText(event.target.value); setFileName(''); setError(''); }} placeholder={roster ? 'Alex Example\nJordan Example\n\nOr paste columns with a Name heading.' : 'Type,Title,Date,Start Time,End Time,Location\npractice,Team practice,2027-03-02,16:30,17:30,Practice field'} /></Field>
          <p className="cw-footnote">{roster ? 'Only names are required. Optional columns: Number, Age, Positions, Notes. Player details stay in your coaches-only scouting workspace.' : `CSV needs Type, Title, Date, Start Time, End Time (or Duration in minutes), and Location. Dates: YYYY-MM-DD or M/D/YYYY. All imported times are shown in ${timeZone}. All-day, overnight, and recurring calendar entries need individual dated events.`} Up to 500 rows / 1 MB. Template names and dates are examples; replace them with your team’s details.</p>
          <Button type="submit" variant="primary" disabled={blocked || !text.trim()}>{reading ? 'Reading file…' : 'Review import'}</Button>
        </form> : <div className="ti-review">
          {preview?.error ? <p className="cw-alert" role="alert">{preview.error}</p> : <>
            <div className="ti-totals" role="status"><strong>{preview.records.length} ready to add</strong><span>{preview.duplicateCount} duplicates skipped</span><span>{preview.errorCount} rows to fix</span></div>
            {preview.warnings.map((warning) => <p className="cw-footnote" key={warning}>{warning}</p>)}
            <ol className="ti-rows" aria-label="Import preview">{preview.rows.map((row) => <li key={row.rowNumber} className={`ti-row ti-row--${row.status}`}>
              <div className="ti-row-heading"><strong>{row.label}</strong><span>{row.status === 'ready' ? 'Ready' : row.status === 'duplicate' ? 'Skipped' : 'Fix row'} · {roster ? 'Row' : 'Entry'} {row.rowNumber}</span></div>
              {row.record && <p>{roster ? [row.record.number && `#${row.record.number}`, row.record.age != null && `League age ${row.record.age}`, row.record.positions].filter(Boolean).join(' · ') || 'Name only' : `${row.record.type === 'practice' ? 'Practice' : 'Game'} · ${row.record.date} · ${row.record.startTime}–${row.record.endTime} · ${row.record.timeZone} · ${row.record.location} · ${row.record.status}`}</p>}
              {row.record?.notes && <p className="ti-note">Notes: {row.record.notes}</p>}
              {row.message && <p className={row.status === 'error' ? 'ti-row-error' : 'cw-footnote'}>{row.message}</p>}
            </li>)}</ol>
            {preview.errorCount > 0 && <p className="cw-alert">Fix the highlighted rows in your data before importing.{!attempted && ' Nothing has been saved yet.'}</p>}
            <p className="cw-footnote">This adds new {roster ? 'players' : 'events'} to the selected team. Existing records are kept. {roster ? 'Same-name players are skipped for review, including archived players.' : 'Matching events are skipped; edits and cancellations in the source do not replace saved events.'}</p>
          </>}
          <div className="ti-actions"><Button disabled={blocked} onClick={() => { setPreviewText(null); setError(''); }}>Edit data</Button><Button variant="primary" disabled={blocked || !canImport || Boolean(preview?.error) || !preview?.records?.length || preview.errorCount > 0} onClick={importRows}>{saving ? 'Importing…' : `Import ${preview?.records?.length || 0} ${roster ? 'players' : 'events'}`}</Button></div>
        </div>}
      </>}
    </div>
  </Modal>;
}

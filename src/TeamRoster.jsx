import { useEffect, useState } from 'react';
import { ArrowRight, Plus, UploadSimple, UsersThree } from '@phosphor-icons/react';
import { Button, Field, Modal } from './WorkspaceUI.jsx';
import { TeamImportDialog } from './TeamImportDialog.jsx';
import './teamSetup.css';

const emptyPlayer = { name: '', number: '', age: '', positions: '', notes: '' };

export function TeamRoster({ team, store, onEvaluate, onPendingChange }) {
  const [form, setForm] = useState(null);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [discard, setDiscard] = useState(false);
  const players = store.data?.players ?? [];
  const active = players.filter((player) => !player.archived);
  const disabled = busy || store.readOnly || store.loading;
  useEffect(() => { onPendingChange?.(Boolean(form?.dirty || importing || busy)); return () => onPendingChange?.(false); }, [form?.dirty, importing, busy, onPendingChange]);
  const close = () => { if (busy) return; if (form?.dirty) setDiscard(true); else setForm(null); };
  const change = (patch) => setForm((current) => ({ ...current, ...patch, dirty: true }));
  const open = (player) => { setError(''); setForm({ ...(player ?? emptyPlayer), age: player?.age ?? '', revision: store.revision, dirty: false }); };
  async function savePlayer(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const record = { id: form.id ?? crypto.randomUUID(), name: form.name.trim(), number: form.number.trim(), age: form.age === '' ? null : Number(form.age), positions: form.positions.trim(), notes: form.notes.trim(), archived: false, draftStatus: form.draftStatus ?? 'available' };
      if (players.some((item) => item.id !== record.id && item.name.trim().toLowerCase() === record.name.toLowerCase() && item.number === record.number)) throw new Error('That player name and number are already on your roster. Edit the existing player or use a distinguishing number.');
      await store.save((data) => ({ ...data, players: form.id ? data.players.map((item) => item.id === form.id ? record : item) : [...data.players, record] }), form.revision);
      setForm(null); setNotice(`${record.name} saved to your team roster.`);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function importPlayers(records) {
    await store.save((data) => ({ ...data, players: [...data.players, ...records.map((record) => ({ ...record, id: crypto.randomUUID() }))] }));
    setImporting(false); setNotice(`${records.length} players added. Open Scouting to create a baseline assessment.`);
  }
  const recovery = store.pending && store.status !== 'saving' ? <div className="cw-alert" role="alert"><p>{store.error || 'This roster draft has not synced.'}</p><div className="ts-actions"><Button onClick={() => store.retrySave().then(() => { setForm(null); setImporting(false); setError(''); setNotice('Roster changes saved.'); }).catch((failure) => setError(failure.message))} disabled={store.status === 'conflict'}>Retry saved draft</Button><Button onClick={store.exportData}>Download draft</Button><Button onClick={() => setDiscard(true)}>Review latest version</Button></div></div> : null;
  if (!store.data) return <section className="cl-card ts-roster"><h1 className="cl-h1">Your players.</h1>{store.error ? <><p role="alert">{store.error}</p><Button onClick={() => store.refresh()}>Try again</Button></> : <p role="status">Opening your roster…</p>}</section>;
  return <section className="ts-roster" aria-label="Team roster">
    <div className="cw-page-heading"><span className="ts-eyebrow">{team.name} · Coaches only</span><h1 className="cl-h1">Start with your players.</h1><p>One roster for assessments, development goals, and individual practice plans.</p></div>
    <div className="ts-roster-toolbar"><div className="ts-actions"><Button variant="primary" disabled={disabled} onClick={() => open()}><Plus size={18} />Add player</Button><Button disabled={disabled} onClick={() => setImporting(true)}><UploadSimple size={18} />Import roster</Button></div><Field label="Find a player"><input className="cl-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or jersey number" /></Field></div>
    {notice && <p className="cw-success" role="status">{notice}</p>}
    {store.pending && <div className="cw-alert" role="alert"><p>{store.error || 'Saving roster changes…'}</p>{store.status !== 'saving' && <div className="ts-actions"><Button onClick={() => store.retrySave().then(() => { setForm(null); setImporting(false); setError(''); }).catch((failure) => setError(failure.message))}>Retry save</Button><Button onClick={store.exportData}>Download draft</Button><Button onClick={() => setDiscard(true)}>Review latest version</Button></div>}</div>}
    {error && !form && <p className="cw-alert" role="alert">{error}</p>}
    {!active.length ? <div className="cl-card ts-empty"><UsersThree size={40} /><h2>Bring the {team.name} into Diamond Live.</h2><p>Add a player, paste a list of names, or import a roster spreadsheet. You can add jersey numbers and positions later.</p><p className="cw-footnote">Coming from GameChanger? Open Import roster for transfer instructions. This is a one-time import.</p></div> : <ul className="ts-player-list">{active.filter((player) => `${player.name} ${player.number}`.toLowerCase().includes(query.toLowerCase())).map((player) => <li className="cl-card" key={player.id}><span className="ts-jersey">{player.number || '—'}</span><div><h2>{player.name}</h2><p>{[player.age ? `Age ${player.age}` : '', player.positions].filter(Boolean).join(' · ') || 'Ready for a first assessment'}</p></div><div className="ts-actions"><Button disabled={disabled} onClick={() => open(player)}>Edit</Button><Button onClick={() => onEvaluate(player.id)}>Assess skills <ArrowRight size={17} /></Button></div></li>)}</ul>}
    {active.length > 0 && <div className="ts-next"><div><strong>Next: establish a baseline.</strong><p>Rate the skills you observe. Unobserved skills stay blank.</p></div><Button onClick={() => onEvaluate()}>Open Scouting <ArrowRight size={17} /></Button></div>}
    {form && <Modal title={form.id ? 'Edit player' : 'Add a player'} onClose={close}><form className="cw-form" onSubmit={savePlayer}>{recovery}{error && <p className="cw-alert" role="alert">{error}</p>}<Field label="Player name"><input className="cl-input" value={form.name} onChange={(event) => change({ name: event.target.value })} maxLength={80} required /></Field><div className="cw-form-pair"><Field label="Jersey / evaluation number (optional)"><input className="cl-input" value={form.number} onChange={(event) => change({ number: event.target.value })} maxLength={12} /></Field><Field label="Age (optional)"><input className="cl-input" type="number" min={5} max={18} value={form.age} onChange={(event) => change({ age: event.target.value })} /></Field></div><Field label="Positions (optional)"><input className="cl-input" value={form.positions} onChange={(event) => change({ positions: event.target.value })} maxLength={80} /></Field><Field label="Coach notes (optional)"><textarea className="cl-textarea" value={form.notes} onChange={(event) => change({ notes: event.target.value })} maxLength={1000} /></Field><Button variant="primary" type="submit" disabled={disabled}>{busy ? 'Saving…' : 'Save player'}</Button></form></Modal>}
    {importing && <TeamImportDialog kind="roster" existingRecords={players} onImport={importPlayers} onClose={() => { if (!busy) setImporting(false); }} busy={busy || store.status === 'saving'} canImport={!disabled} recovery={recovery} />}
    {discard && <Modal title={store.pending ? 'Review your roster draft' : 'Discard player changes?'} onClose={() => setDiscard(false)}><p>{store.pending ? 'Download your draft first if you need a copy. Loading the latest version replaces changes that have not synced.' : 'Your changes to this player have not been saved.'}</p><div className="ts-actions">{store.pending && <Button onClick={store.exportData}>Download draft</Button>}<Button onClick={async () => { try { if (store.pending) await store.loadLatest(); setForm(null); setImporting(false); setDiscard(false); setError(''); } catch (failure) { setError(failure.message); } }}>{store.pending ? 'Replace with latest version' : 'Discard changes'}</Button><Button variant="primary" onClick={() => setDiscard(false)}>Keep editing</Button></div></Modal>}
  </section>;
}

export function TeamSetup({ players, events, evaluations, activities, loading, onPlayers, onSchedule, onAssess, onPlan }) {
  const active = players.filter((player) => !player.archived);
  const assessed = new Set(evaluations.filter((item) => active.some((player) => player.id === item.playerId) && Object.values(item.ratings).some((rating) => rating !== null)).map((item) => item.playerId)).size;
  const steps = [
    { title: 'Add your players', detail: active.length ? `${active.length} players on your roster` : 'Add names or import your existing roster.', done: active.length > 0, action: onPlayers, button: active.length ? 'Manage players' : 'Add / import players' },
    { title: 'Bring in your schedule', detail: events.length ? `${events.length} games and practices` : 'Import a calendar or add your first event.', done: events.length > 0, action: onSchedule, button: events.length ? 'Open schedule' : 'Add / import schedule' },
    { title: 'Assess their skills', detail: assessed ? `${assessed} of ${active.length} players assessed` : 'Set a starting point with 1–10 skill ratings.', done: active.length > 0 && assessed === active.length, action: onAssess, button: 'Open assessments' },
    { title: 'Build your first practice', detail: activities.length ? `${activities.length} approved drill blocks` : 'Review suggestions, choose drills, assign coaches.', done: activities.length > 0, action: onPlan, button: 'Plan a practice' },
  ];
  const complete = steps.filter((step) => step.done).length;
  if (loading) return <section className="cl-card ts-setup"><p role="status">Checking your team setup…</p></section>;
  return <section className="cl-card ts-setup" aria-label="Team setup"><div className="ts-setup-heading"><div><span className="ts-eyebrow">YOUR NEXT STEPS</span><h2>{complete === 4 ? 'Your team is taking shape.' : 'Make this your team.'}</h2><p>Players first. Then the schedule, the skills, and a plan.</p></div><span className="ts-progress">{complete}/4 ready</span></div><ol className="ts-steps">{steps.map((step, index) => <li key={step.title} className={step.done ? 'is-done' : ''}><span className="ts-step-number">{step.done ? '✓' : `0${index + 1}`}</span><h3>{step.title}</h3><p>{step.detail}</p><button onClick={step.action}>{step.button}<ArrowRight size={16} /></button></li>)}</ol></section>;
}

import { useEffect, useState } from 'react';
import { Button, Field, Modal } from '../WorkspaceUI.jsx';
import { PracticePlanner } from '../PracticePlanner.jsx';
import { TeamImportDialog } from '../TeamImportDialog.jsx';
import { listPracticeStaff } from '../practiceStaff.js';
import { supabase } from '../supabaseClient.js';
import { mergePracticeActivities } from '../practicePlanning.js';
import { validateCoachingData } from '../coachingStore.js';
import TeamSaveRecovery from './TeamSaveRecovery.jsx';
import { localDate, dateLabel } from './livePractice.js';

export default function TeamCalendar({ team, store, scouting, user, authorName, onPendingChange, onAssistant }) {
  const [modal, setModal] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [staff, setStaff] = useState([]);
  const [staffError, setStaffError] = useState('');
  const [staffAttempt, setStaffAttempt] = useState(0);
  const owner = team.role === 'owner';
  const canCoach = ['owner', 'coach'].includes(team.role);
  const locked = busy || store.readOnly || store.pending;
  const events = store.data.events.filter((item) => item.teamId === team.id && item.seasonId === team.seasonId).sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
  const activeEvent = events.find((item) => item.id === modal?.eventId);
  useEffect(() => { onPendingChange(busy || dirty || modal?.type === 'import'); return () => onPendingChange(false); }, [busy, dirty, modal?.type, onPendingChange]);
  useEffect(() => {
    if (!canCoach) return;
    let live = true;
    listPracticeStaff(supabase, team.id).then((members) => { if (live) { setStaff(members); setStaffError(''); } }).catch((reason) => { if (live) setStaffError(reason.message); });
    return () => { live = false; };
  }, [team.id, canCoach, staffAttempt]);
  const open = (type, eventId) => { setError(''); setDirty(false); setModal({ type, eventId, revision: store.revision }); };
  const close = () => {
    if (busy || store.pending) { setError('Wait for this save or resolve the unsynced changes before closing.'); return; }
    if (dirty && !window.confirm('Discard the unsaved changes in this practice form?')) return;
    setModal(null); setDirty(false); setError('');
  };
  async function saveEvent(event) {
    event.preventDefault(); setBusy(true); setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const record = { ...values, title: values.title.trim(), location: values.location.trim(), id: crypto.randomUUID(), teamId: team.id, seasonId: team.seasonId, status: 'scheduled', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...(values.type === 'practice' ? { planStatus: 'draft' } : {}) };
    try {
      await store.save((current) => { const next = { ...current, events: [...current.events, record] }; validateCoachingData(next); return next; }, modal.revision);
      setModal(null); setDirty(false); setMessage('Added to your shared team calendar.');
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  async function savePractice(activities, nextEvent) {
    const saved = await store.save((current) => ({ ...current, events: current.events.map((item) => item.id === nextEvent.id ? nextEvent : item), activities: mergePracticeActivities(current.activities, activities, nextEvent.id, team.id) }), modal.revision);
    setModal((current) => current ? { ...current, revision: saved.revision } : current);
  }
  return <section className="tc-calendar">
    <div className="tc-heading"><div><span className="tc-eyebrow">{team.name} · Shared calendar</span><h1>Make every practice count.</h1><p>Plan together, assign stations, and record what worked.</p></div><div className="tc-actions">{canCoach && <Button onClick={onAssistant}>Build a practice with the assistant</Button>}{owner && <><Button disabled={locked} onClick={() => open('import')}>Import schedule</Button><Button variant="primary" disabled={locked} onClick={() => open('create')}>Add event</Button></>}</div></div>
    {message && <p role="status" className="cw-success">{message}</p>}
    {!events.length && <div className="tc-empty"><h2>Your calendar is ready.</h2><p>{owner ? 'Add a practice or import your schedule. Saved plans will appear here for your team.' : 'Your team owner can add the schedule and approve practice plans here.'}</p></div>}
    <div className="tc-event-list">{events.map((event) => <article className="tc-event" key={event.id}><div><span className="tc-eyebrow">{dateLabel(event.date)} · {event.status}</span><h2>{event.title}</h2><p>{event.startTime}–{event.endTime} · {event.location}</p><small>{event.type === 'practice' ? `${event.planStatus === 'released' ? 'Released plan' : 'Draft plan'} · ${store.data.activities.filter((item) => item.eventId === event.id).length} blocks` : 'Team game'}</small></div><Button onClick={() => open('details', event.id)}>{event.type === 'practice' ? 'Open practice plan' : 'View event'}</Button></article>)}</div>
    {modal?.type === 'import' && <TeamImportDialog kind="schedule" team={team} existingRecords={events} busy={locked} canImport={owner && !locked} recovery={<TeamSaveRecovery store={store} onRecovered={() => { setModal(null); setDirty(false); }} />} onClose={close} onImport={async (records) => { await store.save((current) => ({ ...current, events: [...current.events, ...records.map((record) => ({ ...record, id: crypto.randomUUID(), teamId: team.id, seasonId: team.seasonId }))] }), modal.revision); setModal(null); setMessage('Schedule imported into your team calendar.'); }} />}
    {modal?.type === 'create' && <Modal title="Add to your team calendar" onClose={close}><TeamSaveRecovery store={store} onRecovered={() => { setModal(null); setDirty(false); }} /><form className="cw-form" onSubmit={saveEvent} onChange={() => setDirty(true)}><Field label="Event name"><input className="cl-input" name="title" required maxLength={120} disabled={locked} /></Field><div className="cw-form-pair"><Field label="Type"><select className="cl-select" name="type" disabled={locked}><option value="practice">Practice</option><option value="game">Game</option></select></Field><Field label="Date"><input className="cl-input" type="date" name="date" defaultValue={localDate()} required disabled={locked} /></Field></div><div className="cw-form-pair"><Field label="Start time"><input className="cl-input" type="time" name="startTime" defaultValue="17:00" required disabled={locked} /></Field><Field label="End time"><input className="cl-input" type="time" name="endTime" defaultValue="18:00" required disabled={locked} /></Field></div><Field label="Location"><input className="cl-input" name="location" maxLength={200} required disabled={locked} /></Field><Field label="Team notes"><textarea className="cl-input" name="notes" maxLength={4000} disabled={locked} /></Field>{error && <p role="alert">{error}</p>}<Button variant="primary" type="submit" disabled={locked}>{busy ? 'Saving…' : 'Save event'}</Button></form></Modal>}
    {modal?.type === 'details' && activeEvent && <Modal title={activeEvent.title} onClose={close}><TeamSaveRecovery store={store} onRecovered={() => { setModal(null); setDirty(false); }} /><p>{dateLabel(activeEvent.date)} · {activeEvent.startTime}–{activeEvent.endTime} · {activeEvent.location}</p>{activeEvent.type === 'practice' && <>{staffError && <p role="alert">{staffError} <Button onClick={() => setStaffAttempt((n) => n + 1)}>Retry staff list</Button></p>}<PracticePlanner event={activeEvent} activities={store.data.activities.filter((item) => item.eventId === activeEvent.id)} scoutingData={canCoach && !scouting.pending && !scouting.error ? scouting.data : null} members={staff} currentUserId={user.id} currentUserName={authorName} isManager={owner} canCoach={canCoach} disabled={locked} onChange={savePractice} onPendingChange={setDirty} /></>}{activeEvent.notes && <details className="tc-parent-notes"><summary>Team notes and parent instructions</summary><p>{activeEvent.notes}</p><Button onClick={async () => { try { await navigator.clipboard.writeText(activeEvent.notes); setMessage('Notes copied. Review before sharing with families.'); } catch { setError('Select the notes above to copy them.'); } }}>Copy notes</Button></details>}{error && <p role="alert">{error}</p>}</Modal>}
  </section>;
}

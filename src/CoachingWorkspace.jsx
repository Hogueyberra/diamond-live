import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Button, Modal, Field } from './WorkspaceUI.jsx';
import { Link } from 'react-router';
import { DownloadSimple as ArrowDownToLine, ArrowRight, BookOpen, CalendarDots as CalendarDays, Check, CheckCircle as CheckCircle2, CaretDown as ChevronDown, Clock as Clock3, Diamond, SquaresFour as LayoutDashboard, MapPin, Plus, MagnifyingGlass as Search, Target, UsersThree, UploadSimple, X } from '@phosphor-icons/react';
import { COACHING_RULES } from './coachingRules.js';
import { useScouting } from './useScouting.js';
import { DEMO_SCOUTING_AUTHOR_ID } from './scouting.js';
import { TeamRoster, TeamSetup } from './TeamRoster.jsx';
import { TeamImportDialog } from './TeamImportDialog.jsx';
import { PracticePlanner } from './PracticePlanner.jsx';
import { listPracticeStaff } from './practiceStaff.js';
import { supabase } from './supabaseClient.js';
import { validateCoachingData } from './coachingStore.js';
import { canAddPracticeBlock, mergePracticeActivities } from './practicePlanning.js';
const GuidelinesLibrary = lazy(() => import('./GuidelinesLibrary.jsx').then((module) => ({ default: module.GuidelinesLibrary })));

const ScoutingWorkspace = lazy(() => import('./ScoutingWorkspace.jsx').then((module) => ({ default: module.ScoutingWorkspace })));

const VIEWS = [['home', 'Overview', LayoutDashboard], ['players', 'Players', UsersThree], ['schedule', 'Schedule', CalendarDays], ['coaching', 'Coaching', Target], ['rules', 'Rules', BookOpen], ['scouting', 'Scouting', Diamond]];
const uid = () => crypto.randomUUID();
const dateLabel = (date, options = { weekday: 'short', month: 'short', day: 'numeric' }) => new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const timeLabel = (time) => { const [hour, minute] = time.split(':').map(Number); return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`; };
const sortEvents = (a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`);

export function CoachingWorkspace({ store, accountButton, syncBar, guidelinesRepository, authorName = 'Coach', authorId, scoutingRepository, canScout = true, onScoutingPendingChange, onHome, teamRole = 'owner' }) {
  const { data, setData, saveError, loadError, retrySave, exportData } = store;
  const [teamId, setTeamId] = useState('angels-demo');
  const [requestedView, setView] = useState('home');
  const view = ['scouting', 'players'].includes(requestedView) && !canScout ? 'home' : requestedView;
  const [scoutingVisited, setScoutingVisited] = useState(false);
  const [scoutingPending, setScoutingPending] = useState(false);
  const scoutingChange = useCallback((pending) => setScoutingPending(pending), []);
  const [rosterPending, setRosterPending] = useState(false);
  const [practicePending, setPracticePending] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [playerRequest, setPlayerRequest] = useState(null);
  const [staff, setStaff] = useState([]);
  const [staffError, setStaffError] = useState('');
  const [staffAttempt, setStaffAttempt] = useState(0);
  const isCloud = store.mode === 'cloud';
  const isManager = !isCloud || teamRole === 'owner';
  const actorId = isCloud ? authorId : DEMO_SCOUTING_AUTHOR_ID;
  const [eventFilter, setEventFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const team = data.teams.find((item) => item.id === teamId) ?? data.teams[0];
  const scouting = useScouting({ repository: canScout ? scoutingRepository : null, scopeKey: canScout ? team.id : null, demo: canScout && !isCloud, authorId: canScout ? actorId : null });
  useEffect(() => { onScoutingPendingChange?.(scoutingPending || rosterPending || scouting.pending || practicePending || modal?.kind === 'importSchedule'); return () => onScoutingPendingChange?.(false); }, [scoutingPending, rosterPending, scouting.pending, practicePending, modal?.kind, onScoutingPendingChange]);
  useEffect(() => {
    if (!scoutingPending && !rosterPending && !practicePending) return;
    const protect = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [scoutingPending, rosterPending, practicePending]);
  useEffect(() => {
    let live = true; setStaffError('');
    if (!isCloud) { setStaff([{ userId: DEMO_SCOUTING_AUTHOR_ID, displayName: 'Sample Coach', role: 'owner' }]); return; }
    setStaff([]);
    listPracticeStaff(supabase, team.id).then((members) => { if (live) setStaff(members); }).catch((error) => { if (live) setStaffError(error.message); });
    return () => { live = false; };
  }, [isCloud, team.id, authorId, staffAttempt]);
  const scoped = (item) => item.teamId === team.id && item.seasonId === team.seasonId;
  const events = data.events.filter(scoped).sort(sortEvents);
  const practices = events.filter((item) => item.type === 'practice');
  const observations = data.observations.filter(scoped);
  const activities = data.activities.filter(scoped);
  const currentDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const nextPractice = practices.find((item) => !['completed', 'cancelled'].includes(item.status) && item.date >= currentDate);
  const nextActivities = activities.filter((item) => item.eventId === nextPractice?.id);
  const totalMinutes = nextActivities.reduce((sum, item) => sum + item.minutes, 0);
  const openNotes = observations.filter((item) => item.status === 'open');
  const show = (kind, item = null) => { setFormError(''); setModal({ kind, item, baseRevision: store.revision }); };
  const close = () => { if (store.status === 'saving') { setFormError('Wait for the save to finish or resolve unsynced changes before closing.'); return; } if (practicePending) { setConfirmClose(true); return; } setModal(null); };
  const navigate = (next) => { if (scoutingPending || rosterPending) { setMessage('Finish or discard the open player form before leaving this section.'); return; } if (next === 'scouting') setScoutingVisited(true); setView(next); setMessage(''); setQuery(''); };
  const assessPlayer = (id) => { setPlayerRequest(id ? { id, request: uid() } : null); navigate('scouting'); };
  const planPractice = (playerId) => { const practice = nextPractice; if (practice) { show('details', practice); setModal((current) => ({ ...current, playerId })); } else { show('event'); setMessage('Add a practice, then open its plan to review suggested drills.'); } };
  const saveTeam = async (updater, revision) => { if (store.save) return store.save(updater, revision); const accepted = setData(updater); if (accepted === false) throw new Error('This team is not available for editing.'); return {}; };
  const savePractice = async (nextActivities, nextEvent) => {
    const result = await saveTeam((current) => ({ ...current, events: current.events.map((item) => item.id === nextEvent.id ? nextEvent : item), activities: mergePracticeActivities(current.activities, nextActivities.map((item) => ({ ...item, teamId: team.id, seasonId: team.seasonId, eventId: nextEvent.id })), nextEvent.id, team.id) }), modal.baseRevision);
    setModal((current) => current ? { ...current, item: nextEvent, baseRevision: result.revision } : current);
  };
  const importSchedule = async (records) => { await saveTeam((current) => ({ ...current, events: [...current.events, ...records.map((record) => ({ ...record, ...context, id: uid() }))] }), modal.baseRevision); setModal(null); setMessage(`${records.length} events imported into your team schedule.`); };
  const recovery = store.pending && store.status !== 'saving' ? <div className="cw-alert" role="alert"><p>{saveError || 'This team draft has not synced.'}</p><div className="ts-actions"><Button disabled={store.status === 'conflict'} onClick={retrySave}>Retry saved draft</Button><Button onClick={exportData}>Download draft</Button><Button onClick={() => { close(); setMessage('Review unsynced changes in the team status bar before continuing.'); }}>Close to review sync</Button></div></div> : null;
  const activeEvent = modal?.kind === 'details' ? events.find((item) => item.id === modal.item.id) ?? modal.item : null;
  const save = (updater, text) => { try { validateCoachingData(updater(data)); if (setData(updater) === false) throw new Error('This team is not available for editing.'); setMessage(text); close(); } catch (error) { setFormError(error.message); } };
  const context = { teamId: team.id, seasonId: team.seasonId };
  const disabled = Boolean(loadError) || store.readOnly;

  const submitEvent = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!values.title.trim() || !values.location.trim()) return setFormError('Add an event name and location.');
    if (values.endTime <= values.startTime) return setFormError('The end time must be after the start time.');
    const item = { ...values, title: values.title.trim(), location: values.location.trim(), ...context, id: uid(), timeZone: 'America/Los_Angeles', status: 'scheduled' };
    save((current) => ({ ...current, events: [...current.events, item] }), `${item.type === 'practice' ? 'Practice' : 'Game'} added to ${team.name}' schedule.`);
  };
  const submitObservation = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!values.title.trim() || !values.note.trim()) return setFormError('Add a title and the observation you want to work on.');
    const item = { ...values, title: values.title.trim(), note: values.note.trim(), ...context, id: uid(), author: authorName, ...(authorId ? { authorId } : {}), createdAt: new Date().toISOString(), source: 'Coach observation', status: 'open' };
    save((current) => ({ ...current, observations: [item, ...current.observations] }), 'Observation saved. Review it and choose a practice action.');
  };
  const submitActivity = (event) => {
    event.preventDefault();
    if (!isManager) return setFormError('Your team manager approves the practice plan.');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!practices.some((item) => item.id === values.eventId)) return setFormError('Choose a practice for this team.');
    if (![values.title, values.objective, values.measure].every((value) => value.trim())) return setFormError('Add an activity, objective, and success measure.');
    if (!canAddPracticeBlock(practices.find((item) => item.id === values.eventId), activities.filter((item) => item.eventId === values.eventId), Number(values.minutes))) return setFormError('This activity does not fit in the practice. Shorten the activity or adjust the plan first.');
    const item = { ...values, ...context, id: uid(), observationId: modal.item?.id, minutes: Number(values.minutes), completed: false };
    save((current) => ({ ...current, activities: [...current.activities, item], observations: current.observations.map((note) => note.id === modal.item?.id && scoped(note) ? { ...note, status: 'planned' } : note) }), 'Takeaway reviewed and added to your practice plan.');
  };

  function EventList() {
    const visible = events.filter((item) => eventFilter === 'all' || item.type === eventFilter);
    return <section className="cl-card cw-agenda" aria-labelledby="schedule-title">
      <div className="cw-section-heading"><div><h2 id="schedule-title" className="cl-h3">Coming up</h2><p>Time to learn. Time to play.</p></div><div className="ts-actions"><Button onClick={() => show('importSchedule')} disabled={disabled}><UploadSimple size={17} />Import schedule</Button><Button onClick={() => show('event')} disabled={disabled}><Plus size={17} /> Add event</Button></div></div>
      <div className="cl-tabs cw-filters" aria-label="Filter events">{[['all', 'All events'], ['practice', 'Practices'], ['game', 'Games']].map(([value, label]) => <button key={value} className={`cl-tab ${eventFilter === value ? 'is-active' : ''}`} aria-pressed={eventFilter === value} onClick={() => setEventFilter(value)}>{label}</button>)}</div>
      {visible.length ? <ul className="cw-event-list">{visible.map((item) => <li key={item.id}>
        <div className="cw-date"><span>{dateLabel(item.date, { month: 'short' })}</span><strong>{dateLabel(item.date, { day: '2-digit' })}</strong></div>
        <div className="cw-event-main"><div className="cw-event-type">{item.type === 'practice' ? <Target size={14} /> : <Diamond size={14} />}{item.type === 'practice' ? 'Practice' : 'Game'}</div><h3>{item.title}</h3><p>{dateLabel(item.date, { weekday: 'long' })} · {timeLabel(item.startTime)} PT</p><span className="cw-location"><MapPin size={14} />{item.location}</span></div>
        <button className="cw-arrow" aria-label={`View ${item.title}`} onClick={() => show('details', item)}><ArrowRight size={20} /></button>
      </li>)}</ul> : <div className="cw-empty"><CalendarDays size={28} /><h3>No {eventFilter === 'all' ? 'events' : `${eventFilter}s`} yet</h3><p>Add a game or practice for {team.name}.</p></div>}
      <p className="cw-footnote">All event times: Pacific · America/Los_Angeles</p>
    </section>;
  }

  function Notes({ compact = false }) {
    const list = compact ? openNotes.slice(0, 2) : observations;
    return <section className="cl-card cw-notes" aria-labelledby="notes-title">
      <div className="cw-section-heading"><div><h2 id="notes-title" className="cl-h3">Coaching priorities</h2><p>Small observations. Useful next steps.</p></div>{!compact && <Button onClick={() => show('observation')} disabled={disabled}><Plus size={17} /> Add note</Button>}</div>
      {list.length ? <ul className="cw-note-list">{list.map((note) => <li key={note.id}><span className="cw-note-source"><Target size={15} />{note.source}</span><h3>{note.title}</h3><p>{note.note}</p>{note.status === 'open' ? <button className="cw-text-button" disabled={disabled || !isManager} onClick={() => show('activity', note)}>Review & plan <ArrowRight size={16} /></button> : <span className="cw-planned"><CheckCircle2 size={16} />Added to practice</span>}</li>)}</ul> : <div className="cw-empty"><CheckCircle2 size={28} /><h3>{observations.length ? 'Every priority has a plan' : 'Start with an observation'}</h3><p>Capture something you noticed, then turn it into a practice activity.</p></div>}
      {compact && <button className="cw-text-button cw-card-link" onClick={() => navigate('coaching')}>All coaching notes <ArrowRight size={16} /></button>}
    </section>;
  }

  function Rules({ compact = false }) {
    const matches = COACHING_RULES.filter((rule) => `${rule.title} ${rule.summary}`.toLowerCase().includes(query.toLowerCase()));
    return <section className="cl-card cw-rules" aria-labelledby="rules-title"><div className="cw-section-heading"><div><h2 id="rules-title" className="cl-h3">Know your division</h2><p>HVLL · Minor B · 2026 bylaws</p></div>{compact && <Button onClick={() => navigate('rules')}>View rules <ArrowRight size={16} /></Button>}</div>
      {!compact && <label className="cw-search"><Search size={18} /><span className="cw-sr-only">Search division rules</span><input className="cl-input" placeholder="Search division rules" value={query} onChange={(e) => setQuery(e.target.value)} /></label>}
      <div className="cw-rule-grid">{matches.map((rule) => <button key={rule.id} className="cw-rule" onClick={() => show('rule', rule)}><BookOpen size={19} /><strong>{rule.title}</strong><span>{rule.section} · p. {rule.page}</span><ArrowRight className="cw-rule-arrow" size={17} /></button>)}</div>
      {!matches.length && <p className="cw-empty">No matching rules. Try “batting” or “pitching.”</p>}
      <p className="cw-footnote">Source checked · Coach review pending. These references cover selected rules.</p>
    </section>;
  }

  return <div className="coaching-workspace">
    <a className="cw-skip" href="#coaching-main">Skip to workspace</a>
    <header className="cw-header"><div className="cw-nav-shell"><Link to="/" className="cw-brand" onClick={onHome ?? (() => navigate('home'))}><Diamond size={23} weight="bold" /><span>Diamond Live</span></Link><nav aria-label="Coaching workspace">{VIEWS.filter(([key]) => !['scouting', 'players'].includes(key) || canScout).map(([key, label, Icon]) => <button key={key} aria-current={view === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={16} />{label}</button>)}</nav></div><div className="cw-team-select"><label className="cw-sr-only" htmlFor="team-select">Team and season</label><select id="team-select" value={team.id} onChange={(e) => { if (scoutingPending || rosterPending || scouting.pending || practicePending || store.pending || modal) { setMessage('Finish the open form and resolve pending saves before switching teams.'); return; } setTeamId(e.target.value); setMessage(''); }} aria-label="Team and season">{data.teams.map((item) => <option value={item.id} key={item.id}>{item.name}{store.mode === 'cloud' ? '' : ' · Demo'}</option>)}</select><ChevronDown size={16} /></div>{accountButton}</header>
    <div className="cw-context"><span>{team.league} <span className="cw-context-divider">/</span> {team.division}</span><span>{team.season}</span></div>
    <main id="coaching-main" tabIndex={-1}>
      {syncBar}
      {loadError && <div role="alert" className="cw-alert">{loadError} Saved data is protected; editing is paused.</div>}
      {saveError && <div role="alert" className="cw-alert">{saveError} Keep this page open to retain your changes.{store.status !== 'conflict' && <Button onClick={retrySave}>Retry saving</Button>}<Button onClick={exportData}>Download backup</Button></div>}
      {message && <p role="status" className="cw-success"><CheckCircle2 size={18} />{message}</p>}
      {view === 'home' ? <>
        {canScout && <TeamSetup players={scouting.data?.players ?? []} events={events} evaluations={scouting.data?.evaluations ?? []} activities={activities} loading={scouting.loading} onPlayers={() => navigate('players')} onSchedule={() => navigate('schedule')} onAssess={() => navigate('scouting')} onPlan={() => planPractice()} />}
        <section className="cw-hero"><div className="cw-hero-main"><h1>This week with<br /><span>the {team.name}.</span></h1><p>A little preparation. A better day on the field.</p><Button variant="primary" disabled={disabled} onClick={() => show('observation')}><Plus size={18} /> Add a coaching note</Button></div><div className="cw-next"><span className="cw-next-label"><CalendarDays size={17} />Next practice</span><h2>{nextPractice ? dateLabel(nextPractice.date) : 'Your next session'}</h2><p>{nextPractice ? `${timeLabel(nextPractice.startTime)} – ${timeLabel(nextPractice.endTime)} PT` : 'Build a plan for your team.'}</p><button className="cw-hero-link" onClick={() => show(nextPractice ? 'details' : 'event', nextPractice)} disabled={disabled && !nextPractice}>{nextPractice ? 'Open practice plan' : 'Schedule a practice'}<ArrowRight size={19} /></button></div></section>
        <div className="cw-metrics"><div><span>On the calendar</span><strong>{String(events.length).padStart(2, '0')}</strong><small>{practices.length} practices · {events.length - practices.length} {events.length - practices.length === 1 ? 'game' : 'games'}</small></div><div><span>Open coaching priorities</span><strong>{String(openNotes.length).padStart(2, '0')}</strong><small>Ready for a next step</small></div><div><span>Next practice planned</span><strong>{totalMinutes}<em> min</em></strong><small>{nextActivities.length} activities in the plan</small></div><div><span>Guidelines library</span><strong>55<em> pages</em></strong><small>2026 HVLL bylaws · searchable</small></div></div>
        <div className="cw-main-grid">{EventList()}{Notes({ compact: true })}</div>{Rules({ compact: true })}
      </> : view === 'players' ? <TeamRoster key={`${actorId}:${team.id}`} team={team} store={scouting} onEvaluate={assessPlayer} onPendingChange={setRosterPending} /> : view !== 'scouting' ? <><div className="cw-page-heading"><h1 className="cl-h1">{view === 'schedule' ? 'Make room for progress.' : view === 'coaching' ? 'Turn observations into action.' : 'The rules, within reach.'}</h1><p>{team.name} · {view === 'schedule' ? 'Practices and games in one place.' : view === 'coaching' ? 'Review a takeaway, plan the reps, and record how they went.' : 'Find the source. Read the rule. Prepare your team.'}</p></div>{view === 'schedule' ? EventList() : view === 'coaching' ? Notes({}) : <Suspense fallback={<p role="status">Opening the guidelines library…</p>}><GuidelinesLibrary key={guidelinesRepository?.scopeKey ?? 'local'} division={team.division} repository={guidelinesRepository ?? undefined} /></Suspense>}</> : null}
      {scoutingVisited && canScout && <div hidden={view !== 'scouting'}><Suspense fallback={<p role="status">Opening scouting…</p>}><ScoutingWorkspace key={`${authorId ?? 'demo'}:${team.id}`} team={team} repository={scoutingRepository} authorName={authorName} authorId={authorId} onPendingChange={scoutingChange} store={scouting} playerRequest={playerRequest} onPlanPractice={planPractice} /></Suspense></div>}
    </main>
    <footer className="cw-footer"><span>{store.mode === 'cloud' ? 'Private team workspace' : 'Demo workspace · Sample events and notes'} · {loadError ? 'Editing paused' : saveError ? 'Changes not saved' : store.mode === 'cloud' ? (store.pending ? 'Saving changes…' : 'Shared with team members') : 'Stored on this device'}</span><div><button className="cw-text-button" onClick={exportData}><ArrowDownToLine size={15} />Backup</button><Link to="/demo" onClick={(event) => { if (scoutingPending || rosterPending || scouting.pending || practicePending || store.pending) { event.preventDefault(); setMessage('Finish open forms and resolve unsaved roster, scouting, or practice changes before opening the scoring demo.'); document.getElementById('coaching-main')?.focus(); } }}>Open Hawks scoring demo <ArrowRight size={15} /></Link></div></footer>
    {confirmClose && <Modal title="Discard unsaved practice changes?" onClose={() => setConfirmClose(false)}><p>The drill review or unsaved duration and outcome edits will be discarded. Saved practice blocks stay in the plan.</p><div className="ts-actions"><Button onClick={() => { setConfirmClose(false); setPracticePending(false); setModal(null); }}>Discard practice edits</Button><Button variant="primary" onClick={() => setConfirmClose(false)}>Keep planning</Button></div></Modal>}
    {modal?.kind === 'importSchedule' && <TeamImportDialog kind="schedule" existingRecords={events} timeZone="America/Los_Angeles" onImport={importSchedule} onClose={close} busy={store.status === 'saving'} canImport={!disabled && !store.pending} recovery={recovery} />}
    {modal && modal.kind !== 'importSchedule' && <Modal title={{ event: 'Add an event', observation: 'Capture a coaching note', activity: 'Review & plan a practice activity', details: modal.item?.title, rule: modal.item?.title }[modal.kind]} onClose={close}>
      {recovery}
      {formError && <p role="alert" className="cw-alert">{formError}</p>}
      {modal.kind === 'event' && <form onSubmit={submitEvent} className="cw-form"><div className="cw-form-pair"><Field label="Event type"><select className="cl-select" name="type"><option value="practice">Practice</option><option value="game">Game</option></select></Field><Field label="Date"><input className="cl-input" name="date" type="date" defaultValue={new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())} required /></Field></div><Field label="Event name"><input className="cl-input" name="title" maxLength={100} placeholder="Practice focus or game matchup" required /></Field><div className="cw-form-pair"><Field label="Start time (Pacific)"><input className="cl-input" name="startTime" type="time" defaultValue="16:30" required /></Field><Field label="End time (Pacific)"><input className="cl-input" name="endTime" type="time" defaultValue="17:30" required /></Field></div><Field label="Location"><input className="cl-input" name="location" maxLength={120} required /></Field><Field label="Preparation notes"><textarea className="cl-textarea" name="notes" maxLength={1500} /></Field><p className="cw-footnote">For {team.name} · {team.season} · America/Los_Angeles</p><Button type="submit" variant="primary" disabled={disabled}>Save event</Button></form>}
      {modal.kind === 'observation' && <form onSubmit={submitObservation} className="cw-form"><p>What did you notice, and what could the team practice next?</p><Field label="Coaching priority"><input className="cl-input" name="title" maxLength={100} required /></Field><Field label="Observation"><textarea className="cl-textarea" name="note" maxLength={2000} required /></Field><p className="cw-footnote">Saved as your observation for {team.name}. Review it before adding it to a practice.</p><Button type="submit" variant="primary" disabled={disabled}>Save observation</Button></form>}
      {modal.kind === 'activity' && <form onSubmit={submitActivity} className="cw-form"><div className="cw-evidence"><strong>Supporting observation</strong><p>{modal.item.note}</p><span>{modal.item.source} · {modal.item.author}</span></div>{practices.length ? <><Field label="Practice"><select className="cl-select" name="eventId">{practices.map((item) => <option key={item.id} value={item.id}>{dateLabel(item.date)} · {item.title}</option>)}</select></Field><Field label="Activity name"><input className="cl-input" name="title" defaultValue={modal.item.title} maxLength={100} required /></Field><Field label="Minutes"><input className="cl-input" type="number" name="minutes" min="1" max="120" defaultValue="10" required /></Field><Field label="Practice objective"><textarea className="cl-textarea" name="objective" maxLength={1000} required /></Field><Field label="What would progress look like?"><input className="cl-input" name="measure" maxLength={250} required /></Field><Button variant="primary" type="submit" disabled={disabled}><Check size={18} /> Approve & add to practice</Button></> : <div className="cw-empty"><p>Add a practice before planning an activity.</p><Button onClick={() => show('event')} disabled={disabled}>Add practice</Button></div>}</form>}
      {modal.kind === 'details' && <div className="cw-detail"><p className="cw-detail-time"><Clock3 size={18} />{dateLabel(activeEvent.date)} · {timeLabel(activeEvent.startTime)}–{timeLabel(activeEvent.endTime)} PT</p><p className="cw-detail-time"><MapPin size={18} />{activeEvent.location}</p><p>{activeEvent.notes}</p>{activeEvent.type === 'practice' && <>{staffError && <p role="alert" className="cw-alert">{staffError} <Button onClick={() => setStaffAttempt((value) => value + 1)}>Retry staff list</Button></p>}<PracticePlanner key={`${activeEvent.id}:${modal.playerId ?? 'team'}`} event={activeEvent} activities={activities.filter((item) => item.eventId === activeEvent.id)} scoutingData={canScout ? scouting.data : null} members={staff} currentUserId={actorId} currentUserName={isCloud ? authorName : 'Sample Coach'} onPendingChange={setPracticePending} isManager={isManager} canCoach={canScout} disabled={disabled || store.pending} onChange={savePractice} initialPlayerId={modal.playerId} /><Button onClick={() => { close(); navigate('coaching'); }}>Review coaching priorities <ArrowRight size={16} /></Button></>}</div>}
      {modal.kind === 'rule' && <div className="cw-detail"><p className="cw-rule-summary">{modal.item.summary}</p><div className="cw-evidence"><strong>{modal.item.sourceLabel}</strong><p>{modal.item.division} · {modal.item.section} · Page {modal.item.page}</p><span>{modal.item.verification}</span></div><a className="cl-btn cl-btn--primary" href={modal.item.sourceUrl} target="_blank" rel="noreferrer">Open league bylaws <ArrowRight size={17} /></a><a className="cw-text-button" href="https://www.hvll.org/Default.aspx?tabid=1297730" target="_blank" rel="noreferrer"><BookOpen size={17} />HVLL document center</a><p className="cw-footnote">Reference summary. Check the original text and the applicable Little League rules before making a game-day decision.</p></div>}
    </Modal>}
  </div>;
}

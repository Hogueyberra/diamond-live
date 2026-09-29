import { lazy, Suspense, useCallback, useState } from 'react';
import { Button, Modal, Field } from './WorkspaceUI.jsx';
import { Link } from 'react-router';
import { DownloadSimple as ArrowDownToLine, ArrowRight, BookOpen, CalendarDots as CalendarDays, Check, CheckCircle as CheckCircle2, CaretDown as ChevronDown, Clock as Clock3, Diamond, SquaresFour as LayoutDashboard, MapPin, Plus, MagnifyingGlass as Search, Target, X } from '@phosphor-icons/react';
import { COACHING_RULES } from './coachingRules.js';
const GuidelinesLibrary = lazy(() => import('./GuidelinesLibrary.jsx').then((module) => ({ default: module.GuidelinesLibrary })));

const ScoutingWorkspace = lazy(() => import('./ScoutingWorkspace.jsx').then((module) => ({ default: module.ScoutingWorkspace })));

const VIEWS = [['home', 'Overview', LayoutDashboard], ['schedule', 'Schedule', CalendarDays], ['coaching', 'Coaching', Target], ['rules', 'Rules', BookOpen], ['scouting', 'Scouting', Diamond]];
const uid = () => crypto.randomUUID();
const dateLabel = (date, options = { weekday: 'short', month: 'short', day: 'numeric' }) => new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const timeLabel = (time) => { const [hour, minute] = time.split(':').map(Number); return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`; };
const sortEvents = (a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`);

export function CoachingWorkspace({ store, accountButton, syncBar, guidelinesRepository, authorName = 'Coach', authorId, scoutingRepository, canScout = true, onScoutingPendingChange }) {
  const { data, setData, saveError, loadError, retrySave, exportData } = store;
  const [teamId, setTeamId] = useState('angels-demo');
  const [requestedView, setView] = useState('home');
  const view = requestedView === 'scouting' && !canScout ? 'home' : requestedView;
  const [scoutingVisited, setScoutingVisited] = useState(false);
  const [scoutingPending, setScoutingPending] = useState(false);
  const scoutingChange = useCallback((pending) => { setScoutingPending(pending); onScoutingPendingChange?.(pending); }, [onScoutingPendingChange]);
  const [eventFilter, setEventFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const team = data.teams.find((item) => item.id === teamId) ?? data.teams[0];
  const scoped = (item) => item.teamId === team.id && item.seasonId === team.seasonId;
  const events = data.events.filter(scoped).sort(sortEvents);
  const practices = events.filter((item) => item.type === 'practice');
  const observations = data.observations.filter(scoped);
  const activities = data.activities.filter(scoped);
  const nextPractice = practices[0];
  const nextActivities = activities.filter((item) => item.eventId === nextPractice?.id);
  const totalMinutes = nextActivities.reduce((sum, item) => sum + item.minutes, 0);
  const openNotes = observations.filter((item) => item.status === 'open');
  const show = (kind, item = null) => { setFormError(''); setModal({ kind, item }); };
  const close = () => setModal(null);
  const navigate = (next) => { if (next === 'scouting') setScoutingVisited(true); setView(next); setMessage(''); setQuery(''); };
  const save = (updater, text) => { setData(updater); setMessage(text); close(); };
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
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!practices.some((item) => item.id === values.eventId)) return setFormError('Choose a practice for this team.');
    if (![values.title, values.objective, values.measure].every((value) => value.trim())) return setFormError('Add an activity, objective, and success measure.');
    const item = { ...values, ...context, id: uid(), observationId: modal.item?.id, minutes: Number(values.minutes), completed: false };
    save((current) => ({ ...current, activities: [...current.activities, item], observations: current.observations.map((note) => note.id === modal.item?.id && scoped(note) ? { ...note, status: 'planned' } : note) }), 'Takeaway reviewed and added to your practice plan.');
  };

  function EventList() {
    const visible = events.filter((item) => eventFilter === 'all' || item.type === eventFilter);
    return <section className="cl-card cw-agenda" aria-labelledby="schedule-title">
      <div className="cw-section-heading"><div><h2 id="schedule-title" className="cl-h3">Coming up</h2><p>Time to learn. Time to play.</p></div><Button onClick={() => show('event')} disabled={disabled}><Plus size={17} /> Add event</Button></div>
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
      {list.length ? <ul className="cw-note-list">{list.map((note) => <li key={note.id}><span className="cw-note-source"><Target size={15} />{note.source}</span><h3>{note.title}</h3><p>{note.note}</p>{note.status === 'open' ? <button className="cw-text-button" disabled={disabled} onClick={() => show('activity', note)}>Review & plan <ArrowRight size={16} /></button> : <span className="cw-planned"><CheckCircle2 size={16} />Added to practice</span>}</li>)}</ul> : <div className="cw-empty"><CheckCircle2 size={28} /><h3>{observations.length ? 'Every priority has a plan' : 'Start with an observation'}</h3><p>Capture something you noticed, then turn it into a practice activity.</p></div>}
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
    <header className="cw-header"><div className="cw-nav-shell"><Link to="/" className="cw-brand" onClick={() => navigate('home')}><Diamond size={23} weight="bold" /><span>Diamond Live</span></Link><nav aria-label="Coaching workspace">{VIEWS.filter(([key]) => key !== 'scouting' || canScout).map(([key, label, Icon]) => <button key={key} aria-current={view === key ? 'page' : undefined} onClick={() => navigate(key)}><Icon size={16} />{label}</button>)}</nav></div><div className="cw-team-select"><label className="cw-sr-only" htmlFor="team-select">Team and season</label><select id="team-select" value={team.id} onChange={(e) => { setTeamId(e.target.value); close(); setMessage(''); }} aria-label="Team and season">{data.teams.map((item) => <option value={item.id} key={item.id}>{item.name}{store.mode === 'cloud' ? '' : ' · Demo'}</option>)}</select><ChevronDown size={16} /></div>{accountButton}</header>
    <div className="cw-context"><span>{team.league} <span className="cw-context-divider">/</span> {team.division}</span><span>{team.season}</span></div>
    <main id="coaching-main" tabIndex={-1}>
      {syncBar}
      {loadError && <div role="alert" className="cw-alert">{loadError} Saved data is protected; editing is paused.</div>}
      {saveError && <div role="alert" className="cw-alert">{saveError} Keep this page open to retain your changes.{store.status !== 'conflict' && <Button onClick={retrySave}>Retry saving</Button>}<Button onClick={exportData}>Download backup</Button></div>}
      {message && <p role="status" className="cw-success"><CheckCircle2 size={18} />{message}</p>}
      {view === 'home' ? <>
        <section className="cw-hero"><div className="cw-hero-main"><h1>This week with<br /><span>the {team.name}.</span></h1><p>A little preparation. A better day on the field.</p><Button variant="primary" disabled={disabled} onClick={() => show('observation')}><Plus size={18} /> Add a coaching note</Button></div><div className="cw-next"><span className="cw-next-label"><CalendarDays size={17} />Next practice</span><h2>{nextPractice ? dateLabel(nextPractice.date) : 'Your next session'}</h2><p>{nextPractice ? `${timeLabel(nextPractice.startTime)} – ${timeLabel(nextPractice.endTime)} PT` : 'Build a plan for your team.'}</p><button className="cw-hero-link" onClick={() => show(nextPractice ? 'details' : 'event', nextPractice)} disabled={disabled && !nextPractice}>{nextPractice ? 'Open practice plan' : 'Schedule a practice'}<ArrowRight size={19} /></button></div></section>
        <div className="cw-metrics"><div><span>On the calendar</span><strong>{String(events.length).padStart(2, '0')}</strong><small>{practices.length} practices · {events.length - practices.length} {events.length - practices.length === 1 ? 'game' : 'games'}</small></div><div><span>Open coaching priorities</span><strong>{String(openNotes.length).padStart(2, '0')}</strong><small>Ready for a next step</small></div><div><span>Next practice planned</span><strong>{totalMinutes}<em> min</em></strong><small>{nextActivities.length} activities in the plan</small></div><div><span>Guidelines library</span><strong>55<em> pages</em></strong><small>2026 HVLL bylaws · searchable</small></div></div>
        <div className="cw-main-grid">{EventList()}{Notes({ compact: true })}</div>{Rules({ compact: true })}
      </> : view !== 'scouting' ? <><div className="cw-page-heading"><h1 className="cl-h1">{view === 'schedule' ? 'Make room for progress.' : view === 'coaching' ? 'Turn observations into action.' : 'The rules, within reach.'}</h1><p>{team.name} · {view === 'schedule' ? 'Practices and games in one place.' : view === 'coaching' ? 'Review a takeaway, plan the reps, and record how they went.' : 'Find the source. Read the rule. Prepare your team.'}</p></div>{view === 'schedule' ? EventList() : view === 'coaching' ? Notes({}) : <Suspense fallback={<p role="status">Opening the guidelines library…</p>}><GuidelinesLibrary key={guidelinesRepository?.scopeKey ?? 'local'} division={team.division} repository={guidelinesRepository ?? undefined} /></Suspense>}</> : null}
      {scoutingVisited && canScout && <div hidden={view !== 'scouting'}><Suspense fallback={<p role="status">Opening scouting…</p>}><ScoutingWorkspace key={`${authorId ?? 'demo'}:${team.id}`} team={team} repository={scoutingRepository} authorName={authorName} authorId={authorId} onPendingChange={scoutingChange} /></Suspense></div>}
    </main>
    <footer className="cw-footer"><span>{store.mode === 'cloud' ? 'Private team workspace' : 'Demo workspace · Sample events and notes'} · {loadError ? 'Editing paused' : saveError ? 'Changes not saved' : store.mode === 'cloud' ? (store.pending ? 'Saving changes…' : 'Shared with team members') : 'Stored on this device'}</span><div><button className="cw-text-button" onClick={exportData}><ArrowDownToLine size={15} />Backup</button><Link to="/demo" onClick={(event) => { if (scoutingPending) { event.preventDefault(); navigate('scouting'); setMessage('Finish or discard your scouting form, and resolve pending saves before opening the scoring demo.'); } }}>Open Hawks scoring demo <ArrowRight size={15} /></Link></div></footer>
    {modal && <Modal title={{ event: 'Add an event', observation: 'Capture a coaching note', activity: 'Review & plan a practice activity', details: modal.item?.title, rule: modal.item?.title }[modal.kind]} onClose={close}>
      {formError && <p role="alert" className="cw-alert">{formError}</p>}
      {modal.kind === 'event' && <form onSubmit={submitEvent} className="cw-form"><div className="cw-form-pair"><Field label="Event type"><select className="cl-select" name="type"><option value="practice">Practice</option><option value="game">Game</option></select></Field><Field label="Date"><input className="cl-input" name="date" type="date" defaultValue="2026-09-30" required /></Field></div><Field label="Event name"><input className="cl-input" name="title" maxLength={100} placeholder="Practice focus or game matchup" required /></Field><div className="cw-form-pair"><Field label="Start time (Pacific)"><input className="cl-input" name="startTime" type="time" defaultValue="16:30" required /></Field><Field label="End time (Pacific)"><input className="cl-input" name="endTime" type="time" defaultValue="17:30" required /></Field></div><Field label="Location"><input className="cl-input" name="location" maxLength={120} required /></Field><Field label="Preparation notes"><textarea className="cl-textarea" name="notes" maxLength={1500} /></Field><p className="cw-footnote">For {team.name} · {team.season} · America/Los_Angeles</p><Button type="submit" variant="primary" disabled={disabled}>Save event</Button></form>}
      {modal.kind === 'observation' && <form onSubmit={submitObservation} className="cw-form"><p>What did you notice, and what could the team practice next?</p><Field label="Coaching priority"><input className="cl-input" name="title" maxLength={100} required /></Field><Field label="Observation"><textarea className="cl-textarea" name="note" maxLength={2000} required /></Field><p className="cw-footnote">Saved as your observation for {team.name}. Review it before adding it to a practice.</p><Button type="submit" variant="primary" disabled={disabled}>Save observation</Button></form>}
      {modal.kind === 'activity' && <form onSubmit={submitActivity} className="cw-form"><div className="cw-evidence"><strong>Supporting observation</strong><p>{modal.item.note}</p><span>{modal.item.source} · {modal.item.author}</span></div>{practices.length ? <><Field label="Practice"><select className="cl-select" name="eventId">{practices.map((item) => <option key={item.id} value={item.id}>{dateLabel(item.date)} · {item.title}</option>)}</select></Field><Field label="Activity name"><input className="cl-input" name="title" defaultValue={modal.item.title} maxLength={100} required /></Field><Field label="Minutes"><input className="cl-input" type="number" name="minutes" min="1" max="120" defaultValue="10" required /></Field><Field label="Practice objective"><textarea className="cl-textarea" name="objective" maxLength={1000} required /></Field><Field label="What would progress look like?"><input className="cl-input" name="measure" maxLength={250} required /></Field><Button variant="primary" type="submit" disabled={disabled}><Check size={18} /> Approve & add to practice</Button></> : <div className="cw-empty"><p>Add a practice before planning an activity.</p><Button onClick={() => show('event')} disabled={disabled}>Add practice</Button></div>}</form>}
      {modal.kind === 'details' && <div className="cw-detail"><p className="cw-detail-time"><Clock3 size={18} />{dateLabel(modal.item.date)} · {timeLabel(modal.item.startTime)}–{timeLabel(modal.item.endTime)} PT</p><p className="cw-detail-time"><MapPin size={18} />{modal.item.location}</p><p>{modal.item.notes}</p>{modal.item.type === 'practice' && <><div className="cw-plan-heading"><h3>Practice plan</h3><span className="cl-mono">{activities.filter((item) => item.eventId === modal.item.id).reduce((sum, item) => sum + item.minutes, 0)} min planned</span></div>{activities.filter((item) => item.eventId === modal.item.id).map((activity) => <div className="cw-activity" key={activity.id}><div className="cw-activity-title"><h4>{activity.title}</h4><span className="cl-mono">{activity.minutes} min</span></div><p>{activity.objective}</p><p><strong>Look for:</strong> {activity.measure}</p><label className="cw-complete"><input type="checkbox" checked={activity.completed} disabled={disabled} onChange={(e) => { const completed = e.target.checked; setData((current) => ({ ...current, activities: current.activities.map((item) => item.id === activity.id && scoped(item) ? { ...item, completed } : item) })); }} />Completed in practice</label><label className="cl-field"><span className="cl-label">How did it go?</span><textarea aria-label={`Outcome for ${activity.title}`} className="cl-textarea" defaultValue={activity.outcome ?? ''} maxLength={1000} disabled={disabled} onBlur={(e) => { const outcome = e.target.value; if (outcome !== (activity.outcome ?? '')) setData((current) => ({ ...current, activities: current.activities.map((item) => item.id === activity.id && scoped(item) ? { ...item, outcome } : item) })); }} placeholder="Capture progress and the next adjustment." /></label>{activity.observationId && <small>Linked to a reviewed coaching observation.</small>}</div>)}{!activities.some((item) => item.eventId === modal.item.id) && <p>No activities yet. Review a coaching note to start a plan.</p>}<Button onClick={() => { close(); navigate('coaching'); }}>Review coaching priorities <ArrowRight size={16} /></Button></>}</div>}
      {modal.kind === 'rule' && <div className="cw-detail"><p className="cw-rule-summary">{modal.item.summary}</p><div className="cw-evidence"><strong>{modal.item.sourceLabel}</strong><p>{modal.item.division} · {modal.item.section} · Page {modal.item.page}</p><span>{modal.item.verification}</span></div><a className="cl-btn cl-btn--primary" href={modal.item.sourceUrl} target="_blank" rel="noreferrer">Open league bylaws <ArrowRight size={17} /></a><a className="cw-text-button" href="https://www.hvll.org/Default.aspx?tabid=1297730" target="_blank" rel="noreferrer"><BookOpen size={17} />HVLL document center</a><p className="cw-footnote">Reference summary. Check the original text and the applicable Little League rules before making a game-day decision.</p></div>}
    </Modal>}
  </div>;
}

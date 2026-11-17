import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowUpRight, Baseball, Books, CalendarDots, ChartLineUp, CheckCircle, Flag, House, UsersThree } from '@phosphor-icons/react';
import { useSharedWorkspace } from '../useSharedWorkspace.js';
import { useScouting } from '../useScouting.js';
import { createScoutingRepository } from '../scoutingRepository.js';
import { createCloudGuidelinesRepository } from '../cloudGuidelines.js';
import { supabase } from '../supabaseClient.js';
import { AccountPanel } from '../AccountPanel.jsx';
import { TeamRoster } from '../TeamRoster.jsx';
import { Button, Field, Modal } from '../WorkspaceUI.jsx';
import ClubhouseAssistant from './ClubhouseAssistant.jsx';
import TeamCalendar from './TeamCalendar.jsx';
import TeamSaveRecovery from './TeamSaveRecovery.jsx';
import { addReviewedPractice, localDate, dateLabel } from './livePractice.js';
import './coach-desk.css';
import './team-clubhouse.css';

const ScoutingWorkspace = lazy(() => import('../ScoutingWorkspace.jsx').then((module) => ({ default: module.ScoutingWorkspace })));
const GuidelinesLibrary = lazy(() => import('../GuidelinesLibrary.jsx').then((module) => ({ default: module.GuidelinesLibrary })));
const VIEWS = [
  { id: 'desk', name: 'Coach Desk', icon: House },
  { id: 'players', name: 'Players', icon: UsersThree, area: 'Team dugout' },
  { id: 'calendar', name: 'Calendar', icon: CalendarDots, area: 'Planning desk' },
  { id: 'development', name: 'Development', icon: ChartLineUp, area: 'Batting cage' },
  { id: 'library', name: 'Library', icon: Books, area: 'Equipment wall' },
];

export default function TeamClubhouse({ account }) {
  const selected = account.teams?.find((item) => item.id === account.activeTeamId);
  return <TeamScope key={`${account.user?.id ?? 'loading'}:${selected?.id ?? 'none'}:${selected?.role ?? 'none'}`} account={account} selected={selected} />;
}

function TeamScope({ account, selected }) {
  const [params, setParams] = useSearchParams();
  const active = VIEWS.some((view) => view.id === params.get('view')) ? params.get('view') : 'desk';
  const [visited, setVisited] = useState(() => new Set([active]));
  const [menu, setMenu] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [assistant, setAssistant] = useState(null);
  const [playerRequest, setPlayerRequest] = useState(null);
  const [rosterDirty, setRosterDirty] = useState(false);
  const [assessmentDirty, setAssessmentDirty] = useState(false);
  const [calendarDirty, setCalendarDirty] = useState(false);
  const [review, setReview] = useState(null);
  const [notice, setNotice] = useState('');
  const [recovering, setRecovering] = useState(false);
  const canCoach = Boolean(account.user && ['owner', 'coach'].includes(selected?.role));
  const shared = useSharedWorkspace(account.repository, selected, account.user?.id);
  const scoutingRepository = useMemo(() => {
    if (!canCoach) return null;
    const repository = createScoutingRepository(supabase);
    return { load: () => repository.loadWorkspace(selected.id), save: (revision, data, id) => repository.saveWorkspace(selected.id, revision, data, id) };
  }, [canCoach, selected?.id, account.user?.id]);
  const scouting = useScouting({ repository: scoutingRepository, scopeKey: canCoach ? selected.id : null, authorId: canCoach ? account.user.id : null, demo: false });
  const guidelines = useMemo(() => selected && account.user ? createCloudGuidelinesRepository({ client: supabase, teamId: selected.id, userId: account.user.id, canWrite: canCoach, label: selected.name }) : null, [selected?.id, selected?.name, canCoach, account.user?.id]);
  const record = shared.data?.teams.find((item) => item.id === selected?.id);
  const team = record ? { ...record, role: selected.role } : selected;
  const name = account.profile?.display_name || 'Coach';
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const pending = shared.pending || scouting.pending || rosterDirty || assessmentDirty || calendarDirty || Boolean(review);
  const preventLoss = () => { if (pending) throw new Error('Finish or discard your open form and resolve unsynced changes before switching teams or leaving.'); };
  const safeAccount = { ...account };
  for (const method of ['setActiveTeamId', 'createTeam', 'joinTeam', 'signOut']) safeAccount[method] = (...args) => { preventLoss(); return account[method](...args); };
  useEffect(() => { if (!pending) return; const protect = (event) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', protect); return () => window.removeEventListener('beforeunload', protect); }, [pending]);
  useEffect(() => { document.title = `${selected?.name ?? 'Your team'} · Diamond Live`; }, [selected?.name]);
  useEffect(() => { if (account.error || account.loading || !canCoach) setAssistant(null); }, [account.error, account.loading, canCoach]);
  const navigate = (view) => {
    try { preventLoss(); } catch (error) { setNotice(error.message); return; }
    setVisited((current) => new Set([...current, view])); setParams(view === 'desk' ? {} : { view }); setMenu(false); setNotice(''); window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const openAccount = () => { setAssistant(null); setMenu(false); setAccountOpen(true); };
  const openAssistant = (mode = 'general', playerId = '') => {
    if (rosterDirty || assessmentDirty || calendarDirty || scouting.pending) { setNotice('Save or discard the open player or practice form before asking the assistant.'); return; }
    setAssistant({ mode, playerId });
  };
  const evaluate = (id) => { setPlayerRequest(id ? { id, request: crypto.randomUUID() } : null); navigate('development'); };
  const ready = Boolean(account.user && !account.loading && !account.error && team && record && shared.data);
  const players = scouting.data?.players.filter((player) => !player.archived) ?? [];
  const events = shared.data?.events.filter((item) => item.teamId === team?.id && item.seasonId === team?.seasonId) ?? [];
  const nextPractice = events.filter((event) => event.type === 'practice' && !['completed', 'cancelled'].includes(event.status) && event.date >= localDate()).sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))[0];
  const skillsReady = canCoach && scouting.data && !scouting.loading && !scouting.error && !scouting.pending;
  const status = shared.status === 'synced' && (!canCoach || scouting.status === 'synced') ? 'Synced with your team' : shared.pending || scouting.pending ? 'Changes not yet synced' : 'Checking team connection';
  return <div className="pr-app tc-app">
    <a className="pr-skip" href="#team-main">Skip to workspace</a>
    <header className="pr-header"><button className="pr-brand" onClick={() => navigate('desk')} aria-label="Diamond Live Coach Desk"><span className="pr-brand-mark"><Baseball size={26} weight="duotone" /></span><span><strong>Diamond Live</strong><small>A little more purpose. Every practice.</small></span></button>
      <nav className="pr-navigation" aria-label="Clubhouse navigation">{VIEWS.filter((view) => canCoach || !['players', 'development'].includes(view.id)).map(({ id, name: label, icon: Icon }) => <button key={id} aria-current={active === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={17} /><span>{label}</span></button>)}</nav>
      <div className="pr-header-actions"><span className="pr-demo-badge"><span />My team</span>{canCoach && <button className="pr-assistant-trigger" onClick={() => openAssistant()}><Flag size={17} /><span>Coach’s assistant</span></button>}<button className="pr-avatar" aria-label="Open workspace menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>{initials}</button></div>
      {menu && <div className="pr-workspace-menu"><strong>{name}</strong><p>{selected?.name ?? 'Choose your team'}</p><button onClick={openAccount}>Your account and teams</button><Link to="/prototype" onClick={(event) => { try { preventLoss(); } catch (error) { event.preventDefault(); setNotice(error.message); } }}>Explore sample clubhouse<ArrowUpRight size={15} /></Link><button onClick={() => setMenu(false)}>Close menu</button></div>}
    </header>
    <div className="pr-context"><span><Baseball size={15} /><label className="tc-team-select">Team <select aria-label="Active team" value={selected?.id ?? ''} onChange={(event) => { try { safeAccount.setActiveTeamId(event.target.value); } catch (error) { setNotice(error.message); } }} disabled={account.loading}>{!selected && <option value="">Choose a team</option>}{account.teams?.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.season} · {item.division}</option>)}</select></label><span className="pr-context-divider">/</span>{team?.division}<span className="pr-season">{team?.season}</span></span><span role="status"><CheckCircle size={14} />{ready ? status : 'Opening your team'}{selected?.role === 'viewer' ? ' · Read only' : ''}</span></div>
    <main id="team-main" className="tc-main" tabIndex={-1}>
      {notice && <p role="status" className="tc-notice">{notice}</p>}
      {!ready ? <section className="tc-empty"><h1>{account.loading ? 'Opening your account…' : account.error ? 'Reconnect your account.' : !team ? 'Bring your team together.' : shared.loadError ? 'Your team could not be loaded.' : 'Opening your team…'}</h1>{account.error || shared.loadError ? <><p role="alert">{account.error || shared.loadError}</p><Button onClick={() => { account.reload().catch(() => {}); shared.retrySave(); }}>Try again</Button></> : !account.loading && !team ? <><p>Create or join your team to share players, practices, and league documents with your coaches.</p><Button variant="primary" onClick={openAccount}>Choose or set up your team</Button></> : <p role="status">Loading your shared records.</p>}</section> : <>
        {(shared.saveError || shared.pending) && <section className="tc-notice" role="alert"><p>{shared.saveError || 'Saving your team changes…'}</p>{shared.status !== 'saving' && <div className="tc-actions"><Button onClick={() => shared.retrySave()} disabled={shared.status === 'conflict'}>Retry save</Button><Button onClick={shared.exportData}>Download draft</Button><Button onClick={() => setRecovering(true)}>Review latest version</Button></div>}</section>}
        <div hidden={active !== 'desk'}><div className="tc-heading"><div><span className="tc-eyebrow">{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</span><h1>A good day to get better.</h1><p>{team.name}, your next practice, and the progress you’re building together.</p></div></div>
          <section className="pd-field-card"><div className="pd-stage-heading"><div><span className="pd-eyebrow">YOUR COACHING WORKSPACE</span><h2>Welcome to your clubhouse.</h2></div><span className="pd-live-tag"><span />{team.season}</span></div><div className="pd-clubhouse-art pd-interactive-map" role="group" aria-label="Explore your team clubhouse"><img src={`${import.meta.env.BASE_URL}prototype/clubhouse.png`} alt="Illustrated baseball clubhouse with training stations, a team dugout, and a planning desk." />{VIEWS.filter((view) => view.area && (canCoach || !['players', 'development'].includes(view.id))).map(({ id, name: label, icon: Icon, area }) => <button key={id} className={`pd-map-zone pd-map-${id}`} aria-label={`${area}: open ${label}`} onClick={() => navigate(id)}><span className="pd-map-pin"><Icon size={17} weight="bold" /><span><strong>{label}</strong><small>{area}</small></span><ArrowUpRight size={12} /></span></button>)}{canCoach && <button className="pd-map-umpire" aria-label="Consult the Rules" onClick={() => openAssistant('rules')}><img className="pd-umpire-figure" src={`${import.meta.env.BASE_URL}prototype/umpire.png`} alt="" aria-hidden="true" draggable="false" /><span className="pd-umpire-label"><Books size={15} /><strong>Consult the Rules</strong><ArrowUpRight size={12} /></span></button>}</div></section>
          <div className="tc-overview">{canCoach && <article><span className="tc-eyebrow">YOUR PLAYERS</span><h2>{skillsReady ? `${players.length} active players` : scouting.error ? 'Roster needs attention' : 'Opening your roster…'}</h2><p>{scouting.error || (skillsReady && !players.length ? 'Add or import your actual roster to begin. Your demo players stay separate.' : 'Record observations and use them to guide the next practice.')}</p><Button onClick={() => navigate('players')}>Open players</Button></article>}<article><span className="tc-eyebrow">NEXT PRACTICE</span><h2>{nextPractice?.title ?? 'Time for the next reps.'}</h2><p>{nextPractice ? `${dateLabel(nextPractice.date)} · ${nextPractice.startTime} · ${nextPractice.location}` : 'Add your team’s next practice to start planning together.'}</p><Button onClick={() => navigate('calendar')}>Open calendar</Button></article>{canCoach && <article><span className="tc-eyebrow">A SECOND SET OF EYES</span><h2>Turn observations into a plan.</h2><p>Build team and parent sessions from your saved skill assessments.</p><Button onClick={() => openAssistant('practice')}>Plan with the assistant</Button></article>}</div>
        </div>
        <Suspense fallback={<p role="status">Opening team records…</p>}>
          {(visited.has('players') || active === 'players') && <div hidden={active !== 'players'}>{canCoach ? <TeamRoster team={team} store={scouting} onEvaluate={evaluate} onPendingChange={setRosterDirty} /> : <p>Player records are available to team owners and coaches.</p>}</div>}
          {(visited.has('development') || active === 'development') && <div hidden={active !== 'development'}>{canCoach ? <ScoutingWorkspace team={team} repository={scoutingRepository} store={scouting} authorId={account.user.id} authorName={name} playerRequest={playerRequest} onPendingChange={setAssessmentDirty} onPlanPractice={(playerId) => openAssistant('practice', playerId)} /> : <p>Assessments are available to team owners and coaches.</p>}</div>}
          {(visited.has('calendar') || active === 'calendar') && <div hidden={active !== 'calendar'}><TeamCalendar team={team} store={shared} scouting={scouting} user={account.user} authorName={name} onPendingChange={setCalendarDirty} onAssistant={() => openAssistant('practice')} /></div>}
          {(visited.has('library') || active === 'library') && <div hidden={active !== 'library'}><GuidelinesLibrary division={team.division} repository={guidelines} /></div>}
        </Suspense>
      </>}
    </main>
    <footer className="pr-footer"><span><Baseball size={14} />Built around the coach. Focused on the player.</span><span>{selected?.name ?? 'Your team'} · Shared clubhouse</span></footer>
    {assistant && ready && <ClubhouseAssistant account={account} live scoutingData={skillsReady ? scouting.data : null} practiceUnavailable={!skillsReady ? scouting.error || 'Wait for your saved assessments to finish loading or syncing.' : ''} initialMode={assistant.mode} initialPlayerId={assistant.playerId} onReviewPlan={team.role === 'owner' ? (plan) => { setAssistant(null); setReview({ plan, revision: shared.revision }); } : undefined} onClose={() => setAssistant(null)} onAccount={openAccount} />}
    {review && ready && <PracticeReview plan={review.plan} team={team} store={shared} revision={review.revision} onClose={() => setReview(null)} onSaved={() => { setReview(null); setVisited((current) => new Set([...current, 'calendar'])); setParams({ view: 'calendar' }); setNotice('Practice saved as a draft. Open its plan to assign coaches and release it. Parent instructions are saved in the event notes.'); }} />}
    {accountOpen && <div className="pr-account-host"><AccountPanel account={safeAccount} onClose={() => setAccountOpen(false)} /></div>}
    {recovering && <Modal title="Review unsynced team changes" onClose={() => setRecovering(false)}><p>Download your draft before replacing it with the latest saved team version.</p><div className="tc-actions"><Button onClick={shared.exportData}>Download draft</Button><Button onClick={async () => { try { await shared.loadLatest(); setRecovering(false); } catch (error) { setNotice(error.message); } }}>Replace draft with latest</Button></div></Modal>}
  </div>;
}

function PracticeReview({ plan, team, store, revision, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => { if (store.pending) setSubmitted(true); }, [store.pending]);
  useEffect(() => { if (submitted && !busy && !store.pending && store.status === 'synced' && store.revision > revision) onSaved(); }, [submitted, busy, store.pending, store.status, store.revision, revision, onSaved]);
  return <Modal title="Review and save your practice" onClose={() => { if (!busy && !store.pending && window.confirm('Discard this unsaved practice draft?')) onClose(); }}><TeamSaveRecovery store={store} onRecovered={onClose} /><p>Save a new {plan.team.minutes}-minute draft to {team.name}’s calendar. The practice and parent instructions will be visible to team members. Player ratings stay private.</p><ol>{plan.team.blocks.map((block, index) => <li key={index}><strong>{block.minutes} min · {block.title}</strong><p>{block.steps}</p></li>)}</ol><form className="cw-form" onSubmit={async (event) => { event.preventDefault(); const details = Object.fromEntries(new FormData(event.currentTarget)); setBusy(true); setError(''); try { await store.save((current) => addReviewedPractice(current, team, details, plan).data, revision); onSaved(); } catch (reason) { setError(reason.message); } finally { setBusy(false); } }}><Field label="Practice name"><input className="cl-input" name="title" defaultValue="Team skill practice" maxLength={120} required disabled={busy} /></Field><div className="cw-form-pair"><Field label="Practice date"><input className="cl-input" type="date" name="date" defaultValue={localDate()} required disabled={busy} /></Field><Field label="Start time"><input className="cl-input" type="time" name="startTime" defaultValue="17:00" required disabled={busy} /></Field></div><Field label="Practice location"><input className="cl-input" name="location" maxLength={200} required disabled={busy} /></Field>{error && <p role="alert">{error}</p>}<Button type="submit" variant="primary" disabled={busy || store.pending || store.readOnly}>{busy ? 'Saving…' : 'Approve and save draft'}</Button></form></Modal>;
}

import { useEffect, useRef, useState } from 'react';
import { Button, Field, Modal } from './WorkspaceUI.jsx';
import { DRILL_LIBRARY, getEligibleDrills } from './drillLibrary.js';
import { checkDevelopmentFit, createDevelopmentHandout, createDrillSnapshot, getCurrentPlanVersion, validateDevelopmentData } from './development.js';
import { downloadText } from './RankingReview.jsx';
import './development.css';

const copy = (value) => JSON.parse(JSON.stringify(value));
const currentDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dateText = (value) => value ? new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`)) : 'No check-in date';
const outcomes = [['practice-observed','Coach observed practice'],['tried','Family reported: tried it'],['needs-help','Family reported: needs help'],['alternative','Family reported: chose another activity'],['not-tried','Family reported: not tried yet']];
const snapshotFor = (id, setting) => id ? createDrillSnapshot(DRILL_LIBRARY.find((item) => item.id === id), setting) : null;

export function DevelopmentWorkspace({ store, team, players = [], rosterLoading = false, activities = [], events = [], authorId, request, onPendingChange, onPlanPractice, isManager = false }) {
  const [form, setForm] = useState(null);
  const [filter, setFilter] = useState('active');
  const [playerFilter, setPlayerFilter] = useState('');
  const [allowBunting, setAllowBunting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [discard, setDiscard] = useState(false);
  const [reload, setReload] = useState(false);
  const handled = useRef(null);
  const heading = useRef(null);
  const activePlayers = players.filter((player) => !player.archived);
  const locked = busy || store.readOnly || rosterLoading;
  const pending = store.pending || Boolean(form?.dirty);
  useEffect(() => { onPendingChange?.(pending); return () => onPendingChange?.(false); }, [pending, onPendingChange]);
  useEffect(() => { if (store.status === 'access-denied') { setForm(null); setReload(false); setError(''); setMessage(''); } }, [store.status]);
  useEffect(() => { if (form) heading.current?.focus(); }, [form?.id, form?.type]);

  function createForm(playerId = '', homeDrillId = '') {
    const player = activePlayers.find((item) => item.id === playerId);
    const eligible = getEligibleDrills({ age: player?.age ?? null });
    const practice = homeDrillId ? snapshotFor(homeDrillId, 'practice') : eligible.length ? createDrillSnapshot(eligible[0]) : null;
    setError(''); setMessage(''); setAllowBunting(false);
    setForm({ type: 'plan', id: crypto.randomUUID(), playerId, goal: '', privateNotes: '', followUpDate: '', practice, home: homeDrillId ? snapshotFor(homeDrillId, 'home') : null, alternateHome: null, practiceBlockId: '', dirty: false, baseRevision: store.revision });
  }
  useEffect(() => {
    if (!request || handled.current === request.key || !store.data || rosterLoading) return;
    handled.current = request.key; setFilter('active'); setPlayerFilter(request.playerId ?? '');
    createForm(request.playerId ?? '', request.homeDrillId ?? '');
  }, [request, store.data, rosterLoading]);
  const change = (patch) => setForm((value) => ({ ...value, ...patch, dirty: true }));
  const closeForm = () => { if (busy) return; if (form?.dirty && !store.pending) setDiscard(true); else { setForm(null); setError(''); } };
  async function commit(updater, success) {
    if (locked) return;
    setBusy(true); setError(''); setMessage('');
    try { await store.save(updater, form?.baseRevision); setForm(null); setDiscard(false); setMessage(success); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  function edit(plan) {
    setError(''); setAllowBunting(false);
    setForm({ ...copy(getCurrentPlanVersion(plan)), type: 'plan', id: plan.id, playerId: plan.playerId, editing: true, dirty: false, baseRevision: store.revision });
  }
  function savePlan(event) {
    event.preventDefault();
    try {
      const now = new Date().toISOString();
      const version = { version: form.editing ? store.data.plans.find((item) => item.id === form.id).versions.length + 1 : 1, createdBy: authorId, createdAt: now,
        goal: form.goal.trim(), privateNotes: form.privateNotes.trim(), followUpDate: form.followUpDate, status: 'active',
        practice: copy(form.practice), home: copy(form.home), alternateHome: copy(form.alternateHome), practiceBlockId: form.practiceBlockId };
      if (!version.practice) throw new Error('Choose a practice drill.');
      checkDevelopmentFit(version, players.find((item) => item.id === form.playerId), allowBunting);
      if (form.practiceBlockId && !linkableBlocks(form.playerId).some((item) => item.id === form.practiceBlockId)) throw new Error('Choose an existing practice block for this player or clear the link.');
      const updater = (data) => ({ ...data, plans: form.editing ? data.plans.map((plan) => plan.id === form.id ? { ...plan, versions: [...plan.versions, version] } : plan) : [...data.plans, { id: form.id, playerId: form.playerId, seasonId: team.seasonId, createdBy: authorId, createdAt: now, versions: [version] }] });
      validateDevelopmentData(updater(store.data));
      void commit(updater, form.editing ? 'New plan version saved. Earlier instructions are preserved.' : 'Development plan saved. Download the approved home card to share.');
    } catch (failure) { setError(failure.message); }
  }
  function linkableBlocks(playerId) {
    return activities.filter((item) => item.teamId === team.id && item.seasonId === team.seasonId && (!item.playerId || item.playerId === playerId) && events.some((event) => event.id === item.eventId && event.type === 'practice' && event.status !== 'cancelled'));
  }
  function review(plan) { setError(''); setForm({ type: 'review', id: crypto.randomUUID(), planId: plan.id, version: plan.versions.length, outcome: 'practice-observed', reflection: '', coachNotes: '', dirty: false, baseRevision: store.revision }); }
  function closePlan(plan) {
    const version = { ...copy(getCurrentPlanVersion(plan)), version: plan.versions.length + 1, createdAt: new Date().toISOString(), createdBy: authorId, status: 'closed' };
    void commit((data) => ({ ...data, plans: data.plans.map((item) => item.id === plan.id ? { ...item, versions: [...item.versions, version] } : item) }), 'Plan closed. Its instructions and review history remain available; ratings are unchanged.');
  }
  const retry = async () => { setBusy(true); try { await store.retrySave(); setForm(null); setError(''); setMessage('Development changes saved.'); } catch (failure) { setError(failure.message); } finally { setBusy(false); } };
  const recovery = store.pending && <div className="dev-recovery"><p role="status">{store.status === 'saving' ? 'Saving plans…' : 'Your unsaved draft is kept in this tab. Download it before replacing it.'}</p><div className="ts-actions"><Button disabled={busy || store.status === 'conflict'} onClick={retry}>Retry plan save</Button><Button onClick={store.exportData}>Download private draft</Button><Button disabled={busy} onClick={() => setReload(true)}>Review latest plans</Button></div></div>;
  if (store.loading || !store.data) return <section className="dev-workspace"><h1 className="cl-h1">Player development</h1>{store.error ? <div role="alert" className="cw-alert"><p>{store.error}</p><Button onClick={() => store.refresh().catch(() => {})}>Try again</Button></div> : <p role="status">{store.status === 'idle' ? 'Development storage is not configured for this team.' : 'Opening your development plans…'}</p>}</section>;
  const plans = store.data.plans.filter((plan) => (!playerFilter || plan.playerId === playerFilter) && (filter === 'all' || getCurrentPlanVersion(plan).status === filter)).sort((a,b) => (getCurrentPlanVersion(a).followUpDate || '9999').localeCompare(getCurrentPlanVersion(b).followUpDate || '9999') || b.createdAt.localeCompare(a.createdAt));
  const formPlayer = players.find((item) => item.id === form?.playerId);
  const eligible = getEligibleDrills({ age: formPlayer?.age ?? null, allowBunting });
  return <section className="dev-workspace" aria-label="Coach development plans">
    <div className="dev-heading"><div><h1 className="cl-h1">One goal.<br />A useful next step.</h1><p>Practice together, offer a home challenge, and check in on what the player noticed.</p></div><Button variant="primary" disabled={locked || !activePlayers.length} onClick={() => createForm(playerFilter)}>Create development plan</Button></div>
    <p className="dev-boundary">{store.mode === 'demo' ? 'Sample team · plans stay in this browser.' : 'Shared privately with this team’s coaches.'} Home cards are manual handouts. Families do not have in-app assignment access yet.</p>
    <div className="dev-toolbar"><Field label="Plans for player"><select className="cl-select" value={playerFilter} onChange={(event) => setPlayerFilter(event.target.value)}><option value="">All players</option>{players.map((item) => <option value={item.id} key={item.id}>{item.name}{item.archived ? ' · Archived' : ''}</option>)}</select></Field><Field label="Plan status"><select className="cl-select" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="active">Active plans</option><option value="closed">Closed plans</option><option value="all">All plans</option></select></Field><Button disabled={busy || store.pending} onClick={() => store.refresh().catch(() => {})}>Refresh plans</Button></div>
    {message && <p role="status" className="cw-success">{message}</p>}
    {(store.error || (error && !form)) && <p role="alert" className="cw-alert">{store.error || error}</p>}
    {!form && recovery}
    {!store.pending && store.data && <p className="dev-save-status">{plans.length} {plans.length === 1 ? 'plan' : 'plans'} · {store.mode === 'demo' ? 'Browser demo' : 'Saved coach workspace'}</p>}
    {!activePlayers.length && !rosterLoading && <p>Add an active player in Players before creating a development plan.</p>}
    <div className="dev-plans">{plans.map((plan) => {
      const version = getCurrentPlanVersion(plan); const player = players.find((item) => item.id === plan.playerId);
      const reviews = store.data.reviews.filter((item) => item.planId === plan.id);
      const block = activities.find((item) => item.id === version.practiceBlockId && item.teamId === team.id);
      return <article className="cl-card dev-plan" key={plan.id}><div className="dev-plan-top"><span className="cl-badge">{player?.name ?? 'Player unavailable'}{player?.archived ? ' · Archived' : ''}</span><span>{version.status === 'closed' ? 'Closed' : version.followUpDate && version.followUpDate < currentDate() ? 'Check-in due' : 'Active'} · v{version.version}</span></div><h2>{version.goal}</h2><p className="dev-date">{dateText(version.followUpDate)}</p><p><strong>Practice:</strong> {version.practice.title}</p><p><strong>Home:</strong> {version.home?.title ?? 'No home challenge selected'}</p>{version.alternateHome && <p><strong>Home substitute:</strong> {version.alternateHome.title}</p>}{version.practiceBlockId && <p><strong>Practice link:</strong> {block ? block.title : 'Earlier block is no longer in the current plan'}</p>}
        <details><summary>Approved instructions & coach notes</summary><InstructionSheet snapshot={version.practice} />{version.home && <InstructionSheet snapshot={version.home} />}{version.alternateHome && <InstructionSheet snapshot={version.alternateHome} />}{version.privateNotes && <p><strong>Private coach notes:</strong> {version.privateNotes}</p>}</details>
        <div className="ts-actions">{version.status === 'active' && <><Button disabled={locked || player?.archived || plan.versions.length >= 100} onClick={() => edit(plan)}>Edit plan</Button><Button disabled={locked} onClick={() => review(plan)}>Record follow-up</Button><Button disabled={locked || plan.versions.length >= 100} onClick={() => closePlan(plan)}>Close plan</Button></>}{version.home && <Button onClick={() => downloadText('diamond-live-home-challenge.txt', createDevelopmentHandout(plan))}>Download approved home card</Button>}{version.alternateHome && <Button onClick={() => downloadText('diamond-live-home-substitute.txt', createDevelopmentHandout(plan,{alternate:true}))}>Download substitute card</Button>}{isManager && onPlanPractice && version.status === 'active' && <Button disabled={locked} onClick={() => onPlanPractice(plan.playerId, version.practice)}>Review practice drill</Button>}</div>
        <details className="dev-history"><summary>{reviews.length} follow-up {reviews.length === 1 ? 'note' : 'notes'} · {plan.versions.length} saved {plan.versions.length === 1 ? 'version' : 'versions'}</summary>{reviews.map((item) => <div className="dev-review-note" key={item.id}><strong>{outcomes.find(([key]) => key === item.outcome)?.[1]}</strong><p>{new Date(item.createdAt).toLocaleDateString('en-US',{timeZone:'America/Los_Angeles'})} · Plan v{item.version}</p>{item.reflection && <p>Player/family reported: {item.reflection}</p>}{item.coachNotes && <p>Coach observed: {item.coachNotes}</p>}</div>)}{plan.versions.map((item) => <details key={item.version}><summary>v{item.version} · {item.status} · {item.goal}</summary><p>{dateText(item.followUpDate)}</p><InstructionSheet snapshot={item.practice} />{item.home && <InstructionSheet snapshot={item.home} />}{item.alternateHome && <InstructionSheet snapshot={item.alternateHome} />}{item.privateNotes && <p>Private coach notes: {item.privateNotes}</p>}</details>)}</details>
      </article>;
    })}</div>
    {!plans.length && <div className="cl-card dev-empty"><h2>{filter === 'closed' ? 'No closed plans yet.' : 'Start with one achievable goal.'}</h2><p>Choose a player and a suitable practice drill. Add a short home challenge only when it fits the family.</p></div>}
    <p className="dev-boundary">Follow-up notes describe practice and family feedback. A new coach assessment is required to change a skill rating.</p>
    {form && <Modal title={form.type === 'review' ? 'Record a development follow-up' : form.editing ? 'Edit development plan' : 'Create development plan'} onClose={closeForm}>
      <h2 ref={heading} tabIndex={-1} className="dev-form-heading">{form.type === 'review' ? 'What did the player notice?' : 'Make the next step doable.'}</h2>
      {error && <p role="alert" className="cw-alert">{error}</p>}
      {store.pending && <p role="status">Resolve the pending save using the recovery controls before making another change.</p>}
      {recovery}
      {form.type === 'plan' ? <form className="cw-form dev-form" onSubmit={savePlan}><fieldset disabled={locked}>
        <Field label="Player"><select className="cl-select" required value={form.playerId} disabled={Boolean(form.editing)} onChange={(event) => change({playerId:event.target.value, practiceBlockId:''})}><option value="">Choose a player</option>{activePlayers.map((item) => <option key={item.id} value={item.id}>{item.name}{item.age ? ` · Age ${item.age}` : ' · Confirm age fit'}</option>)}</select></Field>
        <Field label="Player goal · included on the home card"><textarea className="cl-textarea" required maxLength={300} value={form.goal} placeholder="Gather my feet and finish in balance." onChange={(event) => change({goal:event.target.value})} /></Field>
        <Field label="Optional follow-up date"><input className="cl-input" type="date" value={form.followUpDate} onChange={(event) => change({followUpDate:event.target.value})} /></Field>
        <label className="dev-check"><input type="checkbox" checked={allowBunting} onChange={(event) => setAllowBunting(event.target.checked)} />I confirmed this division permits bunting</label>
        <DrillChoice label="Practice drill" setting="practice" value={form.practice} options={eligible} required onChange={(snapshot) => change({practice:snapshot})} />
        <DrillChoice label="Home challenge" setting="home" value={form.home} options={eligible.filter((item) => item.home)} onChange={(snapshot) => change({home:snapshot, ...(snapshot ? {} : {alternateHome:null})})} />
        {form.home && <DrillChoice label="Easier home substitute" setting="home" value={form.alternateHome} options={eligible.filter((item) => item.home)} onChange={(snapshot) => change({alternateHome:snapshot})} />}
        <Field label="Link an approved practice block"><select className="cl-select" value={form.practiceBlockId} onChange={(event) => change({practiceBlockId:event.target.value})}><option value="">No block linked yet</option>{linkableBlocks(form.playerId).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field><p className="dev-help">Use a block already approved for the whole team or this player. The manager can review the selected drill for the next practice after saving this plan, then return here to link that block.</p>
        {form.practice && <SnapshotEditor label="Practice" snapshot={form.practice} onChange={(value) => change({practice:value})} />}{form.home && <SnapshotEditor label="Home" snapshot={form.home} onChange={(value) => change({home:value})} />}{form.alternateHome && <SnapshotEditor label="Substitute" snapshot={form.alternateHome} onChange={(value) => change({alternateHome:value})} />}
        <Field label="Private coach notes · excluded from home cards"><textarea className="cl-textarea" maxLength={2000} value={form.privateNotes} onChange={(event) => change({privateNotes:event.target.value})} /></Field>
        <p className="dev-help">Review age fit, readiness, workload, equipment, and helper needs. Saving approves these instructions for a manual handout; it sends no message and changes no ratings. {formPlayer?.age == null && 'Player age is unknown; confirm the printed age range fits before use.'}</p>
        <div className="ts-actions"><Button type="submit" variant="primary">{busy ? 'Saving…' : form.editing ? 'Save new plan version' : 'Save development plan'}</Button><Button onClick={closeForm}>Cancel development plan</Button></div>
      </fieldset></form> : <form className="cw-form" onSubmit={(event) => { event.preventDefault(); const review = { id:form.id,planId:form.planId,version:form.version,createdBy:authorId,createdAt:new Date().toISOString(),outcome:form.outcome,reflection:form.reflection.trim(),coachNotes:form.coachNotes.trim() }; void commit((data) => ({...data,reviews:[...data.reviews,review]}),'Follow-up saved. Assessment ratings are unchanged.'); }}><fieldset disabled={locked}><p>Record what you observed or what the family told you. This form is coach-only; families have not submitted anything through the app.</p><Field label="Follow-up outcome"><select className="cl-select" value={form.outcome} onChange={(event) => change({outcome:event.target.value})}>{outcomes.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></Field><Field label="Player or family reflection · optional"><textarea className="cl-textarea" maxLength={1000} value={form.reflection} onChange={(event) => change({reflection:event.target.value})} /></Field><Field label="Coach observations · optional"><textarea className="cl-textarea" maxLength={2000} value={form.coachNotes} onChange={(event) => change({coachNotes:event.target.value})} /></Field><div className="ts-actions"><Button type="submit" variant="primary">Save follow-up</Button><Button onClick={closeForm}>Cancel follow-up</Button></div></fieldset></form>}
    </Modal>}
    {discard && <Modal title="Discard this development form?" onClose={() => setDiscard(false)}><p>Only the unsaved form will be discarded. Saved plans and history remain.</p><div className="ts-actions"><Button onClick={() => { setForm(null); setDiscard(false); setError(''); }}>Discard development edits</Button><Button onClick={() => setDiscard(false)}>Keep editing</Button></div></Modal>}
    {reload && <Modal title="Review your unsaved development draft" onClose={() => setReload(false)}>{error && <p role="alert" className="cw-alert">{error}</p>}<p>Download the private draft before loading the latest plans. Your current draft is replaced only after a successful load.</p><div className="ts-actions"><Button onClick={store.exportData}>Download private draft</Button><Button disabled={busy} onClick={async () => { setBusy(true); try { await store.loadLatest(); setForm(null); setReload(false); setError(''); } catch(failure) { setError(failure.message); } finally { setBusy(false); } }}>Load latest plans</Button><Button onClick={() => setReload(false)}>Keep current draft</Button></div></Modal>}
  </section>;
}

function DrillChoice({ label, setting, value, options, onChange, required = false }) {
  return <Field label={label}><select className="cl-select" required={required} value={value?.drillId ?? ''} onChange={(event) => onChange(snapshotFor(event.target.value, setting))}><option value="">{required ? 'Choose a drill' : 'None · optional'}</option>{value && !options.some((item) => item.id === value.drillId) && <option value={value.drillId}>{value.title} · check eligibility</option>}{options.map((item) => <option value={item.id} key={item.id}>{item.title} · Ages {item.ages.join('–')}</option>)}</select></Field>;
}
function SnapshotEditor({ label, snapshot, onChange }) {
  const change = (patch) => onChange({...snapshot,...patch});
  return <details className="dev-instruction-editor"><summary>Review {label.toLowerCase()} instructions · {snapshot.title}</summary><p>Ages {snapshot.minAge}–{snapshot.maxAge} · {snapshot.helper === 'coach' ? 'Coach-led' : snapshot.helper === 'solo' ? 'Solo; adult checks first' : `${snapshot.helper} helper`} · {snapshot.sourceGuide || 'Diamond Live'} · content v{snapshot.contentVersion}</p>{[['title','drill title',100],['objective','objective',1000],['equipment','equipment',500],['setup','setup',1500],['cue','one cue',500],['successCheck','success check',500],['easier','easier option',1000],['challenge','fun challenge',1000],['safetyNote','readiness notes',1500]].map(([key,name,max]) => <Field label={`${label} ${name}`} key={key}><textarea className="cl-textarea" required={['title','objective','setup','successCheck','safetyNote'].includes(key)} maxLength={max} value={snapshot[key]} onChange={(event) => change({[key]:event.target.value})} /></Field>)}<Field label={`${label} steps · one per line`}><textarea className="cl-textarea" rows={5} value={snapshot.steps.join('\n')} onChange={(event) => change({steps:event.target.value.split('\n')})} /></Field><Field label={`${label} time ceiling (minutes)`}><input className="cl-input" type="number" min={1} max={120} value={snapshot.minutes} onChange={(event) => change({minutes:Number(event.target.value)})} /></Field><p>Keep the helper, age range, and safety limits. Time is a ceiling, never a throwing or exercise quota.</p></details>;
}
function InstructionSheet({ snapshot }) {
  return <div className="dev-instructions"><h3>{snapshot.setting === 'home' ? 'Home' : 'Practice'} · {snapshot.title}</h3><p>Ages {snapshot.minAge}–{snapshot.maxAge} · Up to {snapshot.minutes} minutes · {snapshot.helper}</p><p>{snapshot.objective}</p><p><strong>Equipment:</strong> {snapshot.equipment}</p><p className="dev-multiline"><strong>Setup:</strong> {snapshot.setup}</p><ol>{snapshot.steps.map((step,index) => <li key={index}>{step}</li>)}</ol><p><strong>One cue:</strong> {snapshot.cue}</p><p><strong>Look for:</strong> {snapshot.successCheck}</p><p><strong>Easier:</strong> {snapshot.easier}</p><p><strong>Challenge:</strong> {snapshot.challenge}</p><p>{snapshot.safetyNote}</p>{snapshot.sourceGuide && <p>Adapted from {snapshot.sourceGuide} · {snapshot.sourceActivity}</p>}{snapshot.sourceUrl && <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Fundamental reference ↗</a>}</div>;
}

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Plus, Trash, UsersThree } from '@phosphor-icons/react';
import { Button, Field } from './WorkspaceUI.jsx';
import { ARM_CARE_SOURCE, PRACTICE_DRILLS, canAddPracticeBlock, createPracticeActivity, getPracticeRecommendations, getPracticeTimeline, updatePracticeAssignment } from './practicePlanning.js';
import './practicePlanning.css';

const timeLabel = (time) => { const [hour, minute] = time.split(':').map(Number); return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`; };
const blankDrill = () => ({ title: '', objective: '', measure: '', setup: '', equipment: '', steps: [], coachingCue: '', safetyNote: '', minutes: 10 });
const memberId = (member) => member.userId ?? member.id;
const memberName = (member) => member.displayName ?? member.name ?? 'Coach';

/** Receives only this event's activities. Parent saves them and nextEvent atomically. */
export function PracticePlanner({ event, activities = [], scoutingData, members = [], currentUserId, currentUserName = 'Coach', isManager = false, canCoach = true, disabled = false, onChange, initialPlayerId = '', onPendingChange }) {
  const [selection, setSelection] = useState(initialPlayerId);
  const [editing, setEditing] = useState(null);
  const [draftMinutes, setDraftMinutes] = useState(8);
  const [targetPlayer, setTargetPlayer] = useState(initialPlayerId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fieldDrafts, setFieldDrafts] = useState({});
  const [reviewVersion, setReviewVersion] = useState(0);
  const reportFieldDraft = useCallback((id, dirty) => setFieldDrafts((previous) => previous[id] === dirty ? previous : { ...previous, [id]: dirty }), []);
  const hasDraft = Boolean(editing) || Object.values(fieldDrafts).some(Boolean);
  useEffect(() => { onPendingChange?.(busy || hasDraft); }, [busy, hasDraft, onPendingChange]);
  useEffect(() => () => onPendingChange?.(false), [onPendingChange]);
  const reviewRef = useRef(null);
  const prefix = useId();
  const locked = disabled || busy;
  const timeline = getPracticeTimeline(event, activities);
  const released = event.planStatus === 'released';
  const players = (scoutingData?.players ?? []).filter((player) => !player.archived).sort((a, b) => a.name.localeCompare(b.name));
  const staff = members.filter((member) => ['owner', 'coach'].includes(member.role));
  if (currentUserId && canCoach && !staff.some((member) => memberId(member) === currentUserId)) staff.push({ userId: currentUserId, displayName: currentUserName, role: isManager ? 'owner' : 'coach' });
  const recommendations = useMemo(() => getPracticeRecommendations(scoutingData, { asOfDate: event.date }), [scoutingData, event.date]);
  const displayed = selection ? recommendations.individual.filter((item) => item.playerId === selection) : recommendations.team;
  const library = PRACTICE_DRILLS.filter((item) => item.skillId !== 'hit_bunting');

  async function persist(nextActivities, nextEvent = event, text = 'Practice plan saved.') {
    if (locked) return false;
    setBusy(true); setError(''); setMessage('');
    try { await onChange(nextActivities, nextEvent); setMessage(text); return true; }
    catch (failure) { setError(failure?.message || 'Could not save this change. Your current plan is still shown.'); return false; }
    finally { setBusy(false); }
  }
  function review(item) {
    if (editing) { setError('Finish or cancel your current drill review before choosing another drill.'); return; }
    setReviewVersion((version) => version + 1);
    setEditing({ ...item, steps: [...(item.steps ?? [])] }); setDraftMinutes(item.minutes ?? 8); setTargetPlayer(item.playerId ?? selection); setError(''); setMessage('');
    requestAnimationFrame(() => { reviewRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); reviewRef.current?.focus(); });
  }
  async function approve(e) {
    e.preventDefault();
    if (!isManager || locked) return;
    if (!canAddPracticeBlock(event, activities, Number(draftMinutes))) return setError(`This block does not fit. There are ${Math.max(0, timeline.remainingMinutes)} minutes available.`);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    const prepared = { ...editing, title: values.title.trim(), objective: values.objective.trim(), measure: values.measure.trim(), setup: values.setup.trim(), equipment: values.equipment.trim(), coachingCue: values.coachingCue.trim(), steps: values.steps.split('\n').map((step) => step.trim()).filter(Boolean), safetyNote: values.safetyNote.trim() };
    if (prepared.steps.length > 20 || prepared.steps.some((step) => step.length > 1000)) return setError('Use at most 20 steps, with each step under 1,000 characters.');
    if (!prepared.title || !prepared.objective || !prepared.measure || !prepared.setup || !prepared.steps.length) return setError('Add a name, objective, setup, steps, and success check so another coach can run this drill.');
    const player = players.find((item) => item.id === targetPlayer);
    if (targetPlayer && !player) return setError('Choose a current player or the whole team.');
    // A reviewed individual suggestion can also be deliberately changed to team-wide.
    delete prepared.playerId; delete prepared.playerName;
    const ordered = timeline.blocks.map(({ startsAt, endsAt, ...activity }, index) => ({ ...activity, order: index }));
    const next = createPracticeActivity(event, prepared, { minutes: Number(draftMinutes), player, order: ordered.length });
    if (await persist([...ordered, next], event, 'Drill approved and added to this practice.')) setEditing(null);
  }
  function updateBlock(id, values, text) { return persist(activities.map((item) => item.id === id ? { ...item, ...values } : item), event, text); }
  function reorder(id, change) {
    const ordered = timeline.blocks.map(({ startsAt, endsAt, ...activity }) => activity);
    const index = ordered.findIndex((activity) => activity.id === id); const target = index + change;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    return persist(ordered.map((activity, order) => ({ ...activity, order })), event, 'Practice order updated.');
  }
  function assign(activity, targetCoachId) {
    const coach = staff.find((member) => memberId(member) === targetCoachId);
    try {
      const updated = updatePracticeAssignment(activity, { actorId: currentUserId, isManager, planStatus: event.planStatus ?? 'draft', targetCoachId, targetCoachName: coach ? memberName(coach) : '' });
      return persist(activities.map((item) => item.id === activity.id ? updated : item), event, targetCoachId ? 'Coach assigned to this block.' : 'This block is available again.');
    } catch (failure) { setError(failure.message); }
  }
  return <section className="practice-planner" aria-label="Practice planner">
    <div className="cw-plan-heading"><h3>Practice plan</h3><span className="cl-mono">{timeline.totalMinutes} min planned</span></div>
    <div className="pp-summary"><span className={`pp-status ${released ? 'is-released' : ''}`}>{released ? 'Open for coach sign-up' : 'Manager planning'}</span><span>{timeLabel(event.startTime)}–{timeLabel(event.endTime)} · {timeline.capacity} min</span></div>
    <p className="pp-intro">{released ? 'Coaches can choose an open block. The manager can assign or change who leads any block.' : 'The manager chooses the plan and takes first pick of the blocks, then opens the remaining blocks to coaches.'}</p>
    {timeline.overflow ? <p className="cw-alert" role="alert">This plan runs {Math.abs(timeline.remainingMinutes)} minutes past practice. Shorten or remove blocks before releasing it.</p> : <p className="pp-capacity">{timeline.remainingMinutes} min unplanned · Include time for warm-up, water, and transitions.</p>}
    {error && <p className="cw-alert" role="alert">{error}</p>}
    {(busy || message) && <p className="cw-success" role="status">{busy ? 'Saving practice plan…' : message}</p>}
    {isManager && <div className="pp-actions"><Button onClick={() => review(blankDrill())} disabled={locked}><Plus size={16} />Add a custom block</Button><Button disabled={locked || (!released && (!activities.length || timeline.overflow))} onClick={() => persist(activities, { ...event, planStatus: released ? 'draft' : 'released' }, released ? 'Coach sign-up paused. The manager can revise the plan.' : 'The plan is open for coaches to choose a block.')}><UsersThree size={17} />{released ? 'Pause coach sign-up' : 'Open coach sign-up'}</Button></div>}
    <ol className="pp-timeline">{timeline.blocks.map((activity, index) => <li className="cw-activity pp-block" key={activity.id}>
      <div className="pp-block-time"><strong>{timeLabel(activity.startsAt)}–{timeLabel(activity.endsAt)}</strong><span>{activity.minutes} min</span></div>
      <div className="cw-activity-title"><h4>{activity.title}</h4>{activity.completed && <span className="pp-done"><Check size={15} />Done</span>}</div>
      <p className="pp-audience">{activity.playerName ? `Player focus: ${activity.playerName}` : 'Whole team'}</p><p>{activity.objective}</p>
      <p><strong>Look for:</strong> {activity.measure}</p>
      {(activity.setup || activity.steps?.length) && <details className="pp-instructions"><summary>How to run this drill</summary>{activity.equipment && <p><strong>Equipment:</strong> {activity.equipment}</p>}{activity.setup && <p><strong>Set up:</strong> {activity.setup}</p>}{activity.steps?.length > 0 && <ol>{activity.steps.map((step, stepIndex) => <li key={stepIndex}>{step}</li>)}</ol>}{activity.coachingCue && <p className="pp-cue"><strong>Coach cue:</strong> {activity.coachingCue}</p>}{activity.safetyNote && <p>{activity.safetyNote}</p>}{activity.sourceUrl?.startsWith('https://www.littleleague.org/') && <a href={activity.sourceUrl} target="_blank" rel="noreferrer">Fundamental reference · Little League ↗</a>}</details>}
      <div className="pp-assignment">{isManager ? <Field label={`Coach for ${activity.title}`}><select className="cl-select" aria-label={`Coach for ${activity.title}`} value={activity.assignedCoachId ?? ''} disabled={locked} onChange={(e) => assign(activity, e.target.value)}><option value="">Unassigned</option>{activity.assignedCoachId && !staff.some((member) => memberId(member) === activity.assignedCoachId) && <option value={activity.assignedCoachId}>{activity.assignedCoachName || 'Previously assigned coach'}</option>}{staff.map((member) => <option key={memberId(member)} value={memberId(member)}>{memberName(member)}{member.role === 'owner' ? ' · Manager' : ''}</option>)}</select></Field> : <><span><strong>Leading:</strong> {activity.assignedCoachName || 'Unassigned'}</span>{canCoach && released && (!activity.assignedCoachId || activity.assignedCoachId === currentUserId) && <Button disabled={locked} onClick={() => assign(activity, activity.assignedCoachId ? '' : currentUserId)}>{activity.assignedCoachId ? 'Give up my block' : 'I’ll run this drill'}</Button>}</>}</div>
      {isManager && <div className="pp-block-controls"><EditableBlockField activity={activity} name="minutes" locked={locked} onDraft={reportFieldDraft} onSave={async (minutes) => { const other = activities.filter((item) => item.id !== activity.id); if (!canAddPracticeBlock(event, other, minutes)) { setError('That duration would exceed practice or is outside 1–120 minutes.'); return false; } return updateBlock(activity.id, { minutes }, 'Block duration updated.'); }} /><Button aria-label={`Move ${activity.title} earlier`} disabled={locked || index === 0} onClick={() => reorder(activity.id, -1)}><ArrowUp size={17} /></Button><Button aria-label={`Move ${activity.title} later`} disabled={locked || index === timeline.blocks.length - 1} onClick={() => reorder(activity.id, 1)}><ArrowDown size={17} /></Button><Button aria-label={`Remove ${activity.title}`} disabled={locked} onClick={() => persist(activities.filter((item) => item.id !== activity.id), event, 'Block removed from this practice.')}><Trash size={17} /></Button></div>}
      {canCoach && <><label className="cw-complete"><input type="checkbox" checked={activity.completed} disabled={locked} onChange={(e) => updateBlock(activity.id, { completed: e.target.checked }, 'Practice progress saved.')} />Completed in practice</label><EditableBlockField activity={activity} name="outcome" locked={locked} onDraft={reportFieldDraft} onSave={(outcome) => updateBlock(activity.id, { outcome }, 'Practice outcome saved.')} /></>}
      {activity.observationId && <small>Linked to a reviewed coaching observation.</small>}
    </li>)}</ol>
    {!activities.length && <div className="pp-empty"><h4>Your practice starts here.</h4><p>{isManager ? 'Review a suggested drill or add your own block, including warm-up and water breaks.' : 'The manager will add the practice blocks here.'}</p></div>}
    {canCoach && isManager && <section className="pp-suggestions" aria-labelledby={`${prefix}-suggestions`}><div className="pp-section-head"><div><span className="pp-eyebrow">Coach review comes first</span><h4 id={`${prefix}-suggestions`}>Turn observations into a practice.</h4></div></div><p>Suggestions use the latest observed skills on or before this practice date. Unobserved skills are left out. Completing a drill never changes a rating.</p><Field label="Practice focus"><select className="cl-select" value={selection} disabled={locked} onChange={(e) => setSelection(e.target.value)}><option value="">Team themes</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></Field>
      {displayed.length ? <div className="pp-suggestion-grid">{displayed.map((item) => <article className="pp-suggestion" key={item.recommendationId}><span>{item.audience} · {item.skillLabel}</span><h5>{item.title}</h5><p>{item.reason}</p><Button disabled={locked} onClick={() => review(item)}>Review this drill</Button></article>)}</div> : <p className="pp-empty">{recommendations.observedPlayers ? 'No developing skill in these observations needs a suggested block. Choose a drill for repetition, or add your own focus.' : 'Add a player assessment in Scouting to get suggestions. You can still build a practice from the drill library.'}</p>}
      <details className="pp-library"><summary>Browse the drill library</summary><div className="pp-library-grid">{library.map((item) => <button type="button" key={item.id} disabled={locked} onClick={() => review(item)}><strong>{item.title}</strong><span>{item.id === 'bullpen-reset' ? 'Coach-selected pitching focus' : SCOPES[item.skillId?.split('_')[0]]}</span></button>)}</div><p>Confirm age, division rules, readiness, and field setup before using a drill. Bunting is omitted until division eligibility can be confirmed.</p><a href={ARM_CARE_SOURCE} target="_blank" rel="noreferrer">Throwing workload and rest guidance · Little League ↗</a></details>
    </section>}
    {editing && isManager && <form key={reviewVersion} className="pp-review cw-form" onSubmit={approve} aria-label="Review and approve drill"><h4 ref={reviewRef} tabIndex={-1}>Make this drill ready for your coaches.</h4><p>Review the instructions, choose the players, then approve it for this practice. A player’s name and drill become visible to team members; scouting ratings stay private.</p><Field label="Drill name"><input className="cl-input" name="title" defaultValue={editing.title} key={`title-${editing.id ?? 'custom'}`} maxLength={100} required disabled={locked} /></Field><div className="cw-form-pair"><Field label="Who is this for?"><select className="cl-select" value={targetPlayer} onChange={(e) => setTargetPlayer(e.target.value)} disabled={locked}><option value="">Whole team</option>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></Field><Field label="Block length (minutes)"><input className="cl-input" name="minutes" type="number" min="1" max="120" value={draftMinutes} onChange={(e) => setDraftMinutes(e.target.value)} disabled={locked} required /></Field></div>{[['objective', 'Objective', 1000], ['equipment', 'Equipment', 500], ['setup', 'Set up the station', 1000], ['steps', 'Steps · one per line', 4000], ['coachingCue', 'One cue for the coach', 500], ['measure', 'What would progress look like?', 250], ['safetyNote', 'Readiness and supervision notes', 1000]].map(([name, label, maxLength]) => <Field key={`${editing.id ?? 'custom'}-${name}`} label={label}><textarea className="cl-textarea" name={name} defaultValue={name === 'steps' ? editing.steps.join('\n') : editing[name] ?? ''} maxLength={maxLength} disabled={locked} required={['objective', 'setup', 'steps', 'measure'].includes(name)} /></Field>)}<div className="pp-actions"><Button type="submit" variant="primary" disabled={locked || !canAddPracticeBlock(event, activities, Number(draftMinutes))}><Check size={17} />Approve & add to practice</Button><Button disabled={locked} onClick={() => setEditing(null)}>Cancel review</Button></div>{!canAddPracticeBlock(event, activities, Number(draftMinutes)) && <p role="status">Choose 1–{Math.min(120, Math.max(0, timeline.remainingMinutes))} minutes, or make room in the plan.</p>}</form>}
  </section>;
}
const SCOPES = { if: 'Infield', of: 'Outfield', hit: 'Hitting' };

// Keep a typed outcome when a refresh arrives or a save fails. The workspace's
// revision check decides whether the draft can be saved against the newer plan.
function EditableBlockField({ activity, name, locked, onDraft, onSave }) {
  const saved = String(activity[name] ?? '');
  const [value, setValue] = useState(saved);
  const [dirty, setDirty] = useState(false);
  const key = `${activity.id}:${name}`;
  useEffect(() => { if (dirty && value === saved) setDirty(false); else if (!dirty) setValue(saved); }, [saved, dirty, value]);
  useEffect(() => { onDraft(key, dirty); return () => onDraft(key, false); }, [key, dirty, onDraft]);
  const change = (event) => { setValue(event.target.value); setDirty(event.target.value !== saved); };
  const blur = async () => { if (dirty && !locked && await onSave(name === 'minutes' ? Number(value) : value)) setDirty(false); };
  return <Field label={name === 'minutes' ? `Minutes for ${activity.title}` : 'How did it go?'}>{name === 'minutes'
    ? <input className="cl-input" type="number" min="1" max="120" value={value} onChange={change} onBlur={blur} disabled={locked} />
    : <textarea aria-label={`Outcome for ${activity.title}`} className="cl-textarea" value={value} maxLength={1000} onChange={change} onBlur={blur} disabled={locked} placeholder="What helped? What should we revisit?" />}
    {dirty && <span className="pp-unsaved">Unsaved change</span>}
  </Field>;
}

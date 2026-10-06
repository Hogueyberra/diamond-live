import { SCOUTING_SKILLS, getPlayerHistory } from './scouting.js';

import { DRILL_LIBRARY, getEligibleDrills } from './drillLibrary.js';
export { ARM_CARE_SOURCE, THROWING_NOTE } from './drillLibrary.js';
export const PRACTICE_DRILLS = DRILL_LIBRARY;

export function getPracticeRecommendations(data, { allowBunting = false, asOfDate = new Date().toISOString().slice(0, 10), setting = 'practice', recentDrillIds = [] } = {}) {
  if (!data?.players || !data?.sessions || !data?.evaluations) return { team: [], individual: [], observedPlayers: 0 };
  const active = data.players.filter((player) => !player.archived).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const observations = active.map((player) => ({ player, latest: getPlayerHistory(data, player.id).filter((entry) => entry.session.date <= asOfDate).at(-1) })).filter(({ latest }) => latest?.observedSkills > 0);
  const permitted = SCOUTING_SKILLS.filter((skill) => allowBunting || skill.id !== 'hit_bunting');
  const options = (skill, players) => getEligibleDrills({ skillId: skill.id, setting, allowBunting, autoOnly: true })
    .filter((item) => players.every((player) => player.age == null || (player.age >= item.ages[0] && player.age <= item.ages[1])))
    .sort((a, b) => Number(recentDrillIds.includes(a.id)) - Number(recentDrillIds.includes(b.id)));
  const makeRecommendation = (skill, drills, extra) => ({ ...drills[0], alternatives: drills.slice(1, 4), skillLabel: `${skill.category} · ${skill.label}`, ...extra });
  const team = permitted.map((skill) => {
    const recorded = observations.filter(({ latest }) => latest.ratings[skill.id] !== null);
    const needsPractice = recorded.filter(({ latest }) => latest.ratings[skill.id] <= 5);
    return { skill, recorded, needsPractice, drills: options(skill, active), average: recorded.reduce((sum, { latest }) => sum + latest.ratings[skill.id], 0) / (recorded.length || 1) };
  }).filter(({ needsPractice, drills }) => needsPractice.length > 0 && drills.length > 0)
    .sort((a, b) => b.needsPractice.length - a.needsPractice.length || a.average - b.average || a.skill.id.localeCompare(b.skill.id))
    .slice(0, 3).map(({ skill, recorded, needsPractice, drills }) => makeRecommendation(skill, drills, { recommendationId: `team:${skill.id}`, audience: 'Team theme', reason: `${needsPractice.length} of ${recorded.length} observed players could use more practice with ${skill.label.toLowerCase()}. Based on each player’s latest assessment on or before ${asOfDate}.` }));
  const individual = observations.flatMap(({ player, latest }) => {
    const skill = permitted.filter((item) => latest.ratings[item.id] !== null && latest.ratings[item.id] <= 5 && options(item, [player]).length > 0).sort((a, b) => latest.ratings[a.id] - latest.ratings[b.id] || a.id.localeCompare(b.id))[0];
    return skill ? [makeRecommendation(skill, options(skill, [player]), { recommendationId: `player:${player.id}:${skill.id}`, audience: player.name, playerId: player.id, playerName: player.name, reason: `A next step for ${player.name} from ${latest.session.name} (${latest.session.date}). Coach review decides whether this is the right focus today.` })] : [];
  });
  return { team, individual, observedPlayers: observations.length };
}

export function practiceMinutes(event) {
  const minutes = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? '') ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN;
  const duration = minutes(event?.endTime) - minutes(event?.startTime);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}
const clockTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
export function getPracticeTimeline(event, activities) {
  let offset = 0;
  const start = Number(event.startTime?.slice(0, 2) ?? 0) * 60 + Number(event.startTime?.slice(3) ?? 0);
  const ordered = activities.map((activity, index) => ({ activity, index })).sort((a, b) => (a.activity.order ?? a.index) - (b.activity.order ?? b.index) || a.index - b.index);
  const blocks = ordered.map(({ activity }) => {
    const begins = start + offset;
    offset += activity.minutes;
    return { ...activity, startsAt: clockTime(begins), endsAt: clockTime(start + offset) };
  });
  const capacity = practiceMinutes(event);
  return { blocks, totalMinutes: offset, capacity, remainingMinutes: capacity - offset, overflow: offset > capacity };
}
export function canAddPracticeBlock(event, activities, minutes) {
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 120 && getPracticeTimeline(event, activities).remainingMinutes >= minutes;
}
/** Persist the coach-approved instruction sheet, never the private score/reason payload. */
export function createPracticeActivity(event, suggestion, { minutes = suggestion.minutes ?? 8, id = crypto.randomUUID(), player = null, order = 0 } = {}) {
  return {
    id, teamId: event.teamId, seasonId: event.seasonId, eventId: event.id,
    title: suggestion.title, objective: suggestion.objective, measure: suggestion.measure, minutes, completed: false, order,
    ...(suggestion.id ? { drillId: suggestion.id } : {}), ...(suggestion.skillId ? { skillId: suggestion.skillId } : {}),
    ...((player?.id || suggestion.playerId) ? { playerId: player?.id ?? suggestion.playerId, playerName: player?.name ?? suggestion.playerName } : {}),
    ...Object.fromEntries(['setup', 'equipment', 'steps', 'coachingCue', 'safetyNote', 'sourceUrl'].filter((key) => suggestion[key] !== undefined).map((key) => [key, suggestion[key]])),
  };
}
export function updatePracticeAssignment(activity, { actorId, isManager, planStatus, targetCoachId = '', targetCoachName = '' }) {
  if (!actorId) throw new Error('Sign in to choose a practice block.');
  if (!isManager && (planStatus !== 'released' || (activity.assignedCoachId && activity.assignedCoachId !== actorId) || (targetCoachId && targetCoachId !== actorId))) throw new Error('Coaches can choose an open block after the manager releases the plan.');
  const next = { ...activity };
  if (targetCoachId) { next.assignedCoachId = targetCoachId; next.assignedCoachName = targetCoachName; }
  else { delete next.assignedCoachId; delete next.assignedCoachName; }
  return next;
}

/** Optional practice metadata boundary, shared by local and cloud workspace validation. */
export function validatePracticeFields(data) {
  const requireField = (condition, message) => { if (!condition) throw new Error(`Invalid practice plan: ${message}`); };
  const optionalText = (record, key, limit) => {
    if (Object.hasOwn(record, key)) requireField(typeof record[key] === 'string' && record[key].length <= limit, `${key} must be text of at most ${limit} characters.`);
  };
  for (const event of data.events) {
    if (Object.hasOwn(event, 'planStatus')) requireField(event.type === 'practice' && ['draft', 'released'].includes(event.planStatus), 'only practices can be draft or released plans.');
  }
  const orders = new Map();
  for (const activity of data.activities) {
    if (Object.hasOwn(activity, 'order')) {
      requireField(Number.isInteger(activity.order) && activity.order >= 0 && activity.order <= 4999, 'block order is invalid.');
      const orderKey = `${activity.eventId}:${activity.order}`;
      requireField(!orders.has(orderKey), 'block order must be unique within a practice.'); orders.set(orderKey, true);
    }
    for (const field of ['setup', 'equipment', 'coachingCue', 'safetyNote']) optionalText(activity, field, 2000);
    for (const field of ['drillId', 'skillId', 'playerId', 'playerName', 'assignedCoachId', 'assignedCoachName']) optionalText(activity, field, 160);
    if (Object.hasOwn(activity, 'skillId')) requireField(SCOUTING_SKILLS.some((skill) => skill.id === activity.skillId), 'unknown skill.');
    if (Object.hasOwn(activity, 'sourceUrl')) requireField(typeof activity.sourceUrl === 'string' && activity.sourceUrl.length <= 1000 && /^https:\/\/[^\s]+$/.test(activity.sourceUrl), 'reference links must use HTTPS.');
    if (Object.hasOwn(activity, 'steps')) requireField(Array.isArray(activity.steps) && activity.steps.length <= 20 && activity.steps.every((step) => typeof step === 'string' && step.trim().length > 0 && step.length <= 1000), 'use at most 20 nonempty steps of at most 1,000 characters.');
    if (activity.playerName) requireField(typeof activity.playerId === 'string' && activity.playerId.trim().length > 0, 'a player name needs a player ID.');
    if (activity.assignedCoachId) requireField(typeof activity.assignedCoachName === 'string' && activity.assignedCoachName.trim().length > 0 && activity.assignedCoachName.length <= 80, 'assigned coaches need a display name.');
    else requireField(!activity.assignedCoachName, 'a coach name needs an assigned coach ID.');
  }
  for (const event of data.events.filter((item) => item.type === 'practice')) {
    const activities = data.activities.filter((item) => item.eventId === event.id);
    // Historical unstructured plans stay readable so a manager can repair them.
    if (event.planStatus !== undefined || activities.some((item) => item.order !== undefined || item.drillId !== undefined)) requireField(!getPracticeTimeline(event, activities).overflow, 'the time blocks exceed the scheduled practice.');
  }
  return data;
}

/** Keep the workspace-wide ID sequence stable for assistant claims/completions.
 * Display reordering is carried by each block's explicit `order` field. */
export function mergePracticeActivities(allActivities, nextActivities, eventId, teamId) {
  const inPractice = (activity) => activity.eventId === eventId && activity.teamId === teamId;
  const existingIds = new Set(allActivities.filter(inPractice).map((activity) => activity.id));
  const nextById = new Map(nextActivities.map((activity) => [activity.id, activity]));
  const retained = allActivities.flatMap((activity) => {
    if (!inPractice(activity)) return [activity];
    return nextById.has(activity.id) ? [nextById.get(activity.id)] : [];
  });
  return [...retained, ...nextActivities.filter((activity) => !existingIds.has(activity.id))];
}

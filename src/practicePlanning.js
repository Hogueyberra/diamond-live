import { SCOUTING_SKILLS, getPlayerHistory } from './scouting.js';

const fieldingSource = 'https://www.littleleague.org/university/articles/tee-ball-drills-fielding/';
const throwingSource = 'https://www.littleleague.org/university/articles/tee-ball-drills-team-throwing/';
const movementSource = 'https://www.littleleague.org/university/articles/tee-ball-drills-left-field-center-field-right-field/';
const basicsSource = 'https://www.littleleague.org/university/backyard-tips/';
export const ARM_CARE_SOURCE = 'https://www.littleleague.org/partnerships/pitch-smart/protecting-childrens-arms/';
export const THROWING_NOTE = 'Check recent throwing and required rest with the family. Warm up first; stop for pain or fatigue. Choose control over speed.';
const drill = (id, skillId, title, objective, setup, equipment, steps, coachingCue, measure, sourceUrl, safetyNote = 'Keep waiting players outside the active lane. Demonstrate once, then let each player try at a comfortable pace.') => ({ id, skillId, title, objective, setup, equipment, steps, coachingCue, measure, sourceUrl, safetyNote, minutes: 8 });

// Original beginner activities with linked fundamental demonstrations. These are
// coach-reviewed practice ideas, not prescriptions or an injury/velocity model.
export const PRACTICE_DRILLS = [
  drill('quiet-glove', 'if_glove', 'Quiet glove grounders', 'Receive a slow ground ball with control.', 'Mark one clear rolling lane. Start close enough for an easy roll.', 'Soft baseballs, gloves, two cones', ['Show a ready position and roll one ball slowly.', 'Player moves behind the ball and receives it in front.', 'Pause to notice one successful movement; reset before the next roll.'], 'Glove ready early; watch the ball into the glove.', 'Coach notes controlled receptions and the cue that helped.', fieldingSource),
  drill('field-gather', 'if_footwork', 'Field, gather, aim', 'Arrive balanced and line up toward a target.', 'Mark the fielding spot and a target cone. Start without a throw.', 'Soft baseballs, gloves, three cones', ['Roll a gentle ball to the fielding spot.', 'Player gathers their feet and turns toward the target.', 'Freeze briefly to check balance, then return the ball by rolling it.'], 'Field first, gather, find your target.', 'Player can repeat the sequence without a reminder.', fieldingSource),
  drill('read-move', 'if_agility', 'Read and move', 'React to a direction while staying balanced.', 'Place two cones a few easy steps left and right of a starting spot.', 'Cones and soft baseballs', ['Coach points left or right.', 'Player takes a controlled first step toward that cone.', 'Add a gentle roller only after the movement feels comfortable.'], 'Eyes up; move under control.', 'Coach observes the correct first step and a balanced stop.', movementSource),
  drill('target-throws', 'if_accuracy', 'Short target throws', 'Make a comfortable throw toward a broad target.', 'Create one clear lane with a large target and safe backstop at a comfortable distance.', 'Soft baseballs, gloves, target, cones', ['Coach checks readiness and demonstrates a relaxed throw.', 'Player finds the target, sets their feet, and makes an easy throw.', 'Reset between attempts; move closer if control is difficult.'], 'See the target; finish comfortably.', 'Coach notes target hits and whether the motion stays controlled.', throwingSource, THROWING_NOTE),
  drill('track-secure', 'of_glove', 'Track and secure', 'Follow an easy toss and secure the catch.', 'Use a clear area with plenty of space around one active player.', 'Foam balls or soft baseballs, gloves', ['Coach starts with a gentle toss within easy reach.', 'Player watches the ball, moves into position, and catches.', 'Increase movement only when the player is comfortable; use a bounce if helpful.'], 'Find the ball early; arrive before it.', 'Player tracks the ball and finishes the catch in balance.', basicsSource),
  drill('turn-track', 'of_footwork', 'Turn and track', 'Turn toward a landing area without backpedaling.', 'Mark a start and a nearby diagonal landing area. Begin without a ball.', 'Cones and foam ball', ['Coach points to the landing area.', 'Player turns and moves to it, then faces the coach.', 'Introduce a gentle toss only after a balanced turn is repeatable.'], 'Turn, move, then find the ball.', 'Coach observes a smooth turn and controlled arrival.', movementSource),
  drill('outfield-step', 'of_agility', 'Outfield first step', 'Respond to a direction cue with confidence.', 'Place three cones left, right, and diagonally behind the start, with clear lanes.', 'Four cones', ['Coach names a cone.', 'Player turns toward it and moves a few steps.', 'Reset and change the cue; keep it playful and unhurried.'], 'Choose your direction, then move.', 'Player chooses the correct cone and returns under control.', movementSource),
  drill('find-cutoff', 'of_accuracy', 'Find the cutoff', 'Line up a short throw to a ready receiver.', 'Mark a rolling lane and a nearby adult receiver with no players between them.', 'Soft baseballs, gloves, cones', ['Coach rolls a ball into the lane.', 'Player fields it, locates the ready receiver, and sets their feet.', 'Make an easy throw; receiver returns the ball after the lane is clear.'], 'Find the receiver before the throw.', 'Coach notes throws that the receiver can handle comfortably.', throwingSource, THROWING_NOTE),
  drill('soft-bunt', 'hit_bunting', 'Soft bunt targets', 'Use safe bat control to direct gentle contact.', 'Confirm division rules allow bunting. Mark a target in a separate batting area.', 'Helmet, bat, foam balls, cones', ['Coach demonstrates hand placement with fingers protected behind the bat.', 'With one hitter in the clear area, gently toss a foam ball.', 'Player meets the ball softly toward the target, then puts the bat down before retrieval.'], 'Quiet hands; gentle contact.', 'Coach observes safe hand position and deliberate placement.', 'https://www.littleleague.org/university/articles/backyard-tip-bunting/', 'Bunting must be allowed for this division. Use helmets, soft balls, and adult supervision; keep others outside the bat arc.'),
  drill('balanced-tee', 'hit_swing', 'Balanced tee swings', 'Repeat a comfortable stance and balanced finish.', 'Set a tee facing a net or clear hitting area. Waiting players stay behind a marked boundary.', 'Tee, helmet, bat, soft baseballs, net', ['Coach shows the stance and finish with the area clear.', 'Player takes a controlled swing, then pauses in balance.', 'Put the bat down before collecting balls; praise one repeatable movement.'], 'Find your balance before and after the swing.', 'Coach records balanced finishes and consistent contact.', basicsSource, 'Helmet on. One hitter at a time. Coach clears the bat arc and hitting lane before every turn.'),
  drill('bullpen-reset', '', 'Bullpen target & reset', 'Practice a calm setup and a comfortable throw toward a target.', 'Coach first reviews throwing readiness and recent workload. Use a safe lane and a ready adult receiver.', 'Glove, baseball, target, protected receiver', ['Coach demonstrates the setup and a relaxed delivery.', 'Player makes an easy throw only when the receiver is ready.', 'Reset and name one cue; stop before fatigue instead of filling the block with extra throws.'], 'One calm setup; one clear target.', 'Coach notes repeatable setup and comfortable target control.', 'https://www.littleleague.org/university/articles/target-skill-pitching/', THROWING_NOTE),
];

export function getPracticeRecommendations(data, { allowBunting = false, asOfDate = new Date().toISOString().slice(0, 10) } = {}) {
  if (!data?.players || !data?.sessions || !data?.evaluations) return { team: [], individual: [], observedPlayers: 0 };
  const active = data.players.filter((player) => !player.archived).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const observations = active.map((player) => ({ player, latest: getPlayerHistory(data, player.id).filter((entry) => entry.session.date <= asOfDate).at(-1) })).filter(({ latest }) => latest?.observedSkills > 0);
  const permitted = SCOUTING_SKILLS.filter((skill) => allowBunting || skill.id !== 'hit_bunting');
  const makeRecommendation = (skill, extra) => ({ ...PRACTICE_DRILLS.find((entry) => entry.skillId === skill.id), skillLabel: `${skill.category} · ${skill.label}`, ...extra });
  const team = permitted.map((skill) => {
    const recorded = observations.filter(({ latest }) => latest.ratings[skill.id] !== null);
    const needsPractice = recorded.filter(({ latest }) => latest.ratings[skill.id] <= 5);
    return { skill, recorded, needsPractice, average: recorded.reduce((sum, { latest }) => sum + latest.ratings[skill.id], 0) / (recorded.length || 1) };
  }).filter(({ needsPractice }) => needsPractice.length > 0)
    .sort((a, b) => b.needsPractice.length - a.needsPractice.length || a.average - b.average || a.skill.id.localeCompare(b.skill.id))
    .slice(0, 3).map(({ skill, recorded, needsPractice }) => makeRecommendation(skill, { recommendationId: `team:${skill.id}`, audience: 'Team theme', reason: `${needsPractice.length} of ${recorded.length} observed players could use more practice with ${skill.label.toLowerCase()}. Based on each player’s latest assessment on or before ${asOfDate}.` }));
  const individual = observations.flatMap(({ player, latest }) => {
    const skill = permitted.filter((item) => latest.ratings[item.id] !== null && latest.ratings[item.id] <= 5).sort((a, b) => latest.ratings[a.id] - latest.ratings[b.id] || a.id.localeCompare(b.id))[0];
    return skill ? [makeRecommendation(skill, { recommendationId: `player:${player.id}:${skill.id}`, audience: player.name, playerId: player.id, playerName: player.name, reason: `A next step for ${player.name} from ${latest.session.name} (${latest.session.date}). Coach review decides whether this is the right focus today.` })] : [];
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

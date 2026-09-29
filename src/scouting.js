export const SCOUTING_CATEGORIES = [
  { id: 'infield', label: 'Infield', skills: [{ id: 'if_glove', label: 'Glove fielding' }, { id: 'if_footwork', label: 'Footwork' }, { id: 'if_agility', label: 'Agility' }, { id: 'if_accuracy', label: 'Arm accuracy' }] },
  { id: 'outfield', label: 'Outfield', skills: [{ id: 'of_glove', label: 'Glove fielding' }, { id: 'of_footwork', label: 'Footwork' }, { id: 'of_agility', label: 'Agility' }, { id: 'of_accuracy', label: 'Arm accuracy' }] },
  { id: 'hitting', label: 'Hitting', skills: [{ id: 'hit_bunting', label: 'Bunting' }, { id: 'hit_swing', label: 'Swing mechanics' }] },
];
export const SCOUTING_SKILLS = SCOUTING_CATEGORIES.flatMap((category) => category.skills.map((skill) => ({ ...skill, categoryId: category.id, category: category.label })));
export const RATING_ANCHORS = [
  { value: 1, label: 'Starting', description: 'Learning the movement; needs step-by-step guidance.' },
  { value: 3, label: 'Developing', description: 'Shows parts of the skill with frequent reminders.' },
  { value: 5, label: 'Building consistency', description: 'Repeats the skill in a controlled drill with some reminders.' },
  { value: 7, label: 'Consistent', description: 'Repeats the skill independently in game-like drills.' },
  { value: 9, label: 'Game ready', description: 'Adapts the skill reliably as speed and decisions change.' },
  { value: 10, label: 'Highly consistent', description: 'Demonstrates excellent control across repeated game-like observations.' },
];
export const SCOUTING_DRILLS = {
  if_glove: { title: 'Quiet glove grounders', focus: 'Roll soft ground balls from a short distance. Get the glove down early and receive the ball in front.', successCheck: 'Coach observes a ready glove and controlled reception on repeated rolls.' },
  if_footwork: { title: 'Field, gather, aim', focus: 'Place two cones for the approach and throwing direction. Field a slow roller, gather the feet, then point toward the target.', successCheck: 'Coach observes balanced feet before each throw.' },
  if_agility: { title: 'Read and move', focus: 'Start in a ready position. Follow a coach’s left or right cue, move a few steps, then field a soft roller.', successCheck: 'Coach observes a controlled first step and balance at the ball.' },
  if_accuracy: { title: 'Short target throws', focus: 'Use a comfortable short throwing distance and a broad target. Set the feet and aim for the receiver’s chest.', successCheck: 'Coach records throws reaching the target with a controlled motion.' },
  of_glove: { title: 'Track and secure', focus: 'Use gentle high tosses or a soft ball. Find the ball early, move underneath it, and secure the catch.', successCheck: 'Coach observes early tracking and a controlled catch.' },
  of_footwork: { title: 'Turn and track', focus: 'Begin facing the coach. On a direction cue, turn and move to a marked landing area before a gentle toss.', successCheck: 'Coach observes an efficient turn and balanced arrival.' },
  of_agility: { title: 'Outfield first step', focus: 'React to a left, right, or back cue. Move to the matching cone and return under control.', successCheck: 'Coach observes the correct first step without losing balance.' },
  of_accuracy: { title: 'Find the cutoff', focus: 'Field a rolled ball and make a controlled throw to a nearby cutoff target. Keep the distance comfortable.', successCheck: 'Coach observes a lined-up throw that the cutoff can receive.' },
  hit_bunting: { title: 'Soft bunt targets', focus: 'If bunting is allowed for this division, use a safe soft-ball station to practice the ready position and gentle contact toward a marked area.', successCheck: 'Coach observes safe bat control and repeatable placement.' },
  hit_swing: { title: 'Balanced tee swings', focus: 'With a clear hitting area and adult supervision, use a tee to practice a balanced stance, controlled turn, and balanced finish.', successCheck: 'Coach observes balance and repeatable movement through contact.' },
};

const copy = (value) => JSON.parse(JSON.stringify(value));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const skillIds = SCOUTING_SKILLS.map((skill) => skill.id);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function requireThat(condition, message) { if (!condition) throw new Error(`Invalid scouting data: ${message}`); }
function fields(value, keys, label) {
  requireThat(object(value), `${label} must be an object.`);
  requireThat(Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)), `${label} has unexpected or missing fields.`);
}
function text(value, max, label, required = false) { requireThat(typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0), `${label} is invalid.`); }
function id(value, label) { requireThat(typeof value === 'string' && UUID.test(value), `${label} must be a UUID.`); }
function integer(value, min, max, label) { requireThat(Number.isInteger(value) && value >= min && value <= max, `${label} is out of range.`); }
function calendarDate(value) { return typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) && Number(value.slice(0, 4)) > 0 && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value; }
function timestamp(value, label) { requireThat(typeof value === 'string' && /^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) && calendarDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value)), `${label} is invalid.`); }
function uniqueIds(values, label) { const ids = new Set(); values.forEach((value) => { requireThat(object(value), `${label} must be an object.`); id(value.id, `${label} id`); requireThat(!ids.has(value.id), `${label} IDs must be unique.`); ids.add(value.id); }); return ids; }

export function createEmptyRatings() { return Object.fromEntries(skillIds.map((skill) => [skill, null])); }
export function createEmptyScoutingData() { return { schemaVersion: 1, players: [], sessions: [], evaluations: [], goals: [] }; }

/** Validate the boundary without silently dropping malformed records or manufacturing scores. */
export function validateScoutingData(value) {
  fields(value, ['schemaVersion', 'players', 'sessions', 'evaluations', 'goals'], 'workspace');
  requireThat(value.schemaVersion === 1, 'unsupported schema version.');
  for (const [key, limit] of Object.entries({ players: 500, sessions: 200, evaluations: 5000, goals: 2000 })) requireThat(Array.isArray(value[key]) && value[key].length <= limit, `${key} must be an array of at most ${limit} records.`);
  const players = uniqueIds(value.players, 'player'); const sessions = uniqueIds(value.sessions, 'session');
  uniqueIds(value.evaluations, 'evaluation'); uniqueIds(value.goals, 'goal');
  value.players.forEach((player) => {
    fields(player, ['id', 'name', 'number', 'age', 'positions', 'notes', 'archived', 'draftStatus'], 'player');
    text(player.name, 80, 'player name', true); text(player.number, 12, 'player number'); text(player.positions, 80, 'positions'); text(player.notes, 1000, 'player notes');
    if (player.age !== null) integer(player.age, 5, 18, 'player age');
    requireThat(typeof player.archived === 'boolean', 'archived must be true or false.');
    requireThat(['available', 'shortlist', 'drafted'].includes(player.draftStatus), 'draft status is invalid.');
  });
  value.sessions.forEach((session) => {
    fields(session, ['id', 'name', 'date'], 'session'); text(session.name, 100, 'session name', true);
    requireThat(calendarDate(session.date), 'session date is invalid.');
  });
  value.evaluations.forEach((evaluation) => {
    fields(evaluation, ['id', 'playerId', 'sessionId', 'authorId', 'authorName', 'createdAt', 'ratings', 'notes'], 'evaluation');
    requireThat(players.has(evaluation.playerId) && sessions.has(evaluation.sessionId), 'evaluation has an unknown player or session.');
    id(evaluation.authorId, 'evaluation author'); text(evaluation.authorName, 80, 'coach name', true); timestamp(evaluation.createdAt, 'evaluation time'); text(evaluation.notes, 2000, 'evaluation notes');
    fields(evaluation.ratings, skillIds, 'ratings');
    skillIds.forEach((skill) => { if (evaluation.ratings[skill] !== null) integer(evaluation.ratings[skill], 1, 10, skill); });
  });
  value.goals.forEach((goal) => {
    fields(goal, ['id', 'playerId', 'skillId', 'target', 'title', 'focus', 'sessionsCompleted', 'createdAt', 'createdBy', 'closed'], 'goal');
    requireThat(players.has(goal.playerId), 'goal has an unknown player.'); requireThat(skillIds.includes(goal.skillId), 'goal skill is invalid.');
    integer(goal.target, 1, 10, 'goal target'); integer(goal.sessionsCompleted, 0, 999, 'practice count');
    text(goal.title, 100, 'goal title', true); text(goal.focus, 1000, 'goal focus'); timestamp(goal.createdAt, 'goal time'); id(goal.createdBy, 'goal creator');
    requireThat(typeof goal.closed === 'boolean', 'closed must be true or false.');
  });
  return copy(value);
}

export function validateScoutingUpdate(previous, next, authorId) {
  const candidate = validateScoutingData(next);
  for (const key of ['players', 'sessions', 'goals']) {
    const retained = new Set(candidate[key].map((record) => record.id));
    previous[key].forEach((record) => requireThat(retained.has(record.id), `saved ${key} cannot be deleted.`));
  }
  const byId = new Map(candidate.evaluations.map((evaluation) => [evaluation.id, evaluation]));
  previous.evaluations.forEach((evaluation) => requireThat(JSON.stringify(byId.get(evaluation.id)) === JSON.stringify(evaluation), 'saved evaluations are immutable; add a new observation instead.'));
  const existing = new Set(previous.evaluations.map((evaluation) => evaluation.id));
  candidate.evaluations.filter((evaluation) => !existing.has(evaluation.id)).forEach((evaluation) => requireThat(evaluation.authorId === authorId, 'new evaluations must belong to the signed-in coach.'));
  const existingGoals = new Set(previous.goals.map((goal) => goal.id));
  candidate.goals.filter((goal) => !existingGoals.has(goal.id)).forEach((goal) => requireThat(goal.createdBy === authorId, 'new goals must belong to the signed-in coach.'));
  const goalsById = new Map(candidate.goals.map((goal) => [goal.id, goal]));
  previous.goals.forEach((goal) => ['createdBy', 'createdAt', 'playerId', 'skillId'].forEach((field) => requireThat(goalsById.get(goal.id)[field] === goal[field], `goal ${field} cannot be changed.`)));
  return candidate;
}

const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
/** One vote per coach per event; a newer partial assessment replaces that coach's previous assessment. */
export function getPlayerScore(data, playerId, sessionId) {
  const byCoach = new Map();
  data.evaluations.filter((evaluation) => evaluation.playerId === playerId && evaluation.sessionId === sessionId).forEach((evaluation) => {
    const current = byCoach.get(evaluation.authorId);
    const time = Date.parse(evaluation.createdAt); const priorTime = current ? Date.parse(current.createdAt) : -Infinity;
    if (!current || time > priorTime || (time === priorTime && evaluation.id > current.id)) byCoach.set(evaluation.authorId, evaluation);
  });
  const evaluations = [...byCoach.values()].sort((a, b) => a.authorId.localeCompare(b.authorId));
  const ratings = Object.fromEntries(skillIds.map((skill) => [skill, average(evaluations.map((evaluation) => evaluation.ratings[skill]).filter((rating) => rating !== null))]));
  const skillCounts = Object.fromEntries(skillIds.map((skill) => [skill, evaluations.filter((evaluation) => evaluation.ratings[skill] !== null).length]));
  const categories = SCOUTING_CATEGORIES.map((category) => {
    const scores = category.skills.map((skill) => ratings[skill.id]).filter((rating) => rating !== null);
    return { id: category.id, label: category.label, score: average(scores), observed: scores.length, total: category.skills.length, complete: scores.length === category.skills.length };
  });
  const observed = Object.values(ratings).filter((rating) => rating !== null).length;
  const complete = observed === skillIds.length;
  return { ratings, skillCounts, categories, categoryScores: Object.fromEntries(categories.map((category) => [category.id, category.score])), overall: complete ? average(categories.map((category) => category.score)) : null, complete, observedSkills: observed, totalSkills: skillIds.length, coverage: { observed, total: skillIds.length }, evaluatorCount: evaluations.length, evaluators: evaluations.map((evaluation) => ({ id: evaluation.authorId, name: evaluation.authorName })), evaluations };
}

/** Incomplete evaluations remain visible below the comparable, fully observed players. */
export function getRankedPlayers(data, sessionId, { includeArchived = false } = {}) {
  const rows = data.players.filter((player) => includeArchived || !player.archived).map((player) => ({ player, ...getPlayerScore(data, player.id, sessionId) }));
  rows.sort((a, b) => (b.overall ?? -Infinity) - (a.overall ?? -Infinity) || a.player.name.localeCompare(b.player.name) || a.player.id.localeCompare(b.player.id));
  let priorScore = null; let rank = null;
  return rows.map((row, index) => { if (row.complete && row.overall !== priorScore) rank = index + 1; priorScore = row.overall; return { ...row, rank: row.complete ? rank : null }; });
}
export function getPlayerHistory(data, playerId) {
  return [...data.sessions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).map((session) => ({ session, ...getPlayerScore(data, playerId, session.id) })).filter((entry) => entry.evaluatorCount > 0);
}
export function getDrillSuggestion(skillId) { return SCOUTING_DRILLS[skillId] ? { skillId, ...SCOUTING_DRILLS[skillId] } : null; }
export function formatScoutingScore(score) { return typeof score === 'number' && Number.isFinite(score) ? score.toFixed(1) : '—'; }
export function getScoutingStorageKey(scopeKey) { return `diamond-live.scouting-demo.v1:${encodeURIComponent(scopeKey)}`; }
export const DEMO_SCOUTING_AUTHOR_ID = '00000000-0000-4000-8000-000000000101';

/** Synthetic examples only. Cloud workspaces always start empty. */
export function createDemoScoutingData() {
  const uuid = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
  const data = createEmptyScoutingData();
  data.players = ['Alex Demo', 'Jordan Demo', 'Casey Demo', 'Riley Demo', 'Morgan Demo', 'Sam Demo'].map((name, index) => ({ id: uuid(index + 1), name, number: String(index + 1), age: 8 + index % 2, positions: ['Infield', 'Outfield', 'Infield, outfield'][index % 3], notes: 'Synthetic sample player for exploring the evaluation workspace.', archived: false, draftStatus: index === 1 ? 'shortlist' : 'available' }));
  data.sessions = [{ id: uuid(201), name: 'Sample baseline — synthetic', date: '2026-09-05' }, { id: uuid(202), name: 'Sample follow-up — synthetic', date: '2026-09-26' }];
  data.players.forEach((player, index) => data.sessions.forEach((session, sessionIndex) => {
    const ratings = Object.fromEntries(skillIds.map((skill, skillIndex) => [skill, index === 5 && skillIndex > 5 ? null : Math.min(10, 3 + (index + skillIndex) % 4 + sessionIndex)]));
    data.evaluations.push({ id: uuid(300 + index * 2 + sessionIndex), playerId: player.id, sessionId: session.id, authorId: DEMO_SCOUTING_AUTHOR_ID, authorName: 'Sample Coach', createdAt: `${session.date}T16:00:00.000Z`, ratings, notes: 'Synthetic observation. Scores illustrate the workflow and are not assessments of real children.' });
  }));
  data.goals.push({ id: uuid(401), playerId: data.players[0].id, skillId: 'if_glove', target: 6, title: 'Build a ready glove', focus: SCOUTING_DRILLS.if_glove.focus, sessionsCompleted: 2, createdAt: '2026-09-05T17:00:00.000Z', createdBy: DEMO_SCOUTING_AUTHOR_ID, closed: false });
  return data;
}

export const DEVELOPMENT_SCHEMA_VERSION = 1;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function requireThat(condition, message) { if (!condition) throw new Error(`Invalid development plan: ${message}`); }
function keys(value, fields) { requireThat(object(value) && Object.keys(value).length === fields.length && fields.every((key) => Object.hasOwn(value, key)), 'Unrecognized or missing fields.'); }
function text(value, max, required = false) { requireThat(typeof value === 'string' && value.length <= max && (!required || value.trim()), 'Text is missing or too long.'); }
function id(value) { requireThat(typeof value === 'string' && uuid.test(value), 'A valid identifier is required.'); }
function integer(value, min, max) { requireThat(Number.isInteger(value) && value >= min && value <= max, 'Number is outside its allowed range.'); }
export function isDevelopmentDate(value) { return typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) && Number(value.slice(0, 4)) > 0 && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value; }
function time(value) { requireThat(typeof value === 'string' && /^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) && isDevelopmentDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value)), 'Invalid timestamp.'); }
export const createEmptyDevelopmentData = () => ({ schemaVersion: DEVELOPMENT_SCHEMA_VERSION, plans: [], reviews: [] });
export const getCurrentPlanVersion = (plan) => plan.versions.at(-1);

export const SNAPSHOT_FIELDS = ['drillId', 'contentVersion', 'title', 'setting', 'minAge', 'maxAge', 'minutes', 'objective', 'equipment', 'setup', 'steps', 'cue', 'successCheck', 'easier', 'challenge', 'safetyNote', 'sourceUrl', 'sourceGuide', 'sourceActivity', 'helper', 'throwing', 'requiresBunting'];
export function validateDrillSnapshot(value, setting) {
  keys(value, SNAPSHOT_FIELDS);
  text(value.drillId, 80, true); requireThat(/^[a-z0-9-]+$/.test(value.drillId), 'Invalid catalog identifier.');
  integer(value.contentVersion, 1, 9999);
  requireThat(value.setting === setting, 'Drill setting does not match.');
  integer(value.minAge, 5, 18); integer(value.maxAge, value.minAge, 18); integer(value.minutes, 1, 120);
  for (const [field, max, required] of [['title',100,true],['objective',1000,true],['equipment',500,false],['setup',1500,true],['cue',500,false],['successCheck',500,true],['easier',1000,false],['challenge',1000,false],['safetyNote',1500,true],['sourceGuide',100,false],['sourceActivity',200,false]]) text(value[field], max, required);
  text(value.sourceUrl, 500); requireThat(!value.sourceUrl || /^https:\/\/[^\s]+$/.test(value.sourceUrl), 'Reference must be an HTTPS URL.');
  requireThat(Array.isArray(value.steps) && value.steps.length >= 1 && value.steps.length <= 20, 'Supply 1–20 instruction steps.');
  value.steps.forEach((step) => text(step, 1000, true));
  requireThat(['solo', 'partner', 'adult', 'coach'].includes(value.helper), 'Unknown helper requirement.');
  requireThat(typeof value.throwing === 'boolean' && typeof value.requiresBunting === 'boolean', 'Missing eligibility flags.');
  return value;
}

/** Deliberate allowlist: ratings, recommendation reasons and player identity never enter a drill snapshot. */
export function createDrillSnapshot(item, setting = 'practice') {
  const source = setting === 'home' ? item.home : item;
  if (!source) throw new Error('Choose a drill with a home version.');
  const result = {
    drillId: item.id, contentVersion: item.contentVersion ?? 1, title: item.title, setting,
    minAge: item.ages[0], maxAge: item.ages[1], minutes: source.minutes,
    objective: item.objective, equipment: source.equipment ?? item.equipment,
    setup: setting === 'practice' ? [item.setup, `Group: ${item.players}`, `Rotation: ${item.rotation}`].join('\n') : source.setup,
    steps: [...source.steps, ...(item.playScore ?? []).map((line) => `Optional play points (never a rating): ${line}`)],
    cue: item.coachingCue, successCheck: item.measure, easier: item.easier,
    challenge: source.challenge ?? item.challenge, safetyNote: source.safetyNote ?? item.safetyNote,
    sourceUrl: item.sourceUrl, sourceGuide: item.sourceGuide ?? '', sourceActivity: item.sourceActivity ?? '',
    helper: setting === 'home' ? source.helper : 'coach', throwing: item.throwing, requiresBunting: item.requiresBunting,
  };
  return validateDrillSnapshot(result, setting);
}

export function validateDevelopmentData(data) {
  keys(data, ['schemaVersion', 'plans', 'reviews']);
  requireThat(data.schemaVersion === DEVELOPMENT_SCHEMA_VERSION, 'Unsupported schema version.');
  requireThat(JSON.stringify(data).length <= 2097152, 'Workspace exceeds the size limit.');
  for (const [collection, limit] of [['plans', 500], ['reviews', 3000]]) {
    requireThat(Array.isArray(data[collection]) && data[collection].length <= limit, 'Collection limit exceeded.');
    const seen = new Set(); for (const item of data[collection]) { id(item.id); requireThat(!seen.has(item.id), 'Duplicate identifiers.'); seen.add(item.id); }
  }
  for (const plan of data.plans) {
    keys(plan, ['id', 'playerId', 'seasonId', 'createdBy', 'createdAt', 'versions']);
    id(plan.playerId); id(plan.createdBy); text(plan.seasonId, 100, true); time(plan.createdAt);
    requireThat(Array.isArray(plan.versions) && plan.versions.length >= 1 && plan.versions.length <= 100, 'Version limit exceeded.');
    plan.versions.forEach((version, index) => {
      keys(version, ['version','createdBy','createdAt','goal','privateNotes','followUpDate','status','practice','home','alternateHome','practiceBlockId']);
      requireThat(version.version === index + 1, 'Versions must be sequential.'); id(version.createdBy); time(version.createdAt);
      text(version.goal, 300, true); text(version.privateNotes, 2000); requireThat(version.followUpDate === '' || isDevelopmentDate(version.followUpDate), 'Invalid follow-up date.');
      requireThat(['active', 'closed'].includes(version.status), 'Unknown plan status.');
      validateDrillSnapshot(version.practice, 'practice');
      if (version.home !== null) validateDrillSnapshot(version.home, 'home');
      if (version.alternateHome !== null) { requireThat(version.home !== null, 'A substitute needs a home challenge.'); validateDrillSnapshot(version.alternateHome, 'home'); }
      requireThat(typeof version.practiceBlockId === 'string' && (version.practiceBlockId === '' || /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(version.practiceBlockId)), 'Invalid practice block link.');
    });
  }
  for (const review of data.reviews) {
    keys(review, ['id','planId','version','createdBy','createdAt','outcome','reflection','coachNotes']);
    id(review.planId); id(review.createdBy); time(review.createdAt); integer(review.version, 1, 100);
    const plan = data.plans.find((item) => item.id === review.planId);
    requireThat(plan && review.version <= plan.versions.length, 'Review references a missing plan version.');
    requireThat(['practice-observed','tried','needs-help','alternative','not-tried'].includes(review.outcome), 'Unknown review outcome.');
    text(review.reflection, 1000); text(review.coachNotes, 2000);
  }
  return data;
}

export function validateDevelopmentUpdate(previous, next, authorId) {
  validateDevelopmentData(next); id(authorId);
  for (const collection of ['plans','reviews']) {
    for (const old of previous[collection]) {
      const item = next[collection].find((entry) => entry.id === old.id);
      requireThat(item, 'Saved history cannot be deleted. Close a plan instead.');
      if (collection === 'reviews') requireThat(same(old, item), 'Saved reviews cannot be changed. Add a new review.');
      else {
        requireThat(['playerId','seasonId','createdBy','createdAt'].every((key) => item[key] === old[key]), 'Original plan identity cannot be changed.');
        requireThat(item.versions.length >= old.versions.length && item.versions.length <= old.versions.length + 1 && old.versions.every((value,index) => same(value,item.versions[index])), 'Previous instructions are permanent. Append one new version.');
        if (item.versions.length > old.versions.length) requireThat(item.versions.at(-1).createdBy === authorId, 'A new version must identify the current coach.');
      }
    }
    for (const item of next[collection].filter((entry) => !previous[collection].some((old) => old.id === entry.id))) {
      requireThat(item.createdBy === authorId, 'New records must identify the current coach.');
      if (collection === 'plans') requireThat(item.versions.length === 1 && item.versions[0].createdBy === authorId && item.versions[0].createdAt === item.createdAt && item.versions[0].status === 'active', 'New plans must begin with one active version.');
    }
  }
  return next;
}

export function checkDevelopmentFit(version, player, allowBunting) {
  if (!player || player.archived) throw new Error('Choose an active player from this team.');
  for (const snapshot of [version.practice, version.home, version.alternateHome].filter(Boolean)) {
    if (player.age != null && (player.age < snapshot.minAge || player.age > snapshot.maxAge)) throw new Error(`${snapshot.title} is for ages ${snapshot.minAge}–${snapshot.maxAge}. Choose an activity that fits ${player.name}.`);
    if (snapshot.requiresBunting && !allowBunting) throw new Error('Confirm this division permits bunting before assigning this activity.');
  }
}

/** Family handouts deliberately exclude identifiers, private notes and review history. */
export function createDevelopmentHandout(plan, { alternate = false } = {}) {
  const version = getCurrentPlanVersion(plan); const drill = alternate ? version.alternateHome : version.home;
  if (!drill) throw new Error('This plan has no selected home challenge.');
  validateDrillSnapshot(drill, 'home');
  return ['Diamond Live · My home challenge', drill.title, `My goal: ${version.goal}`, `Ages ${drill.minAge}–${drill.maxAge} · Up to ${drill.minutes} minutes. Finish sooner whenever needed.`,
    ...(version.followUpDate ? [`Optional check-in: ${version.followUpDate}`] : []),
    `Helper: ${drill.helper === 'solo' ? 'No partner needed; an adult checks the space and readiness first.' : drill.helper === 'partner' ? 'A partner; an adult checks first.' : 'Adult supervision required.'}`,
    `You need: ${drill.equipment}`, `Set up: ${drill.setup}`, ...drill.steps.map((step,index) => `${index+1}. ${step}`), `One cue: ${drill.cue}`, `My challenge: ${drill.challenge}`, `Make it easier: ${drill.easier}`, `Before starting: ${drill.safetyNote}`,
    'Choose → Play → Score (optional) → Celebrate → Level up. Repeat an easy level, choose a different game, or finish. Never add throws or exercise to earn points.',
    'I tried it / I need help / I chose another activity / Not today', 'Something I noticed: ____________________   A question for my coach: ____________________', 'Fun today: 🙂 / 😐 / 🙁',
    'Completing this card does not change a player rating. Bring your notes to practice; this card does not submit anything online.',
    ...(drill.sourceGuide ? [`Adapted from: ${drill.sourceGuide} · ${drill.sourceActivity}`] : []), ...(drill.sourceUrl ? [`Fundamental reference: ${drill.sourceUrl}`] : []),
  ].join('\n\n');
}

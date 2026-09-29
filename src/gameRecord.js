import { FIXTURE, PLAYERS, POSITIONS, ROLES } from "./data.js";
import { batterLabel, createSaturday, reduce } from "./game.js";

export const SCHEMA_VERSION = 1;
export const ENGINE_VERSION = "saturday-demo-v1";
export const RULES_VERSION = "demo-six-innings-v1";
const PITCHES = ["ball", "strike", "foul", "out", "K", "1B", "2B", "3B", "HR"];
const UNDO_REASON = "Scorer undid the last pitch";
const copy = (value) => JSON.parse(JSON.stringify(value));
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const id = (value) => typeof value === "string" && value.length > 0;
const date = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function equal(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
function withoutPast(state) {
  return { ...state, past: [] };
}

function validateState(state) {
  requireValue(object(state), "The game checkpoint is missing.");
  requireValue(["pregame", "live", "final"].includes(state.status) && ["top", "bottom"].includes(state.half), "Invalid game status or half inning.");
  for (const field of ["inning", "visitorScore", "homeScore", "pitches", "hawksBatterIndex", "breakersBatterIndex"]) {
    requireValue(integer(state[field], field === "inning" ? 1 : 0), `Invalid checkpoint ${field}.`);
  }
  requireValue(integer(state.outs, 0, 2) && integer(state.balls, 0, 3) && integer(state.strikes, 0, 2), "Invalid checkpoint count.");
  requireValue(Array.isArray(state.bases) && state.bases.length === 3 && state.bases.every((base) => typeof base === "boolean"), "Invalid checkpoint bases.");
  requireValue(Array.isArray(state.lineup) && state.lineup.length > 0 && state.lineup.every(id) && Array.isArray(state.bench) && state.bench.every(id), "Invalid checkpoint lineup.");
  const roster = [...state.lineup, ...state.bench];
  requireValue(new Set(roster).size === roster.length, "Duplicate checkpoint player.");
  requireValue(object(state.arrived) && object(state.positions) && roster.every((player) => typeof state.arrived[player] === "boolean" && POSITIONS.includes(state.positions[player])), "Invalid checkpoint player details.");
  requireValue(Array.isArray(state.clips) && state.clips.every((clip) => object(clip) && id(clip.id) && id(clip.label) && typeof clip.detail === "string" && ["needed", "shot", "uploaded"].includes(clip.status)), "Invalid checkpoint clips.");
  requireValue(["here", "on-the-way", "running-late"].includes(state.jordanStatus) && typeof state.snackConfirmed === "boolean" && typeof state.dugoutNote === "string", "Invalid checkpoint team updates.");
  requireValue(Array.isArray(state.log) && state.log.every((line) => typeof line === "string"), "Invalid checkpoint tape.");
}

export function createRecord({ id: gameId, createdAt, initialState = createSaturday(), origin = "new" }) {
  requireValue(id(gameId) && date(createdAt), "A game ID and creation time are required.");
  requireValue(["new", "legacy-snapshot"].includes(origin), "Unknown checkpoint origin.");
  validateState(initialState);
  const checkpoint = copy(withoutPast(initialState));
  checkpoint.fixture = copy(initialState.fixture ?? FIXTURE);
  checkpoint.players = copy(initialState.players ?? PLAYERS);
  // Occupied legacy bases have no recoverable player identity.
  checkpoint.runners = initialState.runners ? copy(initialState.runners) : checkpoint.bases.map((occupied, index) => occupied ? { runnerId: `${gameId}:checkpoint-base-${index + 1}`, playerId: null } : null);
  const record = {
    schemaVersion: SCHEMA_VERSION, engineVersion: ENGINE_VERSION, rulesVersion: RULES_VERSION,
    id: gameId, createdAt, origin, initialState: checkpoint, events: [],
  };
  replayRecord(record);
  return record;
}

function validateAction(action) {
  requireValue(object(action), "A scoring action is required.");
  const fields = {
    start: [], pitch: ["kind"], move: ["id", "direction"], arrival: ["id"], position: ["id", "position"],
    bench: ["id"], activate: ["id"], note: ["note"], clip: ["id"], jordan: ["status"], snack: [],
  };
  requireValue(Object.hasOwn(fields, action.type), "Unsupported action. Only the latest pitch can be undone; historical corrections are not supported yet.");
  requireValue(equal(Object.keys(action).sort(), ["type", ...fields[action.type]].sort()), "Invalid action fields.");
  if (fields[action.type].includes("id")) requireValue(id(action.id), "A player or clip ID is required.");
  if (action.type === "pitch") requireValue(PITCHES.includes(action.kind), "Unknown pitch outcome.");
  if (action.type === "move") requireValue([-1, 1].includes(action.direction), "Invalid lineup move.");
  if (action.type === "position") requireValue(POSITIONS.includes(action.position), "Invalid field position.");
  if (action.type === "note") requireValue(typeof action.note === "string" && action.note.length <= 180, "Notes must be 180 characters or fewer.");
  if (action.type === "jordan") requireValue(["here", "on-the-way", "running-late"].includes(action.status), "Invalid arrival status.");
}

function metadata(input) {
  requireValue(object(input) && id(input.id) && date(input.recordedAt), "An event ID and recorded time are required.");
  requireValue(input.occurredAt == null || date(input.occurredAt), "Invalid play occurrence time.");
  requireValue(object(input.actor) && id(input.actor.id) && ROLES.some((role) => role.id === input.actor.role), "An event actor and demo role are required.");
  return { id: input.id, recordedAt: input.recordedAt, occurredAt: input.occurredAt ?? null, actor: { id: input.actor.id, role: input.actor.role } };
}

function apply(state, action, eventId) {
  validateAction(action);
  const reduced = reduce(state, action);
  if (reduced === state) return { state, play: null };
  let next = withoutPast(reduced);
  if (action.type !== "pitch") return { state: next, play: null };
  const batterId = state.half === "bottom" ? state.lineup[state.hawksBatterIndex % state.lineup.length] : `demo-visitor-${state.breakersBatterIndex % 9 + 1}`;
  const outcome = action.kind === "ball" && state.balls === 3 ? "walk" : action.kind === "strike" && state.strikes === 2 ? "K" : action.kind;
  const movements = [];
  const runners = [...state.runners];
  function move(runner, from, to) {
    if (runner) movements.push({ ...runner, from, to });
  }
  const batter = { runnerId: `${eventId}:runner`, playerId: batterId };
  if (outcome === "walk") {
    if (runners[0]) {
      if (runners[1]) {
        move(runners[2], 3, "home");
        move(runners[1], 2, 3);
        runners[2] = runners[1];
      }
      move(runners[0], 1, 2);
      runners[1] = runners[0];
    }
    move(batter, "batter", 1);
    runners[0] = batter;
  } else if (["1B", "2B", "3B", "HR"].includes(outcome)) {
    const distance = { "1B": 1, "2B": 2, "3B": 3, HR: 4 }[outcome];
    runners.fill(null);
    state.runners.forEach((runner, index) => {
      const destination = index + 1 + distance;
      move(runner, index + 1, destination >= 4 ? "home" : destination);
      if (runner && destination < 4) runners[destination - 1] = runner;
    });
    move(batter, "batter", distance === 4 ? "home" : distance);
    if (distance < 4) runners[distance - 1] = batter;
  } else if (["out", "K"].includes(outcome)) {
    move(batter, "batter", "out");
    if (state.outs === 2) {
      runners.forEach((runner, index) => move(runner, index + 1, "left-on-base"));
      runners.fill(null);
    }
  }
  next = { ...next, runners };
  requireValue(equal(runners.map(Boolean), next.bases), "Runner projection does not match the scorebook.");
  const runs = next.homeScore + next.visitorScore - state.homeScore - state.visitorScore;
  return { state: next, play: { inning: state.inning, half: state.half, batterId, batterName: batterLabel(state), balls: state.balls, strikes: state.strikes, outs: state.outs, outcome, runs, movements } };
}

function validateHeader(record) {
  requireValue(object(record) && record.schemaVersion === SCHEMA_VERSION && record.engineVersion === ENGINE_VERSION && record.rulesVersion === RULES_VERSION, "Unsupported game record version. The saved game has been preserved.");
  requireValue(id(record.id) && date(record.createdAt) && ["new", "legacy-snapshot"].includes(record.origin) && Array.isArray(record.events), "Invalid game record header.");
  validateState(record.initialState);
  const state = record.initialState;
  requireValue(object(state.fixture) && state.fixture.innings === 6, "This record requires the six-inning demo rules.");
  requireValue(Array.isArray(state.players) && state.players.every((player) => object(player) && id(player.id) && id(player.name)) && new Set(state.players.map((player) => player.id)).size === state.players.length && [...state.lineup, ...state.bench].every((playerId) => state.players.some((player) => player.id === playerId)), "Invalid frozen player roster.");
  requireValue(Array.isArray(state.runners) && state.runners.length === 3 && state.runners.every((runner, index) => state.bases[index] ? object(runner) && id(runner.runnerId) && (runner.playerId === null || id(runner.playerId)) : runner === null), "Invalid checkpoint runner identities.");
  const runnerIds = state.runners.filter(Boolean).map((runner) => runner.runnerId);
  requireValue(new Set(runnerIds).size === runnerIds.length, "Duplicate checkpoint runner.");
}

// Sequence, rather than the phone clock, determines event order. Voids rebuild
// only the active actions and never erase the original event or its attribution.
function replay(record) {
  validateHeader(record);
  let state = copy(withoutPast(record.initialState));
  let active = [];
  const seen = new Set();
  record.events.forEach((event, index) => {
    const meta = metadata(event);
    requireValue(!seen.has(meta.id) && event.gameId === record.id && event.sequence === index + 1 && event.occurredAt !== undefined, "Invalid event identity or sequence.");
    seen.add(meta.id);
    if (event.type === "action") {
      const result = apply(state, event.action, event.id);
      requireValue(result.state !== state, "A recorded action has no effect in this game context.");
      requireValue(equal(result.play, event.play), "Recorded play does not match its game context.");
      state = result.state;
      active.push(event);
    } else if (event.type === "pitch-voided") {
      const last = active.findLast((item) => item.action.type === "pitch");
      requireValue(last && last.id === event.targetEventId && event.reason === UNDO_REASON, "Only the latest active pitch can be undone. Undo later pitches first.");
      active = active.filter((item) => item.id !== last.id);
      state = copy(withoutPast(record.initialState));
      for (const item of active) {
        const result = apply(state, item.action, item.id);
        requireValue(result.state !== state, "Undo would invalidate a later action.");
        state = result.state;
      }
    } else throw new Error("Unknown game event type.");
  });
  return { state, active };
}

export function replayRecord(record) {
  return replay(record).state;
}

export function lastPitch(record) {
  return replay(record).active.findLast((event) => event.action.type === "pitch") ?? null;
}

export function appendAction(record, action, input) {
  const meta = metadata(input);
  validateAction(action);
  const { state } = replay(record);
  const existing = record.events.find((event) => event.id === meta.id);
  if (existing) {
    requireValue(existing.type === "action" && equal(metadata(existing), meta) && equal(existing.action, action), "This event ID was already used for a different action.");
    return record;
  }
  const result = apply(state, action, meta.id);
  if (result.state === state) return record;
  const event = { ...meta, gameId: record.id, sequence: record.events.length + 1, type: "action", action: copy(action), play: result.play };
  return { ...record, events: [...record.events, event] };
}

export function undoPitch(record, input) {
  const meta = metadata(input);
  const existing = record.events.find((event) => event.id === meta.id);
  if (existing) {
    replay(record);
    requireValue(existing.type === "pitch-voided" && equal(metadata(existing), meta), "This event ID was already used for a different action.");
    return record;
  }
  const target = lastPitch(record);
  if (!target) return record;
  const event = { ...meta, gameId: record.id, sequence: record.events.length + 1, type: "pitch-voided", targetEventId: target.id, reason: UNDO_REASON };
  const next = { ...record, events: [...record.events, event] };
  replayRecord(next);
  return next;
}

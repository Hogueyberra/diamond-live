import { CLIP_TEMPLATE, FIXTURE, PLAYERS } from "./data.js";

const ABILITIES = {
  coach: new Set(["lineup", "arrivals", "note", "start"]),
  scorekeeper: new Set(["score", "start", "undo"]),
  videographer: new Set(["film"]),
  parent: new Set(["family"]),
};

const CLIP_CYCLE = ["needed", "shot", "uploaded"];

export function can(role, ability) {
  return ABILITIES[role]?.has(ability) ?? false;
}

export function createSaturday() {
  const arrived = {};
  for (const player of PLAYERS) {
    arrived[player.id] = player.id !== "miles" && player.id !== "andre";
  }
  return {
    status: "pregame",
    inning: 1,
    half: "top",
    outs: 0,
    balls: 0,
    strikes: 0,
    visitorScore: 0,
    homeScore: 0,
    bases: [false, false, false],
    pitches: 0,
    hawksBatterIndex: 0,
    breakersBatterIndex: 0,
    lineup: ["mateo", "leo", "jonah", "eli", "nico", "samir", "owen", "kai", "benny"],
    bench: ["caleb", "miles", "andre"],
    positions: Object.fromEntries(PLAYERS.map((player) => [player.id, player.pos])),
    arrived,
    clips: CLIP_TEMPLATE.map((clip) => ({ ...clip, status: "needed" })),
    jordanStatus: "on-the-way",
    snackConfirmed: false,
    dugoutNote: "Mateo leads off. Leo starts. Keep the infield on the grass.",
    log: ["Saturday morning. Book is clean. First pitch 10:00."],
    past: [],
  };
}

export function inningLabel(state) {
  return `${state.half === "top" ? "Top" : "Bot"} ${state.inning}`;
}

export function batterLabel(state, players = PLAYERS) {
  if (state.half === "bottom") {
    const id = state.lineup[state.hawksBatterIndex % state.lineup.length];
    const player = players.find((item) => item.id === id);
    return player ? `${player.name}` : "Hawks batter";
  }
  return `Breakers batter ${(state.breakersBatterIndex % 9) + 1}`;
}

export function familyBlurb(state) {
  const spot = state.lineup.indexOf(FIXTURE.childId);
  const spotLabel = spot >= 0 ? `${spot + 1} in the order` : "on the bench";
  const here = state.arrived[FIXTURE.childId] ? "Mateo is at the field" : "Mateo has not checked in";
  const jordan = {
    here: "Jordan is here",
    "on-the-way": "Jordan is on the way with orange slices",
    "running-late": "Jordan is running late",
  }[state.jordanStatus];
  const snack = state.snackConfirmed ? "Oranges are at the snack table." : "Snack is not at the table yet.";
  const score =
    state.status === "pregame"
      ? "First pitch is 10:00. No score yet."
      : `Hawks ${state.homeScore}, Breakers ${state.visitorScore}.`;
  return `${score} ${here}, ${spotLabel}. ${jordan}. ${snack}`;
}

function snapshot(state) {
  const { past, ...rest } = state;
  return {
    ...rest,
    bases: [...rest.bases],
    lineup: [...rest.lineup],
    bench: [...rest.bench],
    positions: { ...rest.positions },
    arrived: { ...rest.arrived },
    clips: rest.clips.map((clip) => ({ ...clip })),
    log: [...rest.log],
  };
}

function commit(prev, next) {
  return { ...next, past: [...(prev.past || []), snapshot(prev)].slice(-25) };
}

function addLog(state, line) {
  return { ...state, log: [...state.log, line].slice(-14) };
}

function bumpPitch(state) {
  return state.half === "top" ? state.pitches + 1 : state.pitches;
}

function walkBases(bases) {
  const [first, second, third] = bases;
  if (!first) return { bases: [true, second, third], scored: 0 };
  if (!second) return { bases: [true, true, third], scored: 0 };
  if (!third) return { bases: [true, true, true], scored: 0 };
  return { bases: [true, true, true], scored: 1 };
}

function applyHit(bases, result) {
  const [first, second, third] = bases;
  const occupied = (on) => (on ? 1 : 0);
  if (result === "HR") {
    return { bases: [false, false, false], scored: 1 + occupied(first) + occupied(second) + occupied(third) };
  }
  if (result === "3B") {
    return { bases: [false, false, true], scored: occupied(first) + occupied(second) + occupied(third) };
  }
  if (result === "2B") {
    return { bases: [false, true, first], scored: occupied(second) + occupied(third) };
  }
  return { bases: [true, first, second], scored: occupied(third) };
}

function endHalf(state) {
  const cleared = { ...state, outs: 0, balls: 0, strikes: 0, bases: [false, false, false] };
  if (state.half === "top") {
    if (state.inning >= FIXTURE.innings && state.homeScore > state.visitorScore) {
      return addLog({ ...cleared, status: "final" }, "Hawks lead after 6. No bottom. Final.");
    }
    return addLog({ ...cleared, half: "bottom" }, `End of the top of the ${state.inning}. Hawks hit.`);
  }
  if (state.inning >= FIXTURE.innings) {
    return addLog({ ...cleared, status: "final" }, "Six innings in the book. Final.");
  }
  return addLog({ ...cleared, half: "top", inning: state.inning + 1 }, `End of the bottom of the ${state.inning}.`);
}

function afterPlay(state) {
  if (state.outs >= 3) return endHalf(state);
  if (
    state.status === "live" &&
    state.half === "bottom" &&
    state.inning >= FIXTURE.innings &&
    state.homeScore > state.visitorScore
  ) {
    return addLog({ ...state, status: "final" }, "Walk-off. Hawks take it.");
  }
  return state;
}

function finishPa(state, { bases, scored, pitches, extraOuts, result }) {
  const runText = scored ? `, ${scored} ${scored === 1 ? "run" : "runs"}` : "";
  const next = {
    ...state,
    bases,
    balls: 0,
    strikes: 0,
    outs: state.outs + extraOuts,
    pitches,
    visitorScore: state.visitorScore + (state.half === "top" ? scored : 0),
    homeScore: state.homeScore + (state.half === "bottom" ? scored : 0),
    breakersBatterIndex: state.half === "top" ? state.breakersBatterIndex + 1 : state.breakersBatterIndex,
    hawksBatterIndex: state.half === "bottom" ? state.hawksBatterIndex + 1 : state.hawksBatterIndex,
    log: [...state.log, `${inningLabel(state)}: ${batterLabel(state)} ${result}${runText}.`].slice(-14),
  };
  return commit(state, afterPlay(next));
}

export function startGame(state) {
  if (state.status !== "pregame") return state;
  return commit(state, addLog({ ...state, status: "live" }, "First pitch. Breakers are up."));
}

export function undo(state) {
  if (!state.past?.length) return state;
  const past = state.past.slice(0, -1);
  return { ...state.past[state.past.length - 1], past };
}

export function recordPitch(state, kind) {
  if (state.status !== "live") return state;
  if (kind === "ball") {
    const pitches = bumpPitch(state);
    const balls = state.balls + 1;
    if (balls >= 4) {
      const walked = walkBases(state.bases);
      return finishPa(state, { ...walked, pitches, extraOuts: 0, result: "walks" });
    }
    return commit(state, { ...state, balls, pitches });
  }
  if (kind === "strike") {
    const pitches = bumpPitch(state);
    const strikes = state.strikes + 1;
    if (strikes >= 3) {
      return finishPa(state, { bases: state.bases, scored: 0, pitches, extraOuts: 1, result: "strikes out" });
    }
    return commit(state, { ...state, strikes, pitches });
  }
  if (kind === "foul") {
    const pitches = bumpPitch(state);
    const strikes = state.strikes >= 2 ? 2 : state.strikes + 1;
    return commit(state, { ...state, strikes, pitches });
  }
  if (kind === "out" || kind === "K") {
    return finishPa(state, {
      bases: state.bases,
      scored: 0,
      pitches: bumpPitch(state),
      extraOuts: 1,
      result: kind === "K" ? "strikes out" : "is out in play",
    });
  }
  if (kind === "1B" || kind === "2B" || kind === "3B" || kind === "HR") {
    const words = { "1B": "singles", "2B": "doubles", "3B": "triples", HR: "homers" };
    const hit = applyHit(state.bases, kind);
    return finishPa(state, { ...hit, pitches: bumpPitch(state), extraOuts: 0, result: words[kind] });
  }
  return state;
}

export function moveInLineup(state, id, direction) {
  const index = state.lineup.indexOf(id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= state.lineup.length) return state;
  const lineup = [...state.lineup];
  const [player] = lineup.splice(index, 1);
  lineup.splice(nextIndex, 0, player);
  return commit(state, { ...state, lineup });
}

export function toggleArrival(state, id) {
  if (!(id in state.arrived)) return state;
  return commit(state, { ...state, arrived: { ...state.arrived, [id]: !state.arrived[id] } });
}

export function setPosition(state, id, position) {
  if (!(id in state.positions) || state.positions[id] === position) return state;
  return commit(state, { ...state, positions: { ...state.positions, [id]: position } });
}

export function addToLineup(state, id) {
  if (!state.bench.includes(id)) return state;
  return commit(state, {
    ...state,
    bench: state.bench.filter((playerId) => playerId !== id),
    lineup: [...state.lineup, id],
  });
}

export function parkOnBench(state, id) {
  const index = state.lineup.indexOf(id);
  if (index < 0 || state.lineup.length <= 9) return state;
  const lineup = state.lineup.filter((playerId) => playerId !== id);
  const hawksBatterIndex = index < state.hawksBatterIndex ? state.hawksBatterIndex - 1 : state.hawksBatterIndex;
  return commit(state, { ...state, lineup, bench: [...state.bench, id], hawksBatterIndex });
}

export function setNote(state, note) {
  if (state.dugoutNote === note) return state;
  return commit(state, { ...state, dugoutNote: note.slice(0, 180) });
}

export function cycleClip(state, id) {
  const clip = state.clips.find((item) => item.id === id);
  if (!clip) return state;
  const nextStatus = CLIP_CYCLE[(CLIP_CYCLE.indexOf(clip.status) + 1) % CLIP_CYCLE.length];
  return commit(state, {
    ...state,
    clips: state.clips.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)),
  });
}

export function setJordan(state, status) {
  if (state.jordanStatus === status) return state;
  return commit(state, { ...state, jordanStatus: status });
}

export function toggleSnack(state) {
  return commit(state, { ...state, snackConfirmed: !state.snackConfirmed });
}

export function reduce(state, action) {
  switch (action.type) {
    case "reset":
      return createSaturday();
    case "start":
      return startGame(state);
    case "undo":
      return undo(state);
    case "pitch":
      return recordPitch(state, action.kind);
    case "move":
      return moveInLineup(state, action.id, action.direction);
    case "arrival":
      return toggleArrival(state, action.id);
    case "position":
      return setPosition(state, action.id, action.position);
    case "bench":
      return parkOnBench(state, action.id);
    case "activate":
      return addToLineup(state, action.id);
    case "note":
      return setNote(state, action.note);
    case "clip":
      return cycleClip(state, action.id);
    case "jordan":
      return setJordan(state, action.status);
    case "snack":
      return toggleSnack(state);
    default:
      return state;
  }
}

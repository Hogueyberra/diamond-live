import { useEffect, useRef, useState } from "react";
export { RATING_ANCHORS } from "../scouting.js";

export const ASSESSMENT_KEY = "diamond-live:prototype:player-assessments:v1";
export const ASSESSMENT_SKILLS = [
  { id: "hitting", label: "Hitting", cue: "Balance, repeatable swing, and contact." },
  { id: "throwing", label: "Throwing", cue: "Balanced motion and throws to the intended target." },
  { id: "fielding", label: "Fielding", cue: "Ready position, footwork, and securing the ball." },
  { id: "baserunning", label: "Baserunning", cue: "Base awareness, turns, and decisions." },
];
export const ASSESSMENT_CONTEXTS = ["Practice", "Game", "Tryout", "Other"];
export const emptyAssessmentRatings = () =>
  Object.fromEntries(ASSESSMENT_SKILLS.map(({ id }) => [id, null]));
// Fictional baseline examples on the existing scouting 1–10 scale. These are
// category observations, not conversions of any saved team scouting records.
export const DEMO_PLAYERS = [
  {
    id: 12,
    name: "Noah Martinez",
    position: "Shortstop · R/R",
    status: "Plan ready",
    focus: "Ground-ball footwork",
    skills: [6, 8, 4, null],
    note: "Gets to the ball early. Work on setting the feet before the throw.",
    goal: "Set feet and make an accurate throw on 8 of 10 routine grounders.",
  },
  {
    id: 7,
    name: "Eli Thompson",
    position: "Catcher · R/R",
    status: "Needs observation",
    focus: "Receiving",
    skills: [null, 6, null, 6],
    note: "Receiving and throwing need a fresh observation at the next practice.",
    goal: "Record a receiving observation during the next bullpen.",
  },
  {
    id: 22,
    name: "Lucas Chen",
    position: "Center field · L/R",
    status: "On track",
    focus: "First-step reads",
    skills: [8, 6, 8, null],
    note: "Consistent first step on fly balls during the last fielding station.",
    goal: "Repeat a balanced first step on five consecutive fly-ball reads.",
  },
  {
    id: 4,
    name: "Mason Brooks",
    position: "Second base · R/R",
    status: "Plan ready",
    focus: "Contact point",
    skills: [4, 6, 6, 6],
    note: "Contact drifts behind the front foot. Start with a simple tee progression.",
    goal: "Find a repeatable contact point in front of the plate.",
  },
  {
    id: 18,
    name: "Oliver Davis",
    position: "Pitcher · R/R",
    status: "On track",
    focus: "Throwing accuracy",
    skills: [6, 8, null, 8],
    note: "Accurate throws to a target during the partner throwing station.",
    goal: "Maintain a consistent target through the full throwing progression.",
  },
  {
    id: 9,
    name: "Leo Wilson",
    position: "Left field · L/L",
    status: "Needs observation",
    focus: "Baserunning",
    skills: [6, null, 6, null],
    note: "Baserunning has not been observed in this example assessment.",
    goal: "Observe a first-to-third decision in a practice situation.",
  },
];

export function localAssessmentDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function formatAssessmentDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function validDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) > 0 &&
    Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  );
}
function validateRecord(record) {
  if (
    !record ||
    typeof record !== "object" ||
    !DEMO_PLAYERS.some((player) => player.id === record.playerId)
  )
    throw new Error("Choose a player from this prototype roster.");
  if (
    typeof record.id !== "string" ||
    !record.id ||
    !Number.isFinite(Date.parse(record.recordedAt))
  )
    throw new Error("The assessment record is invalid.");
  if (!validDate(record.observedOn)) throw new Error("Enter a valid observation date.");
  if (typeof record.coach !== "string" || !record.coach.trim() || record.coach.length > 80)
    throw new Error("Enter a coach name of up to 80 characters.");
  if (!ASSESSMENT_CONTEXTS.includes(record.context))
    throw new Error("Choose the observation setting.");
  if (typeof record.notes !== "string" || !record.notes.trim() || record.notes.length > 1500)
    throw new Error("Add a short observation explaining the ratings (up to 1,500 characters).");
  if (!record.ratings || Object.keys(record.ratings).length !== ASSESSMENT_SKILLS.length)
    throw new Error("The skill ratings are incomplete.");
  for (const { id } of ASSESSMENT_SKILLS) {
    const value = record.ratings[id];
    if (value !== null && (!Number.isInteger(value) || value < 1 || value > 10))
      throw new Error("Ratings must be whole numbers from 1 to 10, or not observed.");
  }
  if (!ASSESSMENT_SKILLS.some(({ id }) => record.ratings[id] !== null))
    throw new Error("Rate at least one skill you observed today.");
  return record;
}
export function makeAssessment(input) {
  if (input.observedOn > localAssessmentDate())
    throw new Error("An observation date cannot be in the future.");
  return validateRecord({
    id: crypto.randomUUID(),
    playerId: input.playerId,
    observedOn: input.observedOn,
    recordedAt: new Date().toISOString(),
    coach: String(input.coach || "").trim(),
    context: input.context,
    notes: String(input.notes || "").trim(),
    ratings: { ...input.ratings },
  });
}
export function assessmentHistory(playerId, records) {
  const player = DEMO_PLAYERS.find((item) => item.id === playerId);
  if (!player) return [];
  const sample = {
    id: `sample-${player.id}`,
    playerId,
    observedOn: "2026-10-14",
    recordedAt: "2026-10-14T12:00:00.000Z",
    coach: "Coach Jordan",
    context: "Practice",
    notes: player.note,
    sample: true,
    ratings: Object.fromEntries(
      ASSESSMENT_SKILLS.map(({ id }, index) => [id, player.skills[index]]),
    ),
  };
  // A backdated observation belongs in history, but cannot replace a newer one.
  return [sample, ...records.filter((record) => record.playerId === playerId)].sort(
    (a, b) =>
      b.observedOn.localeCompare(a.observedOn) ||
      b.recordedAt.localeCompare(a.recordedAt) ||
      b.id.localeCompare(a.id),
  );
}
export function playerSnapshot(playerId, records) {
  const history = assessmentHistory(playerId, records);
  return Object.fromEntries(
    ASSESSMENT_SKILLS.map(({ id }) => {
      const source = history.find((record) => record.ratings[id] !== null);
      const previous =
        source &&
        history.slice(history.indexOf(source) + 1).find((record) => record.ratings[id] !== null);
      return [
        id,
        { value: source?.ratings[id] ?? null, source, previous: previous?.ratings[id] ?? null },
      ];
    }),
  );
}
function readAssessments() {
  let raw;
  try {
    raw = window.localStorage.getItem(ASSESSMENT_KEY);
  } catch {
    return { records: [], persistent: false, corrupt: false };
  }
  try {
    if (!raw) return { records: [], persistent: true, corrupt: false };
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || !Array.isArray(parsed.records) || parsed.records.length > 1000)
      throw new Error();
    const records = parsed.records.map(validateRecord);
    if (new Set(records.map((record) => record.id)).size !== records.length) throw new Error();
    return { records, persistent: true, corrupt: false };
  } catch {
    return { records: [], persistent: false, corrupt: true };
  }
}
export function usePlayerAssessments() {
  const [state, setState] = useState(readAssessments);
  const current = useRef(state);
  current.current = state;
  useEffect(() => {
    function sync(event) {
      if ((event.key === ASSESSMENT_KEY || event.key === null) && current.current.persistent) {
        current.current = readAssessments();
        setState(current.current);
      }
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return {
    ...state,
    add(input) {
      const record = makeAssessment(input);
      const disk = readAssessments();
      if (disk.corrupt || current.current.corrupt)
        throw new Error(
          "Saved assessments could not be read. Existing data has been kept; resolve the browser data issue before saving.",
        );
      // Merge append-only observations from other tabs; retain any failed local writes.
      const records = [
        ...new Map(
          [...disk.records, ...current.current.records].map((item) => [item.id, item]),
        ).values(),
      ];
      if (records.length >= 1000)
        throw new Error("This prototype has reached its 1,000-observation limit.");
      records.push(record);
      let persistent = true;
      try {
        window.localStorage.setItem(ASSESSMENT_KEY, JSON.stringify({ version: 1, records }));
      } catch {
        persistent = false;
      }
      current.current = { records, persistent, corrupt: false };
      setState(current.current);
      return { record, persistent };
    },
  };
}

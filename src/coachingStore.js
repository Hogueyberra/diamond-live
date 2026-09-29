import { useCallback, useEffect, useState } from "react";

export const COACHING_KEY = "diamond-live.coaching.v1";
const COLLECTIONS = ["teams", "events", "observations", "activities"];

function plainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireValid(condition, detail) {
  if (!condition) throw new Error(`The coaching workspace has ${detail}.`);
}

function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function strings(item, fields) {
  return fields.every((field) => nonempty(item[field]));
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validTime(value) {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validZone(value) {
  if (!nonempty(value)) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return true; } catch { return false; }
}

function validateRecords(data) {
  requireValid(data.teams.length > 0, "no teams");
  for (const collection of COLLECTIONS) {
    const identifiers = data[collection].map((item) => item.id);
    requireValid(identifiers.every(nonempty) && new Set(identifiers).size === identifiers.length, `invalid or duplicate ${collection} IDs`);
  }
  const teams = new Map(data.teams.map((team) => [team.id, team]));
  const events = new Map(data.events.map((event) => [event.id, event]));
  const observations = new Map(data.observations.map((note) => [note.id, note]));
  const scoped = (item) => teams.get(item.teamId)?.seasonId === item.seasonId && nonempty(item.seasonId);
  const sameScope = (left, right) => right && left.teamId === right.teamId && left.seasonId === right.seasonId;

  for (const team of data.teams) {
    requireValid(strings(team, ["name", "division", "league", "seasonId", "season"]), "invalid team details");
  }
  for (const event of data.events) {
    requireValid(scoped(event) && strings(event, ["title", "location"]) && typeof event.notes === "string", "invalid event details or team scope");
    requireValid(["practice", "game"].includes(event.type) && ["draft", "scheduled", "completed", "cancelled"].includes(event.status), "an invalid event type or status");
    requireValid(validDate(event.date) && validTime(event.startTime) && validTime(event.endTime) && event.endTime > event.startTime && validZone(event.timeZone), "an invalid event date, time, or time zone");
  }
  for (const note of data.observations) {
    requireValid(scoped(note) && strings(note, ["title", "note", "author", "source", "createdAt"]) && Number.isFinite(Date.parse(note.createdAt)) && ["open", "planned"].includes(note.status), "invalid observation details or team scope");
    requireValid(note.eventId == null || sameScope(note, events.get(note.eventId)), "an invalid observation event reference");
  }
  for (const activity of data.activities) {
    requireValid(scoped(activity) && strings(activity, ["title", "objective", "measure"]), "invalid practice activity details or team scope");
    requireValid(Number.isInteger(activity.minutes) && activity.minutes >= 1 && activity.minutes <= 120 && typeof activity.completed === "boolean" && (activity.outcome === undefined || typeof activity.outcome === "string"), "an invalid activity duration, completion, or outcome");
    const event = events.get(activity.eventId);
    requireValid(sameScope(activity, event) && event.type === "practice", "an invalid activity practice reference");
    requireValid(activity.observationId == null || sameScope(activity, observations.get(activity.observationId)), "an invalid activity observation reference");
  }
}

function prepare(data) {
  if (!plainObject(data)) throw new Error("The coaching workspace is invalid.");
  if (data.schemaVersion !== 1) throw new Error("The coaching workspace uses an unsupported version.");
  for (const name of COLLECTIONS) {
    if (!Array.isArray(data[name]) || !data[name].every(plainObject)) {
      throw new Error(`The coaching workspace has an invalid ${name} collection.`);
    }
  }
  validateRecords(data);
  const serialized = JSON.stringify(data);
  return { data: JSON.parse(serialized), serialized };
}

// Used at the cloud boundary as well as for local backups. Never display a
// partially read or structurally invalid workspace as an empty saved team.
export function validateCoachingData(data) {
  return prepare(data).data;
}

function load(initialData) {
  const fallback = prepare(initialData);
  let raw;
  try {
    raw = window.localStorage.getItem(COACHING_KEY);
  } catch {
    return { ...fallback, dirty: false, loadError: "Browser storage is unavailable. Saved coaching data has not been changed." };
  }
  if (raw === null) return { ...fallback, dirty: false, loadError: null };
  try {
    return { ...prepare(JSON.parse(raw)), dirty: false, loadError: null };
  } catch (error) {
    const detail = error instanceof SyntaxError ? "The saved coaching workspace could not be read." : error.message;
    return { ...fallback, dirty: false, loadError: `${detail} Saved coaching data has not been changed.` };
  }
}

function saveMessage(error) {
  if (error?.name === "QuotaExceededError" || error?.name === "NS_ERROR_DOM_QUOTA_REACHED") {
    return "Browser storage is full. Coaching changes remain in this session but have not been saved.";
  }
  return "Browser storage is unavailable. Coaching changes remain in this session but have not been saved.";
}

// Mount this hook in a long-lived workspace provider so failed saves survive
// route changes. Scoring data uses a separate store and is never read or written.
export function useCoachingStore(initialData) {
  const [store, setStore] = useState(() => load(initialData));
  const [saveError, setSaveError] = useState(null);
  const [saveAttempt, setSaveAttempt] = useState(0);

  useEffect(() => {
    if (!store.dirty || store.loadError) return;
    try {
      window.localStorage.setItem(COACHING_KEY, store.serialized);
      setSaveError(null);
    } catch (error) {
      setSaveError(saveMessage(error));
    }
  }, [store, saveAttempt]);

  const setData = useCallback((update) => {
    setStore((current) => {
      // A failed read may hide a newer or damaged record. Never replace it
      // with the demo fallback, including when a caller attempts an edit.
      if (current.loadError) return current;
      const candidate = typeof update === "function" ? update(current.data) : update;
      const next = prepare(candidate);
      if (next.serialized === current.serialized) return current;
      return { ...next, dirty: true, loadError: null };
    });
  }, []);

  const retrySave = useCallback(() => {
    setSaveAttempt((attempt) => attempt + 1);
  }, []);

  const exportData = useCallback(() => {
    let url;
    let link;
    try {
      const contents = JSON.stringify(store.data, null, 2);
      url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
      link = document.createElement("a");
      link.href = url;
      link.download = "diamond-live-coaching.json";
      document.body.appendChild(link);
      link.click();
      return true;
    } catch {
      setSaveError("The coaching download could not be started. Keep this tab open and try again.");
      return false;
    } finally {
      link?.remove();
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }, [store.data]);

  return { data: store.data, setData, saveError, loadError: store.loadError, retrySave, exportData };
}

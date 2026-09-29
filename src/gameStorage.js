import { createRecord, replayRecord } from "./gameRecord.js";

export const STATE_KEY = "diamond-live-saturday-v1";
export const RECORDS_KEY = "diamond-live-records-v1";

function validateLibrary(library) {
  if (!library || typeof library !== "object" || Array.isArray(library)) {
    throw new Error("The saved game library is invalid.");
  }
  if (library.schemaVersion !== 1) {
    throw new Error("This saved game library uses an unsupported version.");
  }
  if (!Array.isArray(library.games) || library.games.length === 0) {
    throw new Error("The saved game library has no games.");
  }
  if (typeof library.activeGameId !== "string" || !library.activeGameId) {
    throw new Error("The saved game library has no active game.");
  }

  const ids = new Set();
  for (const record of library.games) {
    replayRecord(record);
    if (ids.has(record.id)) {
      throw new Error("The saved game library contains duplicate game IDs.");
    }
    ids.add(record.id);
  }
  if (!ids.has(library.activeGameId)) {
    throw new Error("The active game is missing from the saved game library.");
  }
}

function parseSaved(value) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("The saved game data could not be read.");
  }
}

// Loading never writes: callers can show an error before deciding how to recover.
export function loadLibrary(storage, { id, createdAt } = {}) {
  let records;
  let legacy;
  try {
    records = storage.getItem(RECORDS_KEY);
    if (records === null) legacy = storage.getItem(STATE_KEY);
  } catch {
    return {
      library: null,
      error: "Browser storage is unavailable. Your saved games have not been changed.",
    };
  }

  try {
    let library;
    if (records !== null) {
      library = parseSaved(records);
    } else {
      const record = legacy === null
        ? createRecord({ id, createdAt })
        : createRecord({
            id,
            createdAt,
            initialState: parseSaved(legacy),
            origin: "legacy-snapshot",
          });
      library = { schemaVersion: 1, activeGameId: record.id, games: [record] };
    }
    validateLibrary(library);
    return { library, error: null };
  } catch (error) {
    return {
      library: null,
      error: `${error.message || "The saved game library is invalid."} Your saved games have not been changed.`,
    };
  }
}

export function saveLibrary(storage, library) {
  // Validate every game, including archived games, before replacing the saved value.
  validateLibrary(library);
  let serialized;
  try {
    serialized = JSON.stringify(library);
  } catch {
    throw new Error("The game library could not be saved because its data is invalid.");
  }

  try {
    storage.setItem(RECORDS_KEY, serialized);
  } catch (error) {
    if (error?.name === "QuotaExceededError" || error?.name === "NS_ERROR_DOM_QUOTA_REACHED") {
      throw new Error("Browser storage is full. The latest changes have not been saved.");
    }
    throw new Error("Browser storage is unavailable. The latest changes have not been saved.");
  }
}

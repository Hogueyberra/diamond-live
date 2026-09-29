import { describe, expect, it, vi } from "vitest";
import { createSaturday, recordPitch, startGame } from "./game.js";
import { createRecord, replayRecord } from "./gameRecord.js";
import { loadLibrary, RECORDS_KEY, saveLibrary, STATE_KEY } from "./gameStorage.js";

const options = { id: "game-one", createdAt: "2026-09-23T17:00:00.000Z" };

function fakeStorage(values = {}) {
  const contents = new Map(Object.entries(values));
  return {
    getItem: vi.fn((key) => contents.get(key) ?? null),
    setItem: vi.fn((key, value) => contents.set(key, value)),
  };
}

function freshLibrary(id = options.id) {
  const record = createRecord({ ...options, id });
  return { schemaVersion: 1, activeGameId: id, games: [record] };
}

describe("game library storage", () => {
  it("creates a fresh in-memory library when storage is empty", () => {
    const storage = fakeStorage();
    const { library, error } = loadLibrary(storage, options);

    expect(error).toBeNull();
    expect(library.activeGameId).toBe(options.id);
    expect(library.games).toHaveLength(1);
    expect(library.games[0].origin).toBe("new");
    expect(replayRecord(library.games[0])).toMatchObject(createSaturday());
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("migrates a legacy checkpoint without deleting or rewriting its source", () => {
    const state = recordPitch(startGame(createSaturday()), "HR");
    const raw = JSON.stringify(state);
    const storage = fakeStorage({ [STATE_KEY]: raw });
    const { library, error } = loadLibrary(storage, options);

    expect(error).toBeNull();
    expect(library.games[0].origin).toBe("legacy-snapshot");
    expect(replayRecord(library.games[0])).toMatchObject({ status: "live", visitorScore: 1 });
    expect(storage.getItem(STATE_KEY)).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();

    saveLibrary(storage, library);
    expect(storage.getItem(STATE_KEY)).toBe(raw);
    expect(loadLibrary(storage, options).library).toEqual(library);
  });

  it("prefers the library over an older legacy snapshot", () => {
    const library = freshLibrary("existing-game");
    const storage = fakeStorage({
      [RECORDS_KEY]: JSON.stringify(library),
      [STATE_KEY]: "unreadable legacy data",
    });

    expect(loadLibrary(storage, options)).toEqual({ library, error: null });
    expect(storage.getItem).not.toHaveBeenCalledWith(STATE_KEY);
  });

  it("preserves previous games when the caller activates a new game", () => {
    const library = freshLibrary();
    const next = createRecord({ ...options, id: "game-two" });
    const updated = { ...library, activeGameId: next.id, games: [...library.games, next] };
    const storage = fakeStorage();

    saveLibrary(storage, updated);

    const loaded = loadLibrary(storage, options);
    expect(loaded.error).toBeNull();
    expect(loaded.library).toEqual(updated);
    expect(loaded.library.games.map((record) => record.id)).toEqual(["game-one", "game-two"]);
  });

  it.each(["{broken", "", "null", "[]", "{}"])("preserves corrupt library data: %j", (raw) => {
    const storage = fakeStorage({
      [RECORDS_KEY]: raw,
      [STATE_KEY]: JSON.stringify(createSaturday()),
    });

    const result = loadLibrary(storage, options);

    expect(result.library).toBeNull();
    expect(result.error).toMatch(/saved games have not been changed/i);
    expect(storage.getItem(RECORDS_KEY)).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("rejects an unsupported library version without falling back or overwriting", () => {
    const raw = JSON.stringify({ ...freshLibrary(), schemaVersion: 2 });
    const storage = fakeStorage({ [RECORDS_KEY]: raw });

    expect(loadLibrary(storage, options)).toEqual({
      library: null,
      error: expect.stringMatching(/unsupported version/i),
    });
    expect(storage.getItem(RECORDS_KEY)).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each(["{broken", "{}", "null"])("rejects an invalid legacy snapshot: %j", (raw) => {
    const storage = fakeStorage({ [STATE_KEY]: raw });

    const result = loadLibrary(storage, options);

    expect(result.library).toBeNull();
    expect(result.error).toBeTruthy();
    expect(storage.getItem(STATE_KEY)).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each([
    ["empty games", (library) => ({ ...library, games: [] })],
    ["missing active game", (library) => ({ ...library, activeGameId: "missing" })],
    ["duplicate IDs", (library) => ({ ...library, games: [...library.games, library.games[0]] })],
    ["invalid inactive record", (library) => ({ ...library, games: [...library.games, { id: "broken" }] })],
  ])("validates %s before loading or writing", (_name, invalidate) => {
    const library = freshLibrary();
    const invalid = invalidate(library);
    const original = JSON.stringify(library);
    const storage = fakeStorage({ [RECORDS_KEY]: original });

    expect(() => saveLibrary(storage, invalid)).toThrow();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem(RECORDS_KEY)).toBe(original);

    const result = loadLibrary(fakeStorage({ [RECORDS_KEY]: JSON.stringify(invalid) }), options);
    expect(result.library).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("returns an explicit error when storage cannot be read", () => {
    const storage = fakeStorage();
    storage.getItem.mockImplementation(() => { throw new Error("Blocked"); });

    expect(loadLibrary(storage, options)).toEqual({
      library: null,
      error: expect.stringMatching(/storage is unavailable/i),
    });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(loadLibrary(undefined, options).library).toBeNull();
  });

  it.each([
    ["QuotaExceededError", /storage is full/i],
    ["SecurityError", /storage is unavailable/i],
  ])("reports %s without losing the previous saved value", (name, message) => {
    const library = freshLibrary();
    const original = JSON.stringify(library);
    const storage = fakeStorage({ [RECORDS_KEY]: original });
    storage.setItem.mockImplementation(() => {
      const error = new Error("Unable to save");
      error.name = name;
      throw error;
    });

    expect(() => saveLibrary(storage, library)).toThrow(message);
    expect(storage.getItem(RECORDS_KEY)).toBe(original);
  });
});

// @vitest-environment jsdom

import { createElement, StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COACHING_KEY, useCoachingStore } from "./coachingStore.js";

const SCORING_KEY = "diamond-live-records-v1";
const LEGACY_SCORING_KEY = "diamond-live-saturday-v1";

function initialData() {
  return {
    schemaVersion: 1,
    teams: [{ id: "angels-demo", name: "Angels — demo", division: "Minor B", league: "Sample league", seasonId: "fall-2026", season: "Fall 2026" }],
    events: [],
    observations: [],
    activities: [],
  };
}

function practice(overrides = {}) {
  return {
    id: "practice-one", teamId: "angels-demo", seasonId: "fall-2026", type: "practice", status: "scheduled",
    title: "Team practice", location: "Practice field", date: "2026-09-30", startTime: "16:30", endTime: "17:30",
    timeZone: "America/Los_Angeles", notes: "", ...overrides,
  };
}

function observation(overrides = {}) {
  return {
    id: "observation-one", teamId: "angels-demo", seasonId: "fall-2026", title: "Ready position",
    note: "Work on ready position.", author: "Coach", createdAt: "2026-09-28T17:00:00Z",
    source: "Coach observation", status: "open", ...overrides,
  };
}

function activity(overrides = {}) {
  return {
    id: "activity-one", teamId: "angels-demo", seasonId: "fall-2026", eventId: "practice-one",
    title: "Ground balls", objective: "Set the feet before throwing.", measure: "Five controlled repetitions.",
    minutes: 10, completed: false, ...overrides,
  };
}

function linkedData() {
  return {
    ...initialData(), events: [practice()], observations: [observation()],
    activities: [activity({ observationId: "observation-one" })],
  };
}

function strictWrapper({ children }) {
  return createElement(StrictMode, null, children);
}

function mountStore(seed = initialData()) {
  return renderHook(() => useCoachingStore(seed), { wrapper: strictWrapper });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe("coaching workspace storage", () => {
  it("keeps initial data in memory without writing during Strict Mode mounting or a no-op update", () => {
    const seed = initialData();
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const { result } = mountStore(seed);
    expect(result.current.data).toEqual(seed);
    expect(result.current.data).not.toBe(seed);
    expect(result.current.loadError).toBeNull();

    act(() => result.current.setData((data) => ({ ...data })));
    act(() => result.current.retrySave());

    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem(COACHING_KEY)).toBeNull();
  });

  it("persists edits across reload without reading or writing either scoring key", () => {
    localStorage.setItem(SCORING_KEY, "existing scoring archive");
    localStorage.setItem(LEGACY_SCORING_KEY, "legacy scoring snapshot");
    const reads = vi.spyOn(Storage.prototype, "getItem");
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const store = mountStore();

    act(() => store.result.current.setData((data) => ({
      ...data,
      events: [...data.events, practice()],
    })));
    act(() => store.result.current.setData((data) => ({
      ...data,
      observations: [observation({ eventId: "practice-one" })],
    })));
    const saved = store.result.current.data;
    expect(store.result.current.saveError).toBeNull();
    store.unmount();
    const restored = mountStore();

    expect(restored.result.current.data).toEqual(saved);
    expect(writes.mock.calls.every(([key]) => key === COACHING_KEY)).toBe(true);
    expect(reads.mock.calls.every(([key]) => key === COACHING_KEY)).toBe(true);
    expect(localStorage.getItem(SCORING_KEY)).toBe("existing scoring archive");
    expect(localStorage.getItem(LEGACY_SCORING_KEY)).toBe("legacy scoring snapshot");
  });

  it.each(["QuotaExceededError", "SecurityError"])("retains changes through %s and retries the current data", (name) => {
    const saved = initialData();
    localStorage.setItem(COACHING_KEY, JSON.stringify(saved));
    const originalSetItem = Storage.prototype.setItem;
    let rejectWrites = true;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (key === COACHING_KEY && rejectWrites) throw new DOMException("Storage failure", name);
      return originalSetItem.call(this, key, value);
    });
    const { result } = mountStore();
    act(() => result.current.setData((data) => ({ ...data, events: [practice()], activities: [activity()] })));
    expect(result.current.saveError).toMatch(/have not been saved/i);
    expect(result.current.data.activities).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(COACHING_KEY))).toEqual(saved);

    act(() => result.current.setData((data) => ({
      ...data,
      activities: [...data.activities, activity({ id: "activity-two", title: "Relay throws" })],
    })));
    const current = result.current.data;
    rejectWrites = false;
    act(() => result.current.retrySave());

    expect(result.current.saveError).toBeNull();
    expect(JSON.parse(localStorage.getItem(COACHING_KEY))).toEqual(current);
    expect(result.current.data.activities).toHaveLength(2);
  });

  it.each([
    ["corrupt JSON", "{broken"],
    ["future version", JSON.stringify({ ...initialData(), schemaVersion: 2 })],
    ["missing collection", JSON.stringify({ schemaVersion: 1, teams: [] })],
    ["invalid entry", JSON.stringify({ ...initialData(), events: [null] })],
  ])("preserves %s through attempted editing and retry", (_kind, raw) => {
    localStorage.setItem(COACHING_KEY, raw);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const { result } = mountStore();
    expect(result.current.loadError).toMatch(/has not been changed/i);
    expect(result.current.data).toEqual(initialData());

    act(() => result.current.setData({ ...initialData(), events: [practice()], activities: [activity({ id: "new-activity" })] }));
    act(() => result.current.retrySave());

    expect(localStorage.getItem(COACHING_KEY)).toBe(raw);
    expect(writes).not.toHaveBeenCalled();
    expect(result.current.data.activities).toEqual([]);
  });

  it.each([
    ["empty teams", (data) => { data.teams = []; }],
    ["incomplete team", (data) => { data.teams = [{}]; }],
    ["missing team name", (data) => { delete data.teams[0].name; }],
    ["duplicate team IDs", (data) => { data.teams.push({ ...data.teams[0] }); }],
    ["duplicate event IDs", (data) => { data.events.push({ ...data.events[0] }); }],
    ["missing date", (data) => { delete data.events[0].date; }],
    ["impossible date", (data) => { data.events[0].date = "2026-02-30"; }],
    ["malformed time", (data) => { data.events[0].startTime = "25:00"; }],
    ["reversed time range", (data) => { data.events[0].endTime = "15:00"; }],
    ["invalid time zone", (data) => { data.events[0].timeZone = "Invalid/Zone"; }],
    ["unknown event type", (data) => { data.events[0].type = "unknown"; }],
    ["wrong team", (data) => { data.events[0].teamId = "missing-team"; }],
    ["wrong season", (data) => { data.events[0].seasonId = "different-season"; }],
    ["invalid observation", (data) => { data.observations[0].note = {}; }],
    ["duplicate observation IDs", (data) => { data.observations.push({ ...data.observations[0] }); }],
    ["missing activity title", (data) => { delete data.activities[0].title; }],
    ["invalid activity minutes", (data) => { data.activities[0].minutes = "ten"; }],
    ["invalid activity completion", (data) => { data.activities[0].completed = "yes"; }],
    ["duplicate activity IDs", (data) => { data.activities.push({ ...data.activities[0] }); }],
    ["missing practice reference", (data) => { data.activities[0].eventId = "missing-practice"; }],
    ["game reference for practice activity", (data) => { data.events[0].type = "game"; }],
    ["missing observation reference", (data) => { data.activities[0].observationId = "missing-observation"; }],
    ["cross-team observation reference", (data) => {
      data.teams.push({ ...data.teams[0], id: "seals-demo", name: "Seals" });
      data.observations[0].teamId = "seals-demo";
    }],
  ])("protects malformed saved records with %s before they reach the UI", (_name, invalidate) => {
    const malformed = linkedData();
    invalidate(malformed);
    const raw = JSON.stringify(malformed);
    localStorage.setItem(COACHING_KEY, raw);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const { result } = mountStore();

    expect(result.current.loadError).toMatch(/has not been changed/i);
    expect(result.current.data).toEqual(initialData());
    act(() => result.current.retrySave());
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem(COACHING_KEY)).toBe(raw);
  });

  it("does not overwrite unreadable storage with the initial workspace", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const { result } = mountStore();
    expect(result.current.loadError).toMatch(/storage is unavailable/i);
    act(() => result.current.setData({ ...initialData(), events: [practice({ id: "game-one", type: "game" })] }));
    act(() => result.current.retrySave());
    expect(writes).not.toHaveBeenCalled();
  });

  it("downloads the current unsaved workspace and releases its temporary link", async () => {
    const { result } = mountStore();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage full", "QuotaExceededError");
    });
    act(() => result.current.setData((data) => ({ ...data, observations: [observation({ id: "unsaved-note", note: "Review relay throws." })] })));
    const createObjectURL = vi.fn(() => "blob:coaching-test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const clicks = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.useFakeTimers();
    let exported;
    act(() => { exported = result.current.exportData(); });

    expect(exported).toBe(true);
    const blob = createObjectURL.mock.calls[0][0];
    const read = new FileReader();
    const contents = new Promise((resolve, reject) => {
      read.onload = () => resolve(read.result);
      read.onerror = reject;
      read.readAsText(blob);
    });
    await vi.runAllTimersAsync();
    expect(JSON.parse(await contents)).toEqual(result.current.data);
    expect(clicks).toHaveBeenCalledOnce();
    expect(document.querySelector("a[download]")).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:coaching-test");
    expect(result.current.saveError).toMatch(/have not been saved/i);
  });
});

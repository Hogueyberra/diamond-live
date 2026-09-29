import { describe, expect, it } from "vitest";
import { createSaturday } from "./game.js";
import { appendAction, createRecord, replayRecord, undoPitch } from "./gameRecord.js";

const CREATED_AT = "2026-09-26T16:55:00.000Z";
const RECORDED_AT = "2026-09-26T17:00:00.000Z";
const ACTOR = { id: "priya", role: "scorekeeper" };

function fresh(options = {}) {
  return createRecord({ id: "angels-test-game", createdAt: CREATED_AT, ...options });
}

function metadata(record, overrides = {}) {
  return {
    id: `event-${record.events.length + 1}`,
    recordedAt: RECORDED_AT,
    occurredAt: null,
    actor: { ...ACTOR },
    ...overrides,
  };
}

function append(record, action, overrides = {}) {
  return appendAction(record, action, metadata(record, overrides));
}

function pitch(record, kind, overrides = {}) {
  return append(record, { type: "pitch", kind }, overrides);
}

function live() {
  return append(fresh(), { type: "start" });
}

function persisted(value) {
  return JSON.parse(JSON.stringify(value));
}

describe("durable game records", () => {
  it("replays a representative inning and preserves runner identity through scoring", () => {
    let record = live();
    for (let count = 0; count < 4; count += 1) record = pitch(record, "ball");

    const walker = replayRecord(record).runners[0];
    expect(walker).toEqual(expect.objectContaining({ playerId: "demo-visitor-1" }));
    expect(walker.runnerId).toEqual(expect.any(String));

    record = pitch(record, "2B");
    const afterDouble = replayRecord(record);
    expect(afterDouble.runners[2]).toEqual(walker);
    expect(afterDouble.runners[1].playerId).toBe("demo-visitor-2");
    expect(record.events.at(-1).play.movements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ...walker, from: 1, to: 3 }),
        expect.objectContaining({ playerId: "demo-visitor-2", from: "batter", to: 2 }),
      ]),
    );

    record = pitch(record, "HR");
    expect(record.events.at(-1).play.runs).toBe(3);
    expect(record.events.at(-1).play.movements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ...walker, from: 3, to: "home" }),
        expect.objectContaining({ playerId: "demo-visitor-2", from: 2, to: "home" }),
        expect.objectContaining({ playerId: "demo-visitor-3", from: "batter", to: "home" }),
      ]),
    );

    for (const kind of ["K", "out", "out", "1B", "HR"]) record = pitch(record, kind);
    const state = replayRecord(record);
    expect(state).toEqual(
      expect.objectContaining({
        status: "live",
        inning: 1,
        half: "bottom",
        outs: 0,
        balls: 0,
        strikes: 0,
        visitorScore: 3,
        homeScore: 2,
        pitches: 9,
        bases: [false, false, false],
        runners: [null, null, null],
      }),
    );
    expect(record.events.at(-2).play.batterId).toBe("mateo");
    expect(record.events.at(-1).play.batterId).toBe("leo");
    expect(replayRecord(persisted(record))).toEqual(state);
  });

  it("retains every pitch beyond the former tape and snapshot limits", () => {
    let record = pitch(pitch(live(), "strike"), "strike");
    for (let count = 0; count < 35; count += 1) record = pitch(record, "foul");

    expect(record.events).toHaveLength(38);
    expect(record.events.filter((event) => event.action?.kind === "foul")).toHaveLength(35);
    expect(record.events.map((event) => event.sequence)).toEqual(
      Array.from({ length: 38 }, (_, index) => index + 1),
    );
    expect(replayRecord(persisted(record))).toEqual(
      expect.objectContaining({ pitches: 37, strikes: 2, outs: 0 }),
    );
  });

  it("records forced runners on a loaded walk and runners left on base at the third out", () => {
    let record = live();
    for (let count = 0; count < 16; count += 1) record = pitch(record, "ball");
    expect(replayRecord(record).visitorScore).toBe(1);
    expect(replayRecord(record).runners.map((runner) => runner.playerId)).toEqual([
      "demo-visitor-4", "demo-visitor-3", "demo-visitor-2",
    ]);
    expect(record.events.at(-1).play).toEqual(
      expect.objectContaining({
        outcome: "walk",
        runs: 1,
        movements: expect.arrayContaining([
          expect.objectContaining({ playerId: "demo-visitor-1", from: 3, to: "home" }),
          expect.objectContaining({ playerId: "demo-visitor-4", from: "batter", to: 1 }),
        ]),
      }),
    );
    for (let count = 0; count < 3; count += 1) record = pitch(record, "out");
    expect(record.events.at(-1).play.movements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: "demo-visitor-4", from: 1, to: "left-on-base" }),
        expect.objectContaining({ playerId: "demo-visitor-3", from: 2, to: "left-on-base" }),
        expect.objectContaining({ playerId: "demo-visitor-2", from: 3, to: "left-on-base" }),
      ]),
    );
    expect(replayRecord(persisted(record))).toEqual(
      expect.objectContaining({ half: "bottom", outs: 0, runners: [null, null, null], visitorScore: 1 }),
    );
  });

  it("persists actor and separate entry/occurrence times without mutating caller data", () => {
    const record = live();
    const action = { type: "pitch", kind: "ball" };
    const meta = metadata(record, { occurredAt: "2026-09-26T16:59:52.000Z" });
    const before = persisted(record);
    const next = appendAction(record, action, meta);

    action.kind = "HR";
    meta.actor.role = "parent";
    meta.actor.id = "jordan";
    meta.occurredAt = null;

    expect(record).toEqual(before);
    expect(next.events.at(-1)).toEqual(
      expect.objectContaining({
        id: "event-2",
        gameId: record.id,
        sequence: 2,
        type: "action",
        action: { type: "pitch", kind: "ball" },
        actor: ACTOR,
        recordedAt: RECORDED_AT,
        occurredAt: "2026-09-26T16:59:52.000Z",
      }),
    );
    const saved = persisted(next);
    replayRecord(next);
    replayRecord(next);
    expect(next).toEqual(saved);
    expect(replayRecord(saved).balls).toBe(1);
  });

  it("uses sequence order when entry clocks are equal or move backward", () => {
    let record = live();
    record = pitch(record, "ball");
    record = pitch(record, "strike", { recordedAt: "2026-09-26T16:59:59.000Z" });
    expect(replayRecord(persisted(record))).toEqual(
      expect.objectContaining({ balls: 1, strikes: 1, pitches: 2 }),
    );
    expect(record.events.map((event) => event.sequence)).toEqual([1, 2, 3]);
  });

  it("deduplicates an identical event even after later actions and rejects conflicting IDs", () => {
    const initial = fresh();
    const action = { type: "start" };
    const meta = metadata(initial);
    const started = appendAction(initial, action, meta);
    const record = pitch(started, "ball");

    expect(appendAction(record, persisted(action), persisted(meta))).toBe(record);
    expect(() => appendAction(record, { type: "pitch", kind: "HR" }, meta)).toThrow();
    expect(() => appendAction(record, action, { ...meta, actor: { id: "dana", role: "coach" } })).toThrow();
    expect(replayRecord(record).pitches).toBe(1);
  });

  it("does not append valid actions that have no effect and rejects unsupported commands", () => {
    const record = fresh();
    expect(pitch(record, "ball")).toBe(record);
    const started = append(record, { type: "start" });
    expect(append(started, { type: "start" })).toBe(started);
    expect(append(started, { type: "note", note: replayRecord(started).dugoutNote })).toBe(started);

    for (const action of [{ type: "reset" }, { type: "undo" }, { type: "correct" }, { type: "pitch", kind: "bogus" }]) {
      expect(() => append(started, action)).toThrow();
    }
  });
});

describe("append-only pitch undo", () => {
  it("undoes successive pitches across notes and arrivals without losing those changes", () => {
    let record = pitch(pitch(live(), "ball"), "strike");
    const ballId = record.events[1].id;
    const strikeId = record.events[2].id;
    const coach = { id: "dana", role: "coach" };
    record = append(record, { type: "note", note: "Watch the runner." }, { actor: coach });
    record = append(record, { type: "arrival", id: "miles" }, { actor: coach });
    const originalEvents = persisted(record.events);

    record = undoPitch(record, metadata(record));
    expect(record.events.slice(0, originalEvents.length)).toEqual(originalEvents);
    expect(record.events.at(-1)).toEqual(
      expect.objectContaining({
        type: "pitch-voided",
        targetEventId: strikeId,
        reason: "Scorer undid the last pitch",
      }),
    );
    expect(replayRecord(record)).toEqual(
      expect.objectContaining({ balls: 1, strikes: 0, pitches: 1, dugoutNote: "Watch the runner." }),
    );
    expect(replayRecord(record).arrived.miles).toBe(true);

    record = undoPitch(record, metadata(record));
    expect(record.events.at(-1).targetEventId).toBe(ballId);
    expect(replayRecord(persisted(record))).toEqual(
      expect.objectContaining({ status: "live", balls: 0, strikes: 0, pitches: 0, dugoutNote: "Watch the runner." }),
    );
    expect(undoPitch(record, metadata(record))).toBe(record);
  });

  it("restores runners and score when the most recent scoring pitch is voided", () => {
    let record = pitch(live(), "1B");
    const beforeHomeRun = replayRecord(record);
    record = pitch(record, "HR");
    expect(replayRecord(record).visitorScore).toBe(2);
    record = undoPitch(record, metadata(record));
    expect(replayRecord(record)).toEqual(beforeHomeRun);
    expect(record.events.some((event) => event.action?.kind === "HR")).toBe(true);
  });

  it("rejects a forged void of an older third out or the game start", () => {
    let record = live();
    for (let count = 0; count < 3; count += 1) record = pitch(record, "out");
    const thirdOutId = record.events.at(-1).id;
    record = pitch(record, "HR");
    expect(replayRecord(record).homeScore).toBe(1);
    const validUndo = undoPitch(record, metadata(record));

    for (const targetEventId of [thirdOutId, record.events[0].id]) {
      const forged = persisted(validUndo);
      forged.events.at(-1).targetEventId = targetEventId;
      expect(() => replayRecord(forged)).toThrow();
    }
    expect(replayRecord(record)).toEqual(expect.objectContaining({ half: "bottom", homeScore: 1 }));
  });

  it("can undo the latest third out and then record a replacement without stale inning state", () => {
    let record = live();
    for (let count = 0; count < 3; count += 1) record = pitch(record, "out");
    expect(replayRecord(record).half).toBe("bottom");
    record = undoPitch(record, metadata(record));
    expect(replayRecord(record)).toEqual(expect.objectContaining({ half: "top", outs: 2, pitches: 2 }));
    record = pitch(record, "1B");
    expect(record.events.at(-1).play).toEqual(expect.objectContaining({ half: "top", batterId: "demo-visitor-3" }));
    expect(replayRecord(record).runners[0].playerId).toBe("demo-visitor-3");
  });

  it("replays and undoes a walk-off without leaving the game incorrectly final", () => {
    let record = fresh({
      initialState: { ...createSaturday(), status: "live", inning: 6, half: "bottom", homeScore: 2, visitorScore: 2 },
    });
    const beforeHomeRun = replayRecord(record);
    record = pitch(record, "HR");
    expect(replayRecord(persisted(record))).toEqual(
      expect.objectContaining({ status: "final", homeScore: 3, visitorScore: 2 }),
    );
    record = undoPitch(record, metadata(record));
    expect(replayRecord(persisted(record))).toEqual(beforeHomeRun);
  });

  it("makes a retried undo idempotent even after another pitch is recorded", () => {
    let record = pitch(live(), "ball");
    const meta = metadata(record);
    record = undoPitch(record, meta);
    record = pitch(record, "strike");
    expect(undoPitch(record, persisted(meta))).toBe(record);
    expect(replayRecord(record)).toEqual(expect.objectContaining({ balls: 0, strikes: 1, pitches: 1 }));
    expect(() => undoPitch(record, { ...meta, actor: { id: "another-scorer", role: "scorekeeper" } })).toThrow();
    expect(() => undoPitch(record, metadata(record, { id: record.events[0].id }))).toThrow();
  });
});

describe("record validation and legacy checkpoints", () => {
  it("preserves an imported midgame checkpoint without inventing historical players or events", () => {
    const initialState = {
      ...createSaturday(),
      status: "live",
      inning: 3,
      half: "bottom",
      outs: 1,
      balls: 2,
      strikes: 1,
      pitches: 34,
      visitorScore: 4,
      homeScore: 2,
      bases: [true, false, true],
    };
    delete initialState.runners;
    const record = fresh({ origin: "legacy-snapshot", initialState });
    initialState.homeScore = 99;
    initialState.bases[0] = false;

    const state = replayRecord(persisted(record));
    expect(record.origin).toBe("legacy-snapshot");
    expect(record.events).toEqual([]);
    expect(state).toEqual(
      expect.objectContaining({ inning: 3, half: "bottom", homeScore: 2, visitorScore: 4, bases: [true, false, true] }),
    );
    expect(state.runners).toHaveLength(3);
    expect(state.runners[1]).toBeNull();
    expect(state.runners[0]).toEqual({ runnerId: `${record.id}:checkpoint-base-1`, playerId: null });
    expect(state.runners[2]).toEqual({ runnerId: `${record.id}:checkpoint-base-3`, playerId: null });
    expect(undoPitch(record, metadata(record))).toBe(record);

    const scored = pitch(record, "HR");
    expect(replayRecord(scored).homeScore).toBe(5);
    expect(scored.events.at(-1).play.movements.filter((movement) => movement.playerId === null)).toEqual([
      { ...state.runners[0], from: 1, to: "home" },
      { ...state.runners[2], from: 3, to: "home" },
    ]);
  });

  it("rejects unsupported schema/engine/rules versions, bad sequence, and another game's event", () => {
    const record = pitch(live(), "ball");
    for (const [field, value] of [
      ["schemaVersion", 999],
      ["engineVersion", "unknown-engine"],
      ["rulesVersion", "unknown-rules"],
    ]) {
      expect(() => replayRecord({ ...record, [field]: value })).toThrow();
    }
    for (const [field, value] of [["sequence", 99], ["gameId", "another-game"]]) {
      const changed = persisted(record);
      changed.events[1][field] = value;
      expect(() => replayRecord(changed)).toThrow();
    }
  });

  it("uses copied checkpoint roster and rules when producing later play evidence", () => {
    const initialState = persisted(fresh().initialState);
    initialState.status = "live";
    initialState.half = "bottom";
    initialState.players.find((player) => player.id === "mateo").name = "Saved player name";
    const initial = fresh({ initialState });
    initialState.players.find((player) => player.id === "mateo").name = "Changed outside the record";
    initialState.fixture.innings = 9;

    const record = pitch(initial, "1B");
    expect(record.initialState.fixture.innings).toBe(6);
    expect(record.events.at(-1).play.batterName).toBe("Saved player name");
    expect(replayRecord(persisted(record)).runners[0].playerId).toBe("mateo");
  });

  it("detects tampered play evidence instead of accepting a misleading audit trail", () => {
    const record = pitch(live(), "HR");
    const changed = persisted(record);
    changed.events.at(-1).play.runs = 100;
    expect(() => replayRecord(changed)).toThrow();
  });

  it("rejects invalid creation data, event metadata, and checkpoint shapes", () => {
    expect(() => createRecord({ id: "", createdAt: CREATED_AT })).toThrow();
    expect(() => createRecord({ id: "game", createdAt: "not-a-date" })).toThrow();
    expect(() => fresh({ initialState: { bases: [] } })).toThrow();
    const record = live();
    for (const overrides of [
      { id: "" },
      { recordedAt: "not-a-date" },
      { occurredAt: "not-a-date" },
      { actor: null },
      { actor: { id: "", role: "scorekeeper" } },
      { actor: { id: "someone", role: "unknown-role" } },
    ]) {
      expect(() => pitch(record, "ball", overrides)).toThrow();
    }
  });
});

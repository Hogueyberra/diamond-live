import { describe, expect, it } from "vitest";
import { createSaturday, familyBlurb, can, recordPitch, reduce, startGame, undo } from "./game.js";

function live(overrides = {}) {
  return { ...createSaturday(), status: "live", past: [], ...overrides };
}

describe("Saturday book", () => {
  it("opens on a clean Saturday morning", () => {
    const state = createSaturday();
    expect(state.status).toBe("pregame");
    expect(state.homeScore).toBe(0);
    expect(state.visitorScore).toBe(0);
    expect(state.half).toBe("top");
    expect(state.inning).toBe(1);
    expect(state.lineup[0]).toBe("mateo");
    expect(state.arrived.miles).toBe(false);
    expect(state.jordanStatus).toBe("on-the-way");
    expect(state.snackConfirmed).toBe(false);
  });

  it("ignores pitches until first pitch", () => {
    const state = createSaturday();
    expect(recordPitch(state, "ball")).toBe(state);
  });

  it("walks a batter on four balls and counts Leo's pitches", () => {
    let state = live();
    state = recordPitch(state, "ball");
    state = recordPitch(state, "ball");
    state = recordPitch(state, "ball");
    expect(state.balls).toBe(3);
    expect(state.bases[0]).toBe(false);
    state = recordPitch(state, "ball");
    expect(state.bases).toEqual([true, false, false]);
    expect(state.balls).toBe(0);
    expect(state.pitches).toBe(4);
    expect(state.breakersBatterIndex).toBe(1);
  });

  it("turns a two-strike foul into a pitch without a strikeout", () => {
    const state = recordPitch(live({ strikes: 2, pitches: 2 }), "foul");
    expect(state.strikes).toBe(2);
    expect(state.pitches).toBe(3);
    expect(state.outs).toBe(0);
  });

  it("strikes a batter out on the third strike", () => {
    let state = live();
    state = recordPitch(state, "strike");
    state = recordPitch(state, "strike");
    state = recordPitch(state, "strike");
    expect(state.outs).toBe(1);
    expect(state.strikes).toBe(0);
    expect(state.pitches).toBe(3);
  });

  it("does not charge the Hawks pitcher in the bottom of the inning", () => {
    const state = recordPitch(live({ half: "bottom", pitches: 10 }), "strike");
    expect(state.pitches).toBe(10);
    expect(state.strikes).toBe(1);
  });

  it("flips the inning after three outs", () => {
    const state = recordPitch(live({ outs: 2, bases: [true, false, false] }), "out");
    expect(state.half).toBe("bottom");
    expect(state.outs).toBe(0);
    expect(state.inning).toBe(1);
    expect(state.bases).toEqual([false, false, false]);
  });

  it("scores a grand slam for the visitors", () => {
    const state = recordPitch(live({ bases: [true, true, true] }), "HR");
    expect(state.visitorScore).toBe(4);
    expect(state.homeScore).toBe(0);
    expect(state.bases).toEqual([false, false, false]);
  });

  it("scores only the runner from third on a single", () => {
    const state = recordPitch(live({ bases: [false, false, true] }), "1B");
    expect(state.visitorScore).toBe(1);
    expect(state.bases).toEqual([true, false, false]);
  });

  it("moves the runner from first to third on a double", () => {
    const state = recordPitch(live({ bases: [true, false, false] }), "2B");
    expect(state.visitorScore).toBe(0);
    expect(state.bases).toEqual([false, true, true]);
  });

  it("forces in a run on a bases-loaded walk", () => {
    const state = recordPitch(live({ bases: [true, true, true], balls: 3, pitches: 3 }), "ball");
    expect(state.visitorScore).toBe(1);
    expect(state.bases).toEqual([true, true, true]);
    expect(state.pitches).toBe(4);
  });

  it("ends the game when the Hawks already lead after six", () => {
    const state = recordPitch(live({ inning: 6, half: "top", outs: 2, homeScore: 3, visitorScore: 1 }), "K");
    expect(state.status).toBe("final");
    expect(state.homeScore).toBe(3);
  });

  it("records a walk-off homer", () => {
    const state = recordPitch(live({ inning: 6, half: "bottom", homeScore: 2, visitorScore: 2 }), "HR");
    expect(state.status).toBe("final");
    expect(state.homeScore).toBe(3);
    expect(state.log.at(-1)).toMatch(/Walk-off/);
  });

  it("closes the book after the bottom of the sixth", () => {
    const state = recordPitch(live({ inning: 6, half: "bottom", outs: 2, homeScore: 1, visitorScore: 4 }), "out");
    expect(state.status).toBe("final");
  });

  it("resets Saturday back to the morning", () => {
    let state = startGame(createSaturday());
    state = recordPitch(state, "HR");
    state = reduce(state, { type: "move", id: "leo", direction: -1 });
    state = reduce(state, { type: "snack" });
    expect(reduce(state, { type: "reset" })).toEqual(createSaturday());
  });

  it("undoes the last pitch without losing the first pitch", () => {
    const started = startGame(createSaturday());
    const pitched = recordPitch(started, "ball");
    const undone = undo(pitched);
    expect(undone.balls).toBe(0);
    expect(undone.status).toBe("live");
    expect(undo(undone).status).toBe("pregame");
  });

  it("reorders the card and cycles a shot", () => {
    const moved = reduce(createSaturday(), { type: "move", id: "mateo", direction: 1 });
    expect(moved.lineup.slice(0, 2)).toEqual(["leo", "mateo"]);
    const shot = reduce(createSaturday(), { type: "clip", id: "first-pitch" });
    expect(shot.clips[0].status).toBe("shot");
    expect(reduce(shot, { type: "clip", id: "first-pitch" }).clips[0].status).toBe("uploaded");
  });

  it("keeps nine in the order until a bench player is added", () => {
    const morning = createSaturday();
    expect(reduce(morning, { type: "bench", id: "benny" })).toBe(morning);
    const added = reduce(morning, { type: "activate", id: "caleb" });
    expect(added.lineup.at(-1)).toBe("caleb");
    const parked = reduce(added, { type: "bench", id: "caleb" });
    expect(parked.lineup).not.toContain("caleb");
    expect(parked.bench).toContain("caleb");
  });

  it("gates each role", () => {
    expect(can("coach", "lineup")).toBe(true);
    expect(can("coach", "start")).toBe(true);
    expect(can("scorekeeper", "score")).toBe(true);
    expect(can("scorekeeper", "undo")).toBe(true);
    expect(can("videographer", "film")).toBe(true);
    expect(can("parent", "family")).toBe(true);
    expect(can("parent", "score")).toBe(false);
    expect(can("videographer", "start")).toBe(false);
  });

  it("writes Jordan a text that names Mateo and the oranges", () => {
    const text = familyBlurb(createSaturday());
    expect(text).toMatch(/Mateo is at the field, 1 in the order/);
    expect(text).toMatch(/orange slices/);
    expect(text).toMatch(/No score yet/);
  });
});

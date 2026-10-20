import { expect, it } from "vitest";
import {
  emptyAssessmentRatings,
  makeAssessment,
  playerSnapshot,
  assessmentHistory,
} from "./playerAssessments.js";

function entry(patch = {}) {
  return makeAssessment({
    playerId: 12,
    observedOn: "2026-10-18",
    coach: "Coach Test",
    context: "Practice",
    notes: "Set feet on seven of ten throws.",
    ratings: { ...emptyAssessmentRatings(), fielding: 7 },
    ...patch,
  });
}
it("keeps skipped skills and dates, establishes a previously unobserved baseline, and retains history", () => {
  const first = entry();
  const second = entry({
    observedOn: "2026-10-19",
    ratings: { ...emptyAssessmentRatings(), baserunning: 5 },
  });
  const snapshot = playerSnapshot(12, [first, second]);
  expect(snapshot.fielding).toMatchObject({ value: 7, previous: 4, source: { id: first.id } });
  expect(snapshot.hitting).toMatchObject({
    value: 6,
    source: { observedOn: "2026-10-14", sample: true },
  });
  expect(snapshot.baserunning).toMatchObject({
    value: 5,
    previous: null,
    source: { id: second.id },
  });
  expect(assessmentHistory(12, [first, second])).toHaveLength(3);
  expect(playerSnapshot(7, [first, second]).hitting.value).toBeNull();
});
it("orders observations by date, and corrections by recording time without deleting the original", () => {
  const recent = { ...entry(), recordedAt: "2026-10-18T14:00:00.000Z" };
  const backdated = entry({
    observedOn: "2026-10-16",
    ratings: { ...emptyAssessmentRatings(), fielding: 2 },
  });
  expect(playerSnapshot(12, [recent, backdated]).fielding.value).toBe(7);
  const correction = {
    ...entry({ ratings: { ...emptyAssessmentRatings(), fielding: 6 } }),
    recordedAt: "2026-10-18T15:00:00.000Z",
  };
  expect(playerSnapshot(12, [recent, backdated, correction]).fielding).toMatchObject({
    value: 6,
    previous: 7,
  });
  expect(assessmentHistory(12, [recent, backdated, correction])).toHaveLength(4);
});
it("rejects invalid scores, empty observations, future dates, and nonexistent players", () => {
  for (const value of [0, 11, 1.5, "5", undefined])
    expect(() => entry({ ratings: { ...emptyAssessmentRatings(), fielding: value } })).toThrow();
  for (const patch of [
    { ratings: emptyAssessmentRatings() },
    { observedOn: "2026-02-30" },
    { observedOn: "2999-01-01" },
    { coach: " " },
    { notes: " " },
    { context: "invented" },
    { playerId: 999 },
  ])
    expect(() => entry(patch)).toThrow();
});

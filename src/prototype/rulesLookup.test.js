import { expect, it } from "vitest";
import corpus from "../data/hvll2026.json";
import { lookupRules, RULE_QUESTIONS } from "./rulesLookup.js";

it("finds the correct Minor B sections for the suggested questions with exact source text", () => {
  for (const [index, section, page] of [
    [0, "Section X.K", 27],
    [1, "Section X.E", 26],
    [2, "Section X.A", 26],
  ]) {
    const result = lookupRules(RULE_QUESTIONS[index]);
    expect(result.division).toBe("Minor B");
    expect(result.passages[0]).toMatchObject({ section, page });
    expect(result.passages[0].url).toBe(`${corpus.source.url}#page=${page}`);
    expect(result.passages[0].text).toBe(
      corpus.chunks.find((chunk) => chunk.id === result.passages[0].id).text,
    );
    expect(result.passages[0].text).toContain(result.passages[0].snippet);
    expect(
      result.passages.every(
        (chunk) => chunk.divisions.includes("Minor B") || chunk.divisions.includes("All divisions"),
      ),
    ).toBe(true);
  }
  expect(lookupRules(RULE_QUESTIONS[0]).passages[0].snippet).toContain(
    "No player over the league-age of 10 may pitch",
  );
  expect(lookupRules(RULE_QUESTIONS[0]).passages[0].snippet).toContain("during the regular season");
});
it("accepts the selected division in the question and flags mismatched divisions or years", () => {
  expect(lookupRules("How many innings can a Minor B pitcher pitch?").passages[0].section).toBe(
    "Section X.K",
  );
  expect(lookupRules("Minor A pitching limits").text).toContain("Choose Minor A");
  expect(lookupRules("2027 pitching rules").passages).toEqual([]);
  expect(lookupRules("2027 pitching rules").text).toContain("don’t have the 2027 rules");
  const other = lookupRules("pitching", "Minor A");
  expect(
    other.passages.every(
      (chunk) => chunk.divisions.includes("Minor A") || chunk.divisions.includes("All divisions"),
    ),
  ).toBe(true);
});
it("does not invent a ruling for missing topics or an empty question", () => {
  expect(lookupRules('"stealing bases"').passages).toEqual([]);
  expect(lookupRules("intergalactic robot substitution").text).toContain("couldn’t find");
  expect(lookupRules("").passages).toEqual([]);
});

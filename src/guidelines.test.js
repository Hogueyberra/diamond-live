import { describe, expect, it } from "vitest";
import { searchGuidelines } from "./guidelines.js";
import corpus from "./data/hvll2026.json";

function passage(id, text, overrides = {}) {
  return { id, sourceId: "hvll-2026", title: "2026 local rules", section: "Section X", page: 26,
    divisions: ["Minor B"], year: "2026", text, ...overrides };
}

describe("guidelines source search", () => {
  const chunks = [
    passage("b-pitch", "A player may pitch three innings per game. One pitch counts as one inning.", { title: "Pitching" }),
    passage("b-steal", "Stealing bases is not permitted in this division."),
    passage("a-steal", "Runners may steal bases.", { divisions: ["Minor A"], page: 22 }),
    passage("general", "All players follow the league safety rules.", { divisions: ["All divisions"], page: 3 }),
    passage("old", "All players wear helmets.", { year: "2025", sourceId: "hvll-2025" }),
  ];

  it("includes general rules with a division and applies year/source filters together", () => {
    const results = searchGuidelines(chunks, "", { division: "Minor B", year: "2026", sourceId: "hvll-2026" });
    expect(results.map((result) => result.id)).toEqual(["b-pitch", "b-steal", "general"]);
    expect(searchGuidelines(chunks, "", { division: "All divisions" })).toHaveLength(5);
  });

  it("accepts general applicability markers and rejects other divisions", () => {
    const variations = [[], ["all"], ["general"], ["league-wide"], ["Minor A", "Minor B"], ["Minor A"]];
    expect(searchGuidelines(variations.map((divisions, index) => passage(String(index), "Pitching", { divisions })), "pitch", { division: "Minor B" }))
      .toHaveLength(5);
  });

  it("normalizes basic baseball terms and natural-question stopwords", () => {
    expect(searchGuidelines(chunks, "Can we steal a base?", { division: "Minor B" }).map((result) => result.id)).toEqual(["b-steal"]);
    expect(searchGuidelines(chunks, "What are the pitch count rules?").map((result) => result.id)).toEqual(["b-pitch"]);
    expect(searchGuidelines(chunks, "pitching innings").map((result) => result.id)).toEqual(["b-pitch"]);
    expect(searchGuidelines(chunks, "How many innings can a pitcher pitch?").map((result) => result.id)).toEqual(["b-pitch"]);
  });

  it("requires all meaningful keywords and returns no invented answer for no matches", () => {
    expect(searchGuidelines(chunks, "pitching helmets")).toEqual([]);
    expect(searchGuidelines(chunks, "lightning")).toEqual([]);
  });

  it("honors quoted phrases, including stopwords and punctuation, without alias expansion", () => {
    const options = [passage("exact", "The pitch-count limit applies."), passage("separated", "Pitch limit and count guide."), passage("alias", "Pitching limit applies.")];
    expect(searchGuidelines(options, '"pitch count"').map((result) => result.id)).toEqual(["exact"]);
    expect(searchGuidelines(chunks, '“not permitted” base').map((result) => result.id)).toEqual(["b-steal"]);
    expect(searchGuidelines(chunks, '"is permitted"')).toEqual([]);
  });

  it("ranks a relevant heading above a body-only mention, without changing source data", () => {
    const options = [passage("body", "The safety guidance includes pitching."), passage("heading", "A player may pitch three innings.", { title: "Pitching" })];
    const before = JSON.stringify(options);
    const results = searchGuidelines(options, "pitching");
    expect(results.map((result) => result.id)).toEqual(["heading", "body"]);
    expect(results[0].text).toBe(options[1].text);
    expect(results[0].sourceId).toBe("hvll-2026");
    expect(results[0].page).toBe(26);
    expect(JSON.stringify(options)).toBe(before);
  });

  it("shows the relevant passage within a long page and retains full exact source text", () => {
    const text = `${"Unrelated safety guidance. ".repeat(30)}Stealing bases is not permitted. ${"Additional detail. ".repeat(30)}`;
    const [result] = searchGuidelines([passage("long", text)], "steal base");
    expect(result.snippet).toContain("Stealing bases is not permitted.");
    expect(result.snippet.length).toBeLessThanOrEqual(282);
    expect(result.text).toBe(text);
  });

  it("does not cross chunk boundaries to manufacture a phrase match", () => {
    expect(searchGuidelines([passage("one", "continuous"), passage("two", "batting order")], '"continuous batting"')).toEqual([]);
  });

  it("returns actual source word forms and punctuation-preserving phrases for highlighting", () => {
    const [stemmed] = searchGuidelines([passage("pitch", "Pitching and pitchers follow the guidelines.")], "pitch");
    expect(stemmed.matchTerms).toEqual(["Pitching", "pitchers"]);
    const [phrase] = searchGuidelines([passage("count", "The pitch-count limit applies.")], '"pitch count"');
    expect(phrase.matchTerms).toEqual(["pitch-count"]);
  });

  it("prioritizes explicit division passages when browsing and only breaks search relevance ties", () => {
    const options = [passage("general", "Playing rules", { divisions: ["All divisions"] }), passage("specific", "Playing rules")];
    expect(searchGuidelines(options, "", { division: "Minor B" }).map((item) => item.id)).toEqual(["specific", "general"]);
    expect(searchGuidelines(options, "playing", { division: "Minor B" }).map((item) => item.id)).toEqual(["specific", "general"]);
    expect(searchGuidelines([passage("specific", "Bat safely."), passage("general", "Bat safely.", { title: "Batting", divisions: ["All divisions"] })], "bat", { division: "Minor B" })[0].id).toBe("general");
  });
});

describe("searching the published 2026 HVLL corpus", () => {
  it("opens Minor B browsing with explicit division playing rules while keeping general guidance available", () => {
    const results = searchGuidelines(corpus.chunks, "", { division: "Minor B" });
    const explicit = results.filter((chunk) => chunk.divisions.includes("Minor B"));
    expect(explicit.length).toBeGreaterThan(0);
    expect(results.slice(0, explicit.length)).toEqual(explicit);
    expect(results[0].category).toBe("Playing rules");
    expect(results.some((chunk) => chunk.divisions.includes("All divisions"))).toBe(true);
    expect(results.some((chunk) => chunk.divisions.includes("Minor A") && !chunk.divisions.includes("Minor B"))).toBe(false);
  });

  it.each([
    ["pitching", "hvll-2026-section-x-k", 27],
    ["How many innings can a pitcher pitch?", "hvll-2026-section-x-k", 27],
    ["playing time", "hvll-2026-section-x-a", 26],
    ["batting order", "hvll-2026-section-x-e", 26],
  ])("finds the Minor B source for %s with correct citation", (query, id, page) => {
    const results = searchGuidelines(corpus.chunks, query, { division: "Minor B", sourceId: "hvll-2026", year: "2026" });
    expect(results[0]).toMatchObject({ id, page, sourceId: "hvll-2026", divisions: ["Minor B"] });
    expect(results[0].text).toBe(corpus.chunks.find((chunk) => chunk.id === id).text);
    expect(results.every((chunk) => chunk.divisions.includes("Minor B") || chunk.divisions.includes("All divisions"))).toBe(true);
  });

  it("shows sign-stealing source text without inventing a base-stealing rule", () => {
    const results = searchGuidelines(corpus.chunks, "stealing", { division: "Minor B" });
    expect(results.map((chunk) => chunk.id)).toEqual(["hvll-2026-section-iii-a"]);
    expect(results[0].text).toMatch(/sign[\s-]+stealing/i);
    expect(searchGuidelines(corpus.chunks, '"stealing bases"', { division: "Minor B" })).toEqual([]);
  });
});

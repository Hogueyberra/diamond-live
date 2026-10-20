import corpus from "../data/hvll2026.json";
import { searchGuidelines } from "../guidelines.js";

export const RULE_SOURCE = corpus.source;
export const RULE_DIVISIONS = [...new Set(corpus.chunks.flatMap((chunk) => chunk.divisions))];
export const RULE_QUESTIONS = [
  "How many innings can a pitcher pitch?",
  "What is the batting order?",
  "What are the playing time rules?",
];

// Keep complete paragraphs so a clipped search snippet cannot omit a negation
// or a condition at the start/end of a rule.
function completeExcerpt(chunk) {
  const fragment = chunk.snippet.replace(/^…/, "").replace(/…$/, "");
  const match = chunk.text.indexOf(fragment);
  if (match < 0) return chunk.text;
  const before = chunk.text.lastIndexOf("\n\n", match);
  const after = chunk.text.indexOf("\n\n", match + fragment.length);
  return chunk.text
    .slice(before < 0 ? 0 : before + 2, after < 0 ? chunk.text.length : after)
    .trim();
}

export function lookupRules(question, division = "Minor B") {
  const query = String(question).trim().slice(0, 500);
  const scope = RULE_DIVISIONS.includes(division) ? division : "Minor B";
  const year = query.match(/\b20\d{2}\b/)?.[0];
  if (year && year !== RULE_SOURCE.year)
    return {
      division: scope,
      passages: [],
      total: 0,
      text: `This rulebook is from ${RULE_SOURCE.year}. I don’t have the ${year} rules here. Check the current league document before using an older rule.`,
    };
  const namedDivision = RULE_DIVISIONS.find(
    (name) => name !== "All divisions" && new RegExp(`\\b${name}\\b`, "i").test(query),
  );
  if (namedDivision && namedDivision !== scope && scope !== "All divisions")
    return {
      division: scope,
      passages: [],
      total: 0,
      text: `Your question mentions ${namedDivision}, but the division selector is set to ${scope}. Choose ${namedDivision} above, then ask again.`,
    };
  const searchable = query
    .replace(new RegExp(`\\b${scope}\\b`, "ig"), " ")
    .replace(/\b2026\b/g, " ")
    .trim();
  if (!query || !searchable)
    return {
      division: scope,
      passages: [],
      total: 0,
      text: "Ask about a rule topic, such as pitching innings, batting order, or playing time.",
    };
  const results = searchGuidelines(corpus.chunks, searchable, {
    division: scope,
    sourceId: RULE_SOURCE.id,
    year: RULE_SOURCE.year,
  });
  return {
    division: scope,
    total: results.length,
    text: results.length
      ? `I found ${results.length === 1 ? "a matching passage" : `${results.length} matching passages`} in the 2026 HVLL bylaws. Read the full section for its conditions and exceptions.`
      : "I couldn’t find a matching passage in this rulebook for that question. Try a specific topic or another division. A missing result does not mean a play is allowed or prohibited.",
    passages: results.slice(0, 3).map((chunk) => ({
      id: chunk.id,
      title: chunk.title,
      section: chunk.section,
      page: chunk.page,
      divisions: chunk.divisions,
      snippet: completeExcerpt(chunk),
      text: chunk.text,
      url: `${RULE_SOURCE.url}#page=${chunk.page}`,
    })),
  };
}

// Search returns source passages, never synthesized answers.
const STOP_WORDS = new Set("a an the and or of for to in on at by with from about is are was were be been being do does did can could should would will may might must how what when where which who why i we you our my your their they it this that these those there any many much long often please tell me rule rules guideline guidelines allowed allow".split(" "));
const ALIASES = {
  stealing: "steal", steals: "steal", stolen: "steal", stole: "steal",
  pitching: "pitch", pitched: "pitch", pitches: "pitch", pitcher: "pitch", pitchers: "pitch",
  batting: "bat", bats: "bat", batter: "bat", batters: "bat",
  inning: "inning", innings: "inning", inningspitched: "pitch",
  children: "child", players: "player", bases: "base", practices: "practice",
  substitution: "substitute", substitutions: "substitute", substituting: "substitute",
};

function plain(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function canonical(word) {
  if (ALIASES[word]) return ALIASES[word];
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("s") && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

function tokens(value) {
  return Array.from(String(value ?? "").matchAll(/[\p{L}\p{N}]+/gu), (match) => ({
    raw: match[0], plain: plain(match[0]), value: canonical(plain(match[0])), index: match.index,
    end: match.index + match[0].length,
  }));
}

function parseQuery(query) {
  const phrases = [];
  const remainder = String(query ?? "").slice(0, 500).replace(/[“”]/g, '"').replace(/"([^"]+)"/g, (_, value) => {
    const words = tokens(value).map((word) => word.plain);
    if (words.length) phrases.push(words);
    return " ";
  });
  // A common coaching term; quoted "pitch count" still requires that exact phrase.
  const words = tokens(remainder.replace(/\bpitch\s+counts?\b/gi, "pitch"));
  const terms = [...new Set(words.filter((word) => !STOP_WORDS.has(word.plain)).map((word) => word.value))];
  return { phrases, terms };
}

function phraseMatches(words, phrase) {
  const matches = [];
  for (let index = 0; index <= words.length - phrase.length; index += 1) {
    if (phrase.every((word, offset) => words[index + offset].plain === word)) matches.push(words[index].index);
  }
  return matches;
}

function matchedForms(fields, fieldText, terms, phrases) {
  const forms = new Map();
  const add = (value) => forms.set(value.toLowerCase(), value);
  fields.forEach((words, fieldIndex) => {
    words.filter((word) => terms.includes(word.value)).forEach((word) => add(word.raw));
    phrases.forEach((phrase) => {
      for (let index = 0; index <= words.length - phrase.length; index += 1) {
        if (phrase.every((word, offset) => words[index + offset].plain === word)) {
          add(fieldText[fieldIndex].slice(words[index].index, words[index + phrase.length - 1].end));
        }
      }
    });
  });
  return [...forms.values()].sort((left, right) => right.length - left.length);
}

const GENERAL_DIVISIONS = new Set(["", "all", "all divisions", "general", "league wide", "league-wide"]);

function matchesFilters(chunk, { division, sourceId, year }) {
  if (sourceId && sourceId !== "all" && chunk.sourceId !== sourceId) return false;
  if (year && year !== "all" && String(chunk.year ?? "") !== String(year)) return false;
  const requested = plain(division).trim();
  if (!GENERAL_DIVISIONS.has(requested)) {
    const divisions = Array.isArray(chunk.divisions) ? chunk.divisions : [chunk.division ?? ""];
    if (divisions.length && !divisions.some((value) => {
      const normalized = plain(value).trim();
      return normalized === requested || GENERAL_DIVISIONS.has(normalized);
    })) return false;
  }
  return true;
}

function snippetFor(text, positions) {
  if (text.length <= 280) return text;
  // Choose the densest cluster of matched terms, rather than the first occurrence.
  let anchor = positions[0] ?? 0;
  let bestCount = 0;
  for (const position of positions) {
    const count = positions.filter((other) => other >= position - 50 && other < position + 200).length;
    if (count > bestCount) { bestCount = count; anchor = position; }
  }
  let start = Math.max(0, anchor - 65);
  if (start > 0) {
    const boundary = text.indexOf(" ", start);
    if (boundary >= start && boundary < start + 25 && boundary < anchor) start = boundary + 1;
  }
  let end = Math.min(text.length, start + 280);
  if (end < text.length) {
    const boundary = text.lastIndexOf(" ", end);
    if (boundary > end - 25) end = boundary;
  }
  return `${start ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/** Returns filtered, ranked source chunks, with their exact original text intact. */
export function searchGuidelines(chunks, query = "", filters = {}) {
  const { terms, phrases } = parseQuery(query);
  const results = [];
  for (const chunk of Array.isArray(chunks) ? chunks : []) {
    if (!chunk || typeof chunk.text !== "string" || !matchesFilters(chunk, filters)) continue;
    const body = tokens(chunk.text);
    const title = tokens(chunk.title);
    const section = tokens(chunk.section);
    const fields = [title, section, body];
    if (!terms.every((term) => fields.some((words) => words.some((word) => word.value === term)))) continue;
    if (!phrases.every((phrase) => fields.some((words) => phraseMatches(words, phrase).length))) continue;
    const positions = body.filter((word) => terms.includes(word.value)).map((word) => word.index);
    phrases.forEach((phrase) => positions.push(...phraseMatches(body, phrase)));
    positions.sort((a, b) => a - b);
    let score = terms.reduce((total, term) => total
      + (title.some((word) => word.value === term) ? 8 : 0)
      + (section.some((word) => word.value === term) ? 4 : 0)
      + Math.min(5, body.filter((word) => word.value === term).length) * 2, 0);
    score += phrases.reduce((total, phrase) => total + fields.reduce((sum, words, index) => sum + (phraseMatches(words, phrase).length ? (index === 0 ? 24 : 16) : 0), 0), 0);
    if (positions.length > 1 && positions.at(-1) - positions[0] < 200) score += 3;
    const requestedDivision = plain(filters.division).trim();
    const explicitDivision = !GENERAL_DIVISIONS.has(requestedDivision)
      && (chunk.divisions ?? [chunk.division]).some((value) => plain(value).trim() === requestedDivision);
    // Keep division-specific playing rules at the top when browsing. For a query,
    // this fractional bonus only breaks otherwise equal relevance scores.
    if (explicitDivision) score += terms.length || phrases.length ? 0.25 : 1;
    results.push({ ...chunk, score, snippet: snippetFor(chunk.text, positions),
      matchTerms: matchedForms(fields, [String(chunk.title ?? ""), String(chunk.section ?? ""), chunk.text], terms, phrases) });
  }
  // Modern JS sort is stable, preserving source/page order for equal relevance.
  return results.sort((left, right) => right.score - left.score);
}

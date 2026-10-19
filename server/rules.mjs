const clean = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const stop = new Set('a an the and or of for to in on at by with from about is are was were be been do does did can could should would will may might must how what when where which who why i we you our my your their they it this that these those there any many much long often please tell me rule rules allowed allow hvll league minor b regular season question'.split(' '));
const synonyms = { pitched: 'pitch', pitcher: 'pitch', pitchers: 'pitch', pitching: 'pitch', pitches: 'pitch', innings: 'inning', fourth: '4', third: '3', sixth: '6', weekly: 'week', stolen: 'steal', stealing: 'steal', bunting: 'bunt', batting: 'bat', batters: 'bat', removed: 'remove', returning: 'return', reinstated: 'return', players: 'player', bases: 'base', sitting: 'sit', benches: 'sit', bench: 'sit' };
function tokens(s) { return clean(s).match(/[a-z0-9]+/g)?.filter((x) => !stop.has(x)).map((x) => synonyms[x] ?? x) ?? []; }
export const RULE_DIVISIONS = ['Majors', 'Minor A', 'Minor B', 'Minor C', 'Farm', 'Rookie Ball', 'Tee Ball'];
export function mentionedDivisions(question) { return RULE_DIVISIONS.filter((d) => clean(question).includes(clean(d))); }

export function retrieveRules(corpus, question, { division = 'Minor B', year = '2026', limit = 5 } = {}) {
  const ids = new Set(corpus.sources.filter((s) => (!s.historical || question.includes(s.year)) && (s.reference || !s.year || s.year === year || (s.historical && question.includes(s.year)))).map((s) => s.id));
  const pool = corpus.chunks.filter((c) => ids.has(c.sourceId) && c.divisions.some((d) => ['all', 'all divisions', 'general', 'league-wide'].includes(clean(d)) || clean(d) === clean(division)));
  const query = [...new Set(tokens(question))];
  const bodies = pool.map((c) => tokens(`${c.title} ${c.sectionTitle ?? ''} ${c.text}`));
  const freq = Object.fromEntries(query.map((t) => [t, bodies.filter((words) => words.includes(t)).length]));
  return pool.map((c, index) => {
    const words = bodies[index];
    const title = tokens(c.title);
    const score = query.reduce((sum, t) => {
      const tf = Math.min(4, words.filter((w) => w === t).length);
      return sum + (tf ? Math.log(1 + pool.length / (1 + freq[t])) * (tf / (tf + 1.2 + words.length / 300)) + (title.includes(t) ? 2 : 0) : 0);
    }, 0);
    return { ...c, score: score + (score && c.divisions.includes(division) ? 0.5 : 0) };
  }).filter((c) => c.score > 1).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function citation(corpus, chunk, quote = chunk.text) {
  const source = corpus.sources.find((s) => s.id === chunk.sourceId);
  return { id: chunk.id, title: source?.title ?? chunk.title, section: chunk.section, page: chunk.page, pages: chunk.pages ?? [chunk.page], year: chunk.year, quote, ocr: Boolean(source?.ocr), url: source?.url ? `${source.url.split('#')[0]}#page=${chunk.page}` : null, sharedDocumentId: source?.shared ? source.id : undefined };
}

// Source-checked narrow answers. Never infer general player eligibility from a single limit.
// Scope is explicit in the returned answer; a low pitch count never overrides an inning cap.
export function verifiedPitchingAnswer(corpus, question, { division, year }) {
  if (division !== 'Minor B' || year !== '2026' || !/pitch|mound/i.test(question)) return null;
  // A team upload may amend the bundled rule. Show sources for review instead
  // of asserting the bundled answer across an unknown amendment.
  if (corpus.sources.some((s) => s.shared && (!s.year || s.year === year))) return null;
  const k = corpus.chunks.find((c) => c.id === 'hvll-2026-section-x-k');
  const f = corpus.chunks.find((c) => c.id === 'hvll-2026-section-x-f');
  if (!k?.text.includes('No player may pitch more than 3 innings per game or more than 6 innings per week') || !f?.text.includes('A pitcher may not be removed and reinstated as a pitcher in the same game.')) return null;
  const q = clean(question);
  const inningQuestion = /inning|weekly|per week|reset/.test(q) && !/hit.*batter|batter.*hit/.test(q);
  const returnQuestion = /return|re.?enter|reinstat|removed/.test(q);
  if (!inningQuestion && !returnQuestion) return null;
  const answer = [];
  if (inningQuestion) answer.push('Under the 2026 HVLL Minor B rules, regular-season pitchers are limited to 3 innings per game and 6 innings per week, Monday through Sunday. Any inning with at least one pitch counts. A fourth inning is not allowed in the regular season, even with a low pitch count. During the Division Championship Tournament, the daily and weekly inning caps are removed; Little League pitch-count and rest rules still apply.');
  if (returnQuestion) answer.push('A pitcher who is removed cannot return as pitcher in the same game.');
  answer.push('These limits alone do not establish eligibility: check the applicable Little League pitch-count/rest rules and the player’s workload.');
  const refs = [...(inningQuestion ? [citation(corpus, k)] : []), ...(returnQuestion ? [citation(corpus, f)] : [])];
  return { answer: answer.join('\n\n'), sources: refs, method: 'verified-rule', scope: '2026 HVLL · Minor B' };
}

export function sourceFallback(corpus, chunks, message = 'I found these relevant passages. Please check the source text; I could not produce a reliably cited explanation.') {
  return { answer: chunks.length ? message : 'I could not find a matching rule in the selected league documents. Try the specific topic, division, and season, or ask the league for clarification.', sources: chunks.slice(0, 3).map((c) => citation(corpus, c)), method: 'source-passages' };
}

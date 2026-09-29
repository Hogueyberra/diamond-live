import { describe, expect, it } from 'vitest';
import { createDemoScoutingData, createEmptyRatings, createEmptyScoutingData, DEMO_SCOUTING_AUTHOR_ID, formatScoutingScore, getDrillSuggestion, getPlayerHistory, getPlayerScore, getRankedPlayers, SCOUTING_SKILLS, validateScoutingData, validateScoutingUpdate } from './scouting.js';

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const player = (n, name = `Player ${n}`) => ({ id: uid(n), name, number: String(n), age: 8, positions: '', notes: '', archived: false, draftStatus: 'available' });
const session = { id: uid(20), name: 'Tryouts', date: '2026-09-29' };
const all = (score) => Object.fromEntries(SCOUTING_SKILLS.map((skill) => [skill.id, score]));
function fixture() { return { ...createEmptyScoutingData(), players: [player(1)], sessions: [session] }; }
function evaluation(n, ratings, overrides = {}) { return { id: uid(n), playerId: uid(1), sessionId: session.id, authorId: DEMO_SCOUTING_AUTHOR_ID, authorName: 'Coach', createdAt: '2026-09-29T18:00:00.000Z', ratings, notes: '', ...overrides }; }

describe('scouting scores', () => {
  it('weights the three categories equally rather than allowing four-skill categories to dominate', () => {
    const data = fixture(); data.evaluations = [evaluation(100, { ...all(3), hit_bunting: 9, hit_swing: 9 })];
    const result = getPlayerScore(data, uid(1), session.id);
    expect(result.categoryScores).toEqual({ infield: 3, outfield: 3, hitting: 9 });
    expect(result.overall).toBe(5); expect(result.complete).toBe(true);
  });
  it('keeps missing skills null and excludes partial or unobserved players from ranking', () => {
    const data = fixture(); data.players.push(player(2)); data.evaluations = [evaluation(100, { ...createEmptyRatings(), if_glove: 8 })];
    const result = getPlayerScore(data, uid(1), session.id);
    expect(result).toMatchObject({ overall: null, complete: false, coverage: { observed: 1, total: 10 } });
    expect(result.categoryScores).toEqual({ infield: 8, outfield: null, hitting: null });
    expect(result.ratings.hit_swing).toBeNull(); expect(getRankedPlayers(data, session.id).map((row) => row.rank)).toEqual([null, null]);
  });
  it('gives each coach one latest vote and deterministically resolves equal timestamps by ID', () => {
    const data = fixture(); data.evaluations = [evaluation(100, all(2)), evaluation(102, all(8)), evaluation(101, all(4)), evaluation(103, all(6), { authorId: uid(999), authorName: 'Second coach' })];
    const result = getPlayerScore(data, uid(1), session.id);
    expect(result.overall).toBe(7); expect(result.evaluatorCount).toBe(2);
    expect(result.skillCounts.if_glove).toBe(2); expect(result.evaluators.map((coach) => coach.name)).toEqual(['Coach', 'Second coach']);
  });
  it('replaces an earlier full submission with that coach’s later partial observation without carrying missing scores forward', () => {
    const data = fixture(); data.evaluations = [evaluation(100, all(9)), evaluation(101, { ...createEmptyRatings(), if_glove: 5 }, { createdAt: '2026-09-29T19:00:00.000Z' })];
    expect(getPlayerScore(data, uid(1), session.id)).toMatchObject({ overall: null, observedSkills: 1, ratings: { if_glove: 5, hit_swing: null } });
  });
  it('averages only observed votes per skill and reports their coverage', () => {
    const data = fixture(); data.evaluations = [evaluation(100, { ...all(8), if_glove: null }), evaluation(101, { ...createEmptyRatings(), if_glove: 6 }, { authorId: uid(999) })];
    expect(getPlayerScore(data, uid(1), session.id)).toMatchObject({ complete: true, evaluatorCount: 2, skillCounts: { if_glove: 1, hit_swing: 1 }, ratings: { if_glove: 6, hit_swing: 8 } });
  });
  it('uses competition ranks for full-precision ties and does not rank archived players', () => {
    const data = fixture(); data.players.push(player(2), player(3), { ...player(4), archived: true });
    data.evaluations = [evaluation(100, all(8)), evaluation(101, all(8), { playerId: uid(2) }), evaluation(102, all(7), { playerId: uid(3) }), evaluation(103, all(10), { playerId: uid(4) })];
    expect(getRankedPlayers(data, session.id).map((row) => row.rank)).toEqual([1, 1, 3]);
  });
  it('retains precision when rounded display scores look tied', () => {
    const data = fixture(); data.players.push(player(2));
    data.evaluations = [evaluation(100, all(7)), evaluation(101, { ...all(7), if_glove: 8 }, { authorId: uid(999) }), evaluation(102, all(7), { playerId: uid(2) })];
    const rows = getRankedPlayers(data, session.id);
    expect(formatScoutingScore(rows[0].overall)).toBe('7.0'); expect(formatScoutingScore(rows[1].overall)).toBe('7.0');
    expect(rows.map((row) => row.rank)).toEqual([1, 2]); expect(rows[0].overall).toBeGreaterThan(rows[1].overall);
  });
  it('orders progress by event date and never increases ratings for logged practice sessions', () => {
    const data = createDemoScoutingData(); const id = data.players[0].id;
    const before = getPlayerHistory(data, id); data.goals[0].sessionsCompleted = 100; data.goals[0].closed = true;
    expect(getPlayerHistory(data, id)).toEqual(before);
    expect(before.map((entry) => entry.session.date)).toEqual(['2026-09-05', '2026-09-26']);
    expect(getDrillSuggestion('if_glove')).toMatchObject({ skillId: 'if_glove', title: 'Quiet glove grounders' });
    expect(getDrillSuggestion('unknown')).toBeNull();
  });
});

describe('scouting data integrity', () => {
  it('validates the synthetic fixture and clones it to protect source data', () => {
    const data = createDemoScoutingData(); const cloned = validateScoutingData(data);
    expect(cloned.players).toHaveLength(6); cloned.players[0].name = 'Changed'; expect(data.players[0].name).toBe('Alex Demo');
  });
  it.each([0, 11, 1.5, '5', undefined])('rejects invalid 1–10 rating %s', (rating) => {
    const data = fixture(); data.evaluations = [evaluation(100, { ...all(5), if_glove: rating })]; expect(() => validateScoutingData(data)).toThrow();
  });
  it('rejects duplicates, invalid dates, missing rating keys, and dangling player references', () => {
    const duplicate = fixture(); duplicate.players.push(player(1)); expect(() => validateScoutingData(duplicate)).toThrow(/unique/);
    const date = fixture(); date.sessions[0] = { ...session, date: '2026-02-30' }; expect(() => validateScoutingData(date)).toThrow(/date/);
    const missing = fixture(); missing.evaluations = [evaluation(100, { if_glove: 5 })]; expect(() => validateScoutingData(missing)).toThrow(/fields/);
    const orphan = fixture(); orphan.evaluations = [evaluation(100, all(5), { playerId: uid(999) })]; expect(() => validateScoutingData(orphan)).toThrow(/unknown player/);
  });
  it.each(['2026-02-30T18:00:00Z', '2026-09-29T24:00:00Z', '2026-09-29T12:00:00.1234567Z'])('rejects a timestamp the server would not accept: %s', (createdAt) => {
    const data = fixture(); data.evaluations = [evaluation(100, all(5), { createdAt })]; expect(() => validateScoutingData(data)).toThrow(/time/);
  });
  it('preserves immutable observations and requires the current author on new observations', () => {
    const data = fixture(); data.evaluations = [evaluation(100, all(5))];
    const changed = structuredClone(data); changed.evaluations[0].ratings.if_glove = 9; expect(() => validateScoutingUpdate(data, changed, DEMO_SCOUTING_AUTHOR_ID)).toThrow(/immutable/);
    const wrongAuthor = structuredClone(data); wrongAuthor.evaluations.push(evaluation(101, all(6), { authorId: uid(999) })); expect(() => validateScoutingUpdate(data, wrongAuthor, DEMO_SCOUTING_AUTHOR_ID)).toThrow(/signed-in coach/);
    const next = structuredClone(data); next.evaluations.push(evaluation(101, all(6))); expect(validateScoutingUpdate(data, next, DEMO_SCOUTING_AUTHOR_ID).evaluations).toHaveLength(2);
  });
  it('retains records and goal provenance while allowing practice progress updates', () => {
    const data = createDemoScoutingData(); const next = structuredClone(data); next.goals[0].sessionsCompleted++;
    expect(validateScoutingUpdate(data, next, DEMO_SCOUTING_AUTHOR_ID).goals[0].sessionsCompleted).toBe(3);
    next.goals[0].skillId = 'hit_swing'; expect(() => validateScoutingUpdate(data, next, DEMO_SCOUTING_AUTHOR_ID)).toThrow(/cannot be changed/);
    const removed = structuredClone(data); removed.goals = []; expect(() => validateScoutingUpdate(data, removed, DEMO_SCOUTING_AUTHOR_ID)).toThrow(/cannot be deleted/);
  });
});

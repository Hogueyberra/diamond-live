import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { answerRequest } from './assistant.mjs';
import { authorize, teamCorpus } from './auth.mjs';
import { retrieveRules, verifiedPitchingAnswer, citation } from './rules.mjs';
const corpus = JSON.parse(readFileSync(new URL('./data/rules.json', import.meta.url)));
const question = 'In HVLL Minor B regular season, may a pitcher throw a fourth inning if they have only thrown 25 pitches? What is the weekly innings limit and when does the week reset? May a pitcher removed earlier return to pitch? Explain the championship exception and whether pitch counts/rest still apply.';

describe('source-grounded rules', () => {
  it('answers the failed innings case without asking the model and attaches exact pages', async () => {
    const model = vi.fn();
    const result = await answerRequest({ mode: 'rules', question, division: 'Minor B', year: '2026' }, { corpus, generateImpl: model });
    expect(model).not.toHaveBeenCalled();
    expect(result.answer).toContain('A fourth inning is not allowed');
    expect(result.answer).toContain('Monday through Sunday');
    expect(result.answer).toContain('removed cannot return');
    expect(result.sources.map((s) => s.page)).toEqual([27, 26]);
    expect(result.answer).toContain('Championship');
    expect(result.answer).toContain('rest rules still apply');
  });
  it('does not apply Minor B/2026 rules to another division, season or a team amendment', () => {
    expect(verifiedPitchingAnswer(corpus, question, { division: 'Minor A', year: '2026' })).toBeNull();
    expect(verifiedPitchingAnswer(corpus, question, { division: 'Minor B', year: '2024' })).toBeNull();
    expect(verifiedPitchingAnswer({ ...corpus, sources: [...corpus.sources, { shared: true, year: '2026' }] }, question, { division: 'Minor B', year: '2026' })).toBeNull();
  });
  it('asks for matching scope and declines unsupported eligibility', async () => {
    const model = vi.fn();
    const wrong = await answerRequest({ mode: 'rules', question: 'Can Minor A pitchers pitch a fourth inning?', division: 'Minor B' }, { corpus, generateImpl: model });
    expect(wrong.method).toBe('clarification');
    const absent = await answerRequest({ mode: 'rules', question: 'Can my eight-year-old pitch today after 42 pitches yesterday?', division: 'Minor B' }, { corpus, generateImpl: model });
    expect(absent.method).toBe('source-passages');
    expect(absent.answer).toContain('cannot confirm');
    expect(model).not.toHaveBeenCalled();
  });
  it('retrieves the correct courtesy-runner rule, without confusing divisions', () => {
    const chunks = retrieveRules(corpus, 'When can we use a courtesy runner for our catcher?', { division: 'Minor B', year: '2026' });
    expect(chunks[0].id).toBe('hvll-2026-section-x-i');
    expect(chunks.every((c) => c.divisions.some((d) => ['Minor B', 'All divisions'].includes(d)))).toBe(true);
  });
  it('rejects model-selected IDs outside the retrieved sources', async () => {
    const result = await answerRequest({ mode: 'rules', question: 'When can we use a courtesy runner?', division: 'Minor B' }, { corpus, generateImpl: async () => ({ ids: ['made-up'] }) });
    expect(result.method).toBe('source-passages');
    expect(result.sources.every((source) => corpus.chunks.some((c) => c.id === source.id))).toBe(true);
  });
  it('includes dated reference documents but flags scanned text for original-page review', () => {
    const scanned = corpus.sources.find((s) => s.ocr);
    expect(scanned).toBeTruthy();
    const chunks = retrieveRules(corpus, 'constitution objective positively impact youth communities', { division: 'Minor B', year: '2026' });
    const chunk = chunks.find((c) => c.sourceId === scanned.id);
    expect(chunk).toBeTruthy();
    expect(citation(corpus, chunk)).toMatchObject({ ocr: true, page: 1 });
  });
  it('never displays a misleading generated interpretation, and restores paragraph conditions', async () => {
    const c = corpus.chunks.find((c) => c.id === 'hvll-2026-section-x-i');
    const result = await answerRequest({ mode: 'rules', question: 'When can we use a courtesy runner?', division: 'Minor B' }, { corpus, generateImpl: async () => ({ answer: 'You may always use a runner.', ids: [c.id] }) });
    expect(result.answer).not.toContain('always');
    expect(result.method).toBe('quoted-rule');
    expect(result.sources[0].quote).toContain('last person');
    expect(result.sources[0].pages).toEqual([26, 27]);
  });
  it('keeps useful source passages available if Ollama is offline', async () => {
    const result = await answerRequest({ mode: 'rules', question: 'When can we use a courtesy runner?', division: 'Minor B' }, { corpus, generateImpl: async () => { throw new Error('offline'); } });
    expect(result.method).toBe('source-passages');
    expect(result.sources.length).toBeGreaterThan(0);
  });
  it('does not mix historical Rookie Ball documents into 2026 answers', () => {
    const historical = new Set(corpus.sources.filter((s) => s.historical).map((s) => s.id));
    const results = retrieveRules(corpus, 'rookie pitching machine', { division: 'Rookie Ball', year: '2026' });
    expect(results.some((c) => historical.has(c.sourceId))).toBe(false);
  });
});

function client({ user = { id: 'user-1' }, role = 'coach', authError = null, dbError = null } = {}) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: authError }) }, from: vi.fn((table) => { const q = { select: () => q, eq: () => q, limit: async () => ({ data: [], error: dbError }), maybeSingle: async () => ({ data: role ? { role } : null, error: dbError }), single: async () => ({ data: { division: 'Minor B', league: 'HVLL' }, error: dbError }) }; return q; }) };
}
const teamId = '00000000-0000-4000-8000-000000000001';
const config = { url: 'https://example.supabase.co', key: 'sb_publishable_test', localToken: 'local-test-secret' };
describe('coaching relevance', () => {
  const input = { mode: 'general', question: 'How can I keep eight-year-olds engaged while they wait for a turn fielding ground balls?' };
  it('replaces the unrelated activities observed in the live fielding test with reviewed guidance', async () => {
    const result = await answerRequest(input, { corpus, generateImpl: async () => 'Practice throwing to a target. Use soft toss hitting. Play a relay race or tag game.' });
    expect(result.method).toBe('guided-coaching');
    expect(result.answer).toContain('outside the ball path');
    expect(result.answer).toContain('enough adults and safe space');
    expect(result.answer).not.toMatch(/throw|hitting|relay|tag game/);
  });
  it('does not suggest extra groups without supervision, while preserving relevant drafts', async () => {
    const unsafe = await answerRequest(input, { corpus, generateImpl: async () => 'Send waiting children to their own stations.' });
    expect(unsafe.method).toBe('guided-coaching');
    const answer = 'Have players notice soft knees, then rehearse without a ball in a safe waiting spot.';
    expect((await answerRequest(input, { corpus, generateImpl: async () => answer })).answer).toBe(answer);
  });
  it('keeps this fielding guidance scoped and still routes rules questions to the sources', async () => {
    const answer = 'Keep throwing feedback brief and encouraging.';
    expect((await answerRequest({ mode: 'general', question: 'How should I encourage someone learning to throw?' }, { corpus, generateImpl: async () => answer })).answer).toBe(answer);
    const model = vi.fn();
    const rule = await answerRequest({ ...input, question: 'What rules apply if my pitcher wants another turn after 42 pitches yesterday?' }, { corpus, generateImpl: model });
    expect(rule.method).toBe('source-passages');
    expect(model).not.toHaveBeenCalled();
  });
});
describe('assistant access', () => {
  it('requires a token and rejects invalid, anonymous, viewer and other-team access', async () => {
    await expect(authorize({ headers: {} }, { teamId }, config)).rejects.toMatchObject({ status: 401 });
    for (const scenario of [{ user: null }, { user: { id: 'user-1', is_anonymous: true } }, { role: 'viewer' }, { role: null }, { dbError: { message: 'offline' } }]) {
      await expect(authorize({ headers: { authorization: 'Bearer token' } }, { teamId }, config, () => client(scenario))).rejects.toHaveProperty('status');
    }
  });
  it('uses remote authentication and membership before accepting a coach', async () => {
    const c = client();
    const result = await authorize({ headers: { authorization: 'Bearer token' } }, { teamId }, config, () => c);
    expect(c.auth.getUser).toHaveBeenCalledWith('token');
    expect(c.from).toHaveBeenCalledWith('team_memberships');
    expect(result.userId).toBe('user-1');
  });
  it('local sample access cannot use a real team or travel through a public proxy', async () => {
    const req = { headers: { 'x-diamond-local-token': config.localToken } };
    expect((await authorize(req, { teamId: 'local-demo' }, config)).userId).toBe('local-preview');
    await expect(authorize(req, { teamId }, config)).rejects.toMatchObject({ status: 403 });
    await expect(authorize({ headers: { ...req.headers, 'cf-connecting-ip': '203.0.113.1' } }, { teamId: 'local-demo' }, config)).rejects.toMatchObject({ status: 401 });
  });
  it('fails closed when the team source library cannot be read', async () => {
    await expect(teamCorpus(corpus, { client: client({ dbError: {} }) }, teamId)).rejects.toMatchObject({ status: 503 });
  });
});

import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const denied = (status, message) => Object.assign(new Error(message), { status });
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export async function authorize(req, input, config, makeClient = createClient) {
  const localToken = req.headers['x-diamond-local-token'];
  if (config.localToken && equal(localToken, config.localToken) && !req.headers['cf-connecting-ip'] && !req.headers['x-forwarded-for']) {
    if (input.teamId !== 'local-demo') throw denied(403, 'Local preview only supports sample data. Sign in to use a real team.');
    return { userId: 'local-preview', team: { division: 'Minor B', league: 'HVLL' }, client: null };
  }
  const bearer = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
  if (!bearer) throw denied(401, 'Sign in to your team to use the coaching assistant.');
  if (!config.url || !config.key) throw denied(503, 'The account connection is not configured.');
  if (!/^[0-9a-f-]{36}$/i.test(input.teamId ?? '')) throw denied(400, 'Choose a team first.');
  const client = makeClient(config.url, config.key, { global: { headers: { Authorization: `Bearer ${bearer}` }, fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.any([init?.signal ?? new AbortController().signal, AbortSignal.timeout(10_000)]) }) }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: { user } = {}, error } = await client.auth.getUser(bearer);
  if (error || !user || user.is_anonymous) throw denied(401, 'Your sign-in has expired. Sign in again.');
  const { data: membership, error: memberError } = await client.from('team_memberships').select('role').eq('team_id', input.teamId).eq('user_id', user.id).maybeSingle();
  if (memberError || !membership || !['owner', 'coach'].includes(membership.role)) throw denied(403, 'Only the team owner and coaches can use the assistant.');
  const { data: team, error: teamError } = await client.from('teams').select('division,league,season').eq('id', input.teamId).single();
  if (teamError || !team) throw denied(403, 'This team is unavailable.');
  return { userId: user.id, team, client };
}

export async function teamCorpus(base, auth, teamId) {
  if (!auth.client) return base;
  const { data, error } = await auth.client.from('guideline_documents').select('id,title,year,chunks').eq('team_id', teamId).eq('status', 'ready').limit(100);
  if (error) throw denied(503, 'The team rules library could not be loaded. Try again.');
  const sources = [...base.sources]; const chunks = [...base.chunks];
  for (const doc of data ?? []) {
    if (!Array.isArray(doc.chunks)) continue;
    sources.push({ id: doc.id, title: String(doc.title).slice(0, 200), year: doc.year, shared: true });
    for (const c of doc.chunks.slice(0, 1000)) if (c.sourceId === doc.id && typeof c.id === 'string' && typeof c.text === 'string' && c.text.length <= 12000 && Array.isArray(c.divisions) && c.divisions.every((d) => typeof d === 'string')) chunks.push(c);
  }
  return { sources, chunks, warnings: base.warnings };
}

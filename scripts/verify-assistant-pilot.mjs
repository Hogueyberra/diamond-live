import assert from 'node:assert/strict';

const site = new URL(process.argv[2]);
assert.equal(site.protocol, 'https:', 'Use the public HTTPS pilot URL.');
const checks = [];
async function check(path, expected, init = {}) {
  const response = await fetch(new URL(path, site), { ...init, signal: AbortSignal.timeout(20_000) });
  assert.equal(response.status, expected, `${path}: unexpected HTTP status`);
  checks.push(`${path}: ${response.status}`);
  return response;
}
const home = await (await check('/', 200)).text();
assert(home.includes('<div id="root"></div>'));
const entry = home.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
assert(entry);
await check(entry, 200, { method: 'HEAD' });
for (const path of ['/prototype', '/preview', '/sign-in']) await check(path, 200);
await check('/rules/2026%20hvll%20bylaws.pdf', 200, { method: 'HEAD' });
const input = { mode: 'rules', teamId: '00000000-0000-4000-8000-000000000001', division: 'Minor B', year: '2026', question: 'Can a pitcher pitch a fourth inning?' };
for (const extra of [{}, { Authorization: 'Bearer deliberately-invalid-test-token' }, { 'x-diamond-local-token': 'not-the-local-secret' }]) {
  await check('/api/assistant', 401, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(input) });
}
for (const path of ['/api/chat', '/api/tags', '/.env.local', '/.assistant-local/runtime.env', '/server/auth.mjs']) await check(path, 404);
console.log(checks.join('\n'));
console.log('Public assets load. Unsigned/invalid requests are denied; raw Ollama and private files are not exposed.');
console.log('A real signed-in owner/coach check is still required.');

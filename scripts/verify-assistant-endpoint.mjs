import assert from 'node:assert/strict';

const site = new URL(process.argv[2] || 'https://assistant.diamondliveapp.com');
assert.equal(site.protocol, 'https:');
assert(!site.username && !site.password && !site.search && !site.hash, 'Use an HTTPS origin without credentials.');
async function check(path, status, init = {}) {
  const response = await fetch(new URL(path, site), { ...init, redirect: 'error', signal: AbortSignal.timeout(20_000) });
  assert.equal(response.status, status, `${path}: unexpected status`);
  return response;
}
const health = await (await check('/api/assistant/health', 200)).json();
assert.equal(health.status, 'ready');
assert(health.documents > 0, 'Rules index is missing');
for (const origin of ['https://diamondliveapp.com', 'http://localhost:5173']) {
  const response = await check('/api/assistant', 204, { method: 'OPTIONS', headers: {
    Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type',
  } });
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.match(response.headers.get('access-control-allow-headers'), /authorization/i);
}
await check('/api/assistant', 403, { method: 'OPTIONS', headers: {
  Origin: 'https://untrusted.example', 'Access-Control-Request-Method': 'POST',
} });
const input = { mode: 'rules', teamId: '00000000-0000-4000-8000-000000000001', division: 'Minor B', year: '2026', question: 'Can a pitcher pitch a fourth inning?' };
for (const extra of [{}, { Authorization: 'Bearer deliberately-invalid-test-token' }, { 'x-diamond-local-token': 'not-the-local-secret' }]) {
  const response = await check('/api/assistant', 401, { method: 'POST', headers: {
    'Content-Type': 'application/json', Origin: 'https://diamondliveapp.com', ...extra,
  }, body: JSON.stringify(input) });
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://diamondliveapp.com');
}
for (const path of ['/', '/sign-in', '/api/chat', '/api/tags', '/api/assistant/other', '/.env.local', '/.assistant-local/runtime.env', '/server/auth.mjs']) {
  await check(path, 404);
}
console.log(`Verified ${site.origin}: rules ready, app CORS allowed, unsigned/invalid requests rejected, other paths closed.`);
console.log('This verifies the tunnel boundary; signed-in answer generation is a separate check.');

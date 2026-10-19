import http from 'node:http';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorize, teamCorpus } from './auth.mjs';
import { answerRequest } from './assistant.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const file of ['.env.local', '.assistant-local/runtime.env']) { const path = resolve(root, file); if (existsSync(path)) process.loadEnvFile(path); }
const corpus = JSON.parse(readFileSync(resolve(root, 'server/data/rules.json')));
const config = { url: process.env.VITE_SUPABASE_URL, key: process.env.VITE_SUPABASE_PUBLISHABLE_KEY, localToken: process.env.DIAMOND_LOCAL_TOKEN };
const allowed = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8788', 'http://127.0.0.1:8788', 'https://diamondliveapp.com', ...(process.env.DIAMOND_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean)]);
const model = process.env.DIAMOND_MODEL || 'qwen2.5:14b';
// A dedicated root-path build prevents ordinary GitHub Pages builds from
// replacing the pilot with assets under the /diamond-live/ URL prefix.
const dist = resolve(root, 'dist-assistant');
let active = 0;
const limits = new Map();
function limited(key, maximum) {
  const now = Date.now();
  for (const [k, v] of limits) if (v.until < now) limits.delete(k);
  const value = limits.get(key) ?? { count: 0, until: now + 60_000 };
  value.count++; limits.set(key, value);
  return value.count > maximum;
}
const json = (res, status, body) => { if (!res.destroyed) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); } };
async function body(req) {
  let bytes = 0; const parts = [];
  for await (const part of req) { bytes += part.length; if (bytes > 12_000) throw Object.assign(new Error('This request is too large.'), { status: 413 }); parts.push(part); }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw Object.assign(new Error('The request could not be read.'), { status: 400 }); }
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const origin = req.headers.origin;
  // Same-origin reverse-proxy requests need no CORS headers. Explicit allowlist for cross-origin app calls.
  if (origin && allowed.has(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  const path = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'OPTIONS' && path === '/api/assistant') {
    if (!allowed.has(origin)) return json(res, 403, { error: 'This website is not allowed to connect.' });
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type'); res.setHeader('Access-Control-Allow-Methods', 'POST'); res.writeHead(204); return res.end();
  }
  if (path === '/api/assistant/health' && req.method === 'GET') return json(res, 200, { status: 'ready', documents: corpus.sources.length });
  if (path === '/api/assistant' && req.method === 'POST') {
    const controller = new AbortController(); res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    let acquired = false;
    try {
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) return json(res, 415, { error: 'Use a JSON request.' });
      if (limited(`ip:${req.socket.remoteAddress}`, 90)) return json(res, 429, { error: 'Too many requests. Wait a minute and try again.' });
      const input = await body(req);
      if (!input || !['rules', 'practice', 'general'].includes(input.mode)) return json(res, 400, { error: 'Choose Rules, Practice, or General chat.' });
      const auth = await authorize(req, input, config);
      if (limited(`user:${auth.userId}`, 12)) return json(res, 429, { error: 'Please wait a minute before asking another question.' });
      if (active >= 1) return json(res, 429, { error: 'The assistant is answering another coach. Try again shortly.' });
      active++; acquired = true;
      // General questions can be routed to rules, so they need the same team
      // amendments and permission-scoped library as the Rules tab.
      const scopedCorpus = input.mode !== 'practice' ? await teamCorpus(corpus, auth, input.teamId) : corpus;
      const value = await answerRequest(input, { corpus: scopedCorpus, model, signal: controller.signal });
      return json(res, 200, value);
    } catch (error) {
      return json(res, error.status ?? 503, { error: error.status ? error.message : 'The assistant could not finish. Please try again. Source documents remain available in Rules.' });
    } finally { if (acquired) active--; }
  }
  if (path.startsWith('/api/')) return json(res, 404, { error: 'Not found.' });
  if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Method not allowed.' });
  try {
    const decoded = decodeURIComponent(path);
    let file = resolve(dist, `.${decoded}`);
    if (file !== dist && !file.startsWith(dist + sep)) return json(res, 404, { error: 'Not found.' });
    if (!existsSync(file) || !statSync(file).isFile()) {
      if (extname(file)) return json(res, 404, { error: 'Not found.' });
      file = resolve(dist, 'index.html');
    }
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.pdf': 'application/pdf' }[extname(file)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': file.endsWith('.html') ? 'no-cache' : 'public, max-age=3600' });
    if (req.method === 'HEAD') res.end(); else createReadStream(file).on('error', () => res.destroy()).pipe(res);
  } catch { json(res, 404, { error: 'Not found.' }); }
});
server.requestTimeout = 100_000;
server.headersTimeout = 10_000;
server.listen(Number(process.env.DIAMOND_PORT || 8788), '127.0.0.1', () => console.log(`Diamond Live assistant listening on loopback port ${process.env.DIAMOND_PORT || 8788}`));

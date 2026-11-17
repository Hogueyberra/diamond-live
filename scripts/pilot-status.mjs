import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

try {
  const namedPath = new URL('../.assistant-local/tunnel-status.json', import.meta.url);
  const named = existsSync(namedPath) ? JSON.parse(readFileSync(namedPath, 'utf8')) : null;
  const label = named ? 'com.diamondlive.tunnel' : 'com.diamondlive.pilot';
  const state = execFileSync('launchctl', ['print', `gui/${process.getuid()}/${label}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (!/state = running/.test(state)) throw new Error(`${label} is not running.`);
  let url;
  if (named) {
    url = 'https://assistant.diamondliveapp.com';
    if (named.url !== url) throw new Error('Unexpected named tunnel address. Review the local configuration.');
    console.log(`Permanent assistant endpoint: ${url}/api/assistant`);
  } else {
    const log = readFileSync(new URL('../.assistant-local/pilot.error.log', import.meta.url), 'utf8');
    const urls = [...log.matchAll(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g)];
    if (!urls.length) throw new Error('The service has not received an address yet.');
    url = urls.at(-1)[0];
    console.log(`Temporary pilot address: ${url}`);
  }
  const response = await fetch(`${url}/api/assistant/health`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`The public connection returned HTTP ${response.status}.`);
  const health = await response.json();
  if (health.status !== 'ready' || !(health.documents > 0)) throw new Error('The assistant rules index is not ready.');
  console.log('Public API and rules index respond. Sign in at https://diamondliveapp.com as an owner or coach.');
  if (named) console.log('Reconnects automatically after login. FileVault requires unlocking after a full reboot.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

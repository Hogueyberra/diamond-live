import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

try {
  const state = execFileSync('launchctl', ['print', `gui/${process.getuid()}/com.diamondlive.pilot`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (!/state = running/.test(state)) throw new Error('The pilot service is not running.');
  const log = readFileSync(new URL('../.assistant-local/pilot.error.log', import.meta.url), 'utf8');
  const urls = [...log.matchAll(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g)];
  if (!urls.length) throw new Error('The service has not received an address yet.');
  const url = urls.at(-1)[0];
  console.log(`Pilot address: ${url}`);
  const response = await fetch(`${url}/api/assistant/health`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`The public connection returned HTTP ${response.status}.`);
  console.log('Public connection responds. Sign in as an owner or coach to use the assistant.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

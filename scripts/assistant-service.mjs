import { spawn } from 'node:child_process';
import '../server/index.mjs';

let ownedOllama = null;
let failures = 0;
async function ensureOllama() {
  try {
    const response = await fetch('http://127.0.0.1:11434/', { signal: AbortSignal.timeout(5000) });
    if (response.ok) { failures = 0; return; }
  } catch { /* Restart only after repeated health failures. */ }
  failures++;
  if (failures < 2 || ownedOllama) return;
  ownedOllama = spawn('/usr/local/bin/ollama', ['serve'], { stdio: 'ignore', env: { ...process.env, OLLAMA_HOST: '127.0.0.1:11434', OLLAMA_NUM_PARALLEL: '1', OLLAMA_MAX_LOADED_MODELS: '1' } });
  ownedOllama.on('error', () => { ownedOllama = null; });
  ownedOllama.on('exit', () => { ownedOllama = null; });
}
ensureOllama();
setInterval(ensureOllama, 15_000);
for (const event of ['SIGTERM', 'SIGINT']) process.on(event, () => { ownedOllama?.kill(); process.exit(0); });

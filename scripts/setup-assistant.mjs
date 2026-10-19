import { mkdirSync, existsSync, writeFileSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('../.assistant-local/', import.meta.url));
mkdirSync(dir, { recursive: true, mode: 0o700 });
const file = `${dir}/runtime.env`;
if (!existsSync(file)) writeFileSync(file, `DIAMOND_LOCAL_TOKEN=${randomBytes(32).toString('hex')}\nDIAMOND_MODEL=qwen2.5:14b\nDIAMOND_PORT=8788\n`, { mode: 0o600 });
chmodSync(file, 0o600);
console.log('Assistant local configuration ready. Run npm run assistant, then npm run dev for the sample-data preview.');

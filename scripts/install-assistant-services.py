"""Install per-user macOS services. No root permission or global power changes."""
from pathlib import Path
import os, plistlib, subprocess, shutil

root = Path(__file__).resolve().parents[1]
local = root / '.assistant-local'
local.mkdir(exist_ok=True, mode=0o700)
agents = Path.home() / 'Library' / 'LaunchAgents'
agents.mkdir(exist_ok=True)
node = shutil.which('node')
if not node:
    raise SystemExit('Node.js is required.')
jobs = {
    'com.diamondlive.assistant': ['/usr/bin/caffeinate', '-i', node, str(root / 'scripts/assistant-service.mjs')],
    'com.diamondlive.preview': [node, str(root / 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
}
for label, args in jobs.items():
    plist = agents / f'{label}.plist'
    if plist.exists():
        old = plistlib.loads(plist.read_bytes())
        if old.get('WorkingDirectory') != str(root):
            raise SystemExit(f'{label} belongs to another installation; not overwriting.')
    value = dict(Label=label, ProgramArguments=args, WorkingDirectory=str(root), RunAtLoad=True, KeepAlive=True, ThrottleInterval=10,
                 StandardOutPath=str(local / f'{label}.log'), StandardErrorPath=str(local / f'{label}.error.log'),
                 EnvironmentVariables={'PATH': str(Path(node).parent) + ':/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin'})
    plist.write_bytes(plistlib.dumps(value))
    plist.chmod(0o600)
    subprocess.run(['launchctl', 'bootout', f'gui/{os.getuid()}', str(plist)], capture_output=True)
    subprocess.run(['launchctl', 'bootstrap', f'gui/{os.getuid()}', str(plist)], check=True)
    print(f'Enabled {label}')

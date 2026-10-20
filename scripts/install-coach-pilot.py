"""A temporary authenticated pilot URL. A named tunnel is needed for a stable domain."""
from pathlib import Path
import os, plistlib, subprocess, re

root = Path(__file__).resolve().parents[1]
local = root / '.assistant-local'
binary = local / 'bin/cloudflared'
build = root / 'dist-assistant'
index = build / 'index.html'
if not index.exists():
    raise SystemExit('Run npm run assistant:build before enabling the pilot.')
assets = re.findall(r'(?:src|href)="(/[^"?#]+)', index.read_text())
if not assets or any(asset.startswith('/diamond-live/') or not (build / asset.lstrip('/')).is_file() for asset in assets):
    raise SystemExit('The pilot build has missing assets or an incorrect URL prefix. Run npm run assistant:build.')
if not binary.exists():
    raise SystemExit('Install the verified official cloudflared binary first.')
label = 'com.diamondlive.pilot'
plist = Path.home() / 'Library/LaunchAgents' / f'{label}.plist'
if plist.exists() and plistlib.loads(plist.read_bytes()).get('WorkingDirectory') != str(root):
    raise SystemExit('An unrelated pilot service already uses this name.')
value = dict(Label=label, ProgramArguments=[str(binary), 'tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:8788'],
             WorkingDirectory=str(root), RunAtLoad=True, KeepAlive=True, ThrottleInterval=20,
             StandardOutPath=str(local / 'pilot.log'), StandardErrorPath=str(local / 'pilot.error.log'))
plist.write_bytes(plistlib.dumps(value)); plist.chmod(0o600)
subprocess.run(['launchctl', 'bootout', f'gui/{os.getuid()}', str(plist)], capture_output=True)
subprocess.run(['launchctl', 'bootstrap', f'gui/{os.getuid()}', str(plist)], check=True)
print('Authenticated pilot tunnel enabled. Its URL is recorded in .assistant-local/pilot.error.log.')

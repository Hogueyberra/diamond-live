"""A temporary authenticated pilot URL. A named tunnel is needed for a stable domain."""
from pathlib import Path
import os, plistlib, subprocess

root = Path(__file__).resolve().parents[1]
local = root / '.assistant-local'
binary = local / 'bin/cloudflared'
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

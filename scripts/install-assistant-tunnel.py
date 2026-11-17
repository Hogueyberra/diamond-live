"""Install a named, API-only Cloudflare tunnel that reconnects at macOS login.

Create the tunnel and its DNS record with cloudflared first. Credentials remain
in .assistant-local; this installer does not change DNS or disable the old pilot.
"""
from pathlib import Path
import argparse
import json
import os
import plistlib
import re
import subprocess
import uuid


ROOT = Path(__file__).resolve().parents[1]
LABEL = 'com.diamondlive.tunnel'
HOSTNAME = 'assistant.diamondliveapp.com'


def private_write(path, content):
    temporary = path.with_name(path.name + '.pending')
    with open(temporary, 'w', opener=lambda p, flags: os.open(p, flags, 0o600)) as stream:
        stream.write(content)
    temporary.chmod(0o600)
    temporary.replace(path)


def configuration(credentials, credential_path):
    tunnel_id = str(uuid.UUID(credentials['TunnelID']))
    if not re.fullmatch(r'[a-fA-F0-9]{32}', credentials.get('AccountTag', '')):
        raise ValueError('Invalid tunnel account identifier.')
    if not isinstance(credentials.get('TunnelSecret'), str) or not credentials['TunnelSecret']:
        raise ValueError('Missing tunnel credential.')
    return {
        'tunnel': tunnel_id,
        'credentials-file': str(credential_path),
        'metrics': '127.0.0.1:20245',
        'loglevel': 'warn',
        'ingress': [
            {'hostname': HOSTNAME, 'path': '^/api/assistant(/health)?$',
             'service': 'http://127.0.0.1:8788'},
            {'service': 'http_status:404'},
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--credentials-file', type=Path, required=True)
    parser.add_argument('--prepare-only', action='store_true', help='Validate config without installing or restarting a service.')
    args = parser.parse_args()
    local = ROOT / '.assistant-local'
    local.mkdir(exist_ok=True, mode=0o700)
    local.chmod(0o700)
    binary = local / 'bin/cloudflared'
    if not binary.is_file():
        raise SystemExit('The existing verified cloudflared binary is required.')
    credentials = json.loads(args.credentials_file.read_text())
    credential_path = local / 'tunnel-credentials.json'
    config = configuration(credentials, credential_path)
    config_path = local / 'tunnel.yml'
    agents = Path.home() / 'Library/LaunchAgents'
    plist = agents / f'{LABEL}.plist'
    if plist.exists() and plistlib.loads(plist.read_bytes()).get('WorkingDirectory') != str(ROOT):
        raise SystemExit('This service name belongs to another installation.')
    if config_path.exists():
        previous = json.loads(config_path.read_text())
        if previous.get('tunnel') != config['tunnel']:
            raise SystemExit('Another tunnel is already configured. Review it before replacing it.')
    private_write(credential_path, json.dumps(credentials))
    private_write(config_path, json.dumps(config, indent=2) + '\n')
    subprocess.run([str(binary), 'tunnel', '--config', str(config_path), 'ingress', 'validate'], check=True)
    if args.prepare_only:
        print('Validated API-only configuration. No service or DNS was changed.')
        return
    agents.mkdir(exist_ok=True)
    job = dict(
        Label=LABEL,
        ProgramArguments=[str(binary), 'tunnel', '--no-autoupdate', '--config', str(config_path), 'run', config['tunnel']],
        WorkingDirectory=str(ROOT), RunAtLoad=True, KeepAlive=True, ThrottleInterval=15,
        StandardOutPath=str(local / 'tunnel.log'), StandardErrorPath=str(local / 'tunnel.error.log'),
    )
    private_write(plist, plistlib.dumps(job).decode())
    subprocess.run(['launchctl', 'bootout', f'gui/{os.getuid()}/{LABEL}'], capture_output=True)
    subprocess.run(['launchctl', 'bootstrap', f'gui/{os.getuid()}', str(plist)], check=True)
    private_write(local / 'tunnel-status.json', json.dumps({
        'hostname': HOSTNAME, 'url': f'https://{HOSTNAME}', 'label': LABEL, 'tunnelId': config['tunnel'],
    }, indent=2) + '\n')
    print(f'Enabled {LABEL}. Stable endpoint: https://{HOSTNAME}/api/assistant')
    print('Starts after login and restarts after a crash. FileVault requires unlocking after a full reboot.')
    print('Verify the public endpoint before retiring the temporary pilot or updating the app.')


if __name__ == '__main__':
    main()

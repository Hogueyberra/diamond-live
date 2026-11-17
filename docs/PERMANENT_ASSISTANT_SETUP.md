# Permanent assistant address

Configured November 17, 2026. Coaches use **https://diamondliveapp.com/**. The app calls **https://assistant.diamondliveapp.com/api/assistant**, backed by the named Cloudflare tunnel `diamond-live-assistant` on Nick's Mac.

The hostname stays the same across Mac IP changes and tunnel restarts. Ordinary restarts need no GitHub variable update, website rebuild, or new coach link. The domain remains registered at Porkbun; DNS uses Cloudflare's Free plan with `cullen.ns.cloudflare.com` and `vera.ns.cloudflare.com`.

## Startup and recovery

- `com.diamondlive.tunnel` starts at user login and restarts after a crash. Cloudflared reconnects when the network returns.
- `com.diamondlive.assistant` starts the API, prevents idle system sleep, and supervises Ollama. `com.diamondlive.preview` is the local development frontend.
- **FileVault is enabled. After a full reboot or power failure, someone must unlock/sign into the Mac.** These per-user services then start automatically. No auto-login, disk-encryption change, or router port forwarding is configured.
- The Mac needs power and internet. An in-flight answer may fail during an interruption; coaches can retry after the service reconnects.

```sh
npm run assistant:status
node scripts/verify-assistant-endpoint.mjs

# The address stays the same when restarting a component.
launchctl kickstart -k gui/$(id -u)/com.diamondlive.tunnel
launchctl kickstart -k gui/$(id -u)/com.diamondlive.assistant
```

## Access and private files

Only the exact assistant API and its public readiness check route to `127.0.0.1:8788`. Other paths return 404. The assistant verifies each signed-in owner/coach against the existing team permissions. Production and local-development origins use the existing CORS allowlist. Ollama stays on `127.0.0.1:11434`.

Tunnel credentials, config, metadata, and logs live in ignored `.assistant-local/`. Credentials/config are mode `0600`; the directory is `0700`. Cloudflare's management certificate is private in `~/.cloudflared/cert.pem`. The running service needs only its tunnel credential, not the management certificate. Never put these credentials in GitHub, browser builds, or chat.

The named tunnel uses the verified local cloudflared binary. Review official cloudflared updates periodically; automatic binary replacement is disabled. Reinstall the assistant services if the Node executable path changes.

## Reproduce on a replacement Mac

Follow [local model setup](LOCAL_AI_SETUP.md) first: install dependencies, Ollama, the model, public account configuration, rule index, frontend build, and assistant startup services. Install cloudflared from its official source. Securely restore the existing tunnel credential into `.assistant-local/tunnel-credentials.json`, then:

```sh
python3 scripts/install-assistant-tunnel.py --credentials-file .assistant-local/tunnel-credentials.json
npm run assistant:status
node scripts/verify-assistant-endpoint.mjs
```

Do not create a new tunnel merely to restart or move this installation. A new tunnel has a different ID and needs a deliberate DNS-route update. If the existing credential is unavailable, arrange replacement access in Cloudflare rather than publishing or sharing the old secret.

For first-time setup only, after official `cloudflared tunnel login` authorization:

```sh
.assistant-local/bin/cloudflared tunnel create --credentials-file .assistant-local/tunnel-credentials.json diamond-live-assistant
python3 scripts/install-assistant-tunnel.py --credentials-file .assistant-local/tunnel-credentials.json
.assistant-local/bin/cloudflared tunnel route dns diamond-live-assistant assistant.diamondliveapp.com
```

The installer refuses to replace another installation's startup job or a config for a different tunnel. `--prepare-only` writes and validates private config without installing/restarting a service or changing DNS.

## Website and DNS

GitHub repository variable `VITE_DIAMOND_ASSISTANT_URL` uses the permanent API URL above; Pages includes it at build time. Other development computers use the same value in `.env.local`. The model-hosting Mac can leave it blank to use its local proxy.

All 16 original Porkbun DNS records were backed up privately and compared with both assigned Cloudflare nameservers before the switch. Website and email records keep their original destinations with DNS-only routing. Only the assistant CNAME uses the Cloudflare tunnel proxy. GitHub Pages, Resend sender records, Porkbun forwarding records, and GitHub domain verification were preserved.

## Verification and rollback

The exact-host/path routing checks passed. The public HTTPS check confirms loaded rules, allowed app CORS, rejection of unsigned/invalid sessions and an untrusted origin, and 404 responses for non-assistant paths. Stopping each service process separately demonstrated automatic tunnel reconnection and backend recovery with Ollama responding. This was a component-restart test, not a full Mac reboot.

The published app was checked in an existing signed-in coach/owner session using the intentionally empty Angels Spring 2027 team. A source-checked pitching answer linked to the original PDF, and the 15-minute team / 10-minute parent plan completed with 10.1 seconds of displayed assistant processing after restart. The plan was left unsaved; no roster or practice records were inserted. Both public DNS resolvers `1.1.1.1` and `8.8.8.8` still returned all 16 original website/email records correctly after cutover.

Stop internet access with `launchctl bootout gui/$(id -u)/com.diamondlive.tunnel`. Move its plist out of `~/Library/LaunchAgents/` to prevent the next-login start; restore/rebootstrap it to reconnect at the same hostname. The API and Ollama remain private.

Local DNS snapshots are `.assistant-local/dns-before-cloudflare.json` and `.assistant-local/dns-prepared-cloudflare.json`. Before any DNS rollback, review later changes. The old nameservers were `curitiba.ns.porkbun.com`, `fortaleza.ns.porkbun.com`, `maceio.ns.porkbun.com`, and `salvador.ns.porkbun.com`; restoring them also requires an assistant routing plan.

References: [Cloudflare named tunnels](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/create-local-tunnel/), [macOS startup services](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/as-a-service/macos/), [Porkbun email with external DNS](https://kb.porkbun.com/article/47-how-to-use-porkbun-email-when-your-dns-is-hosted-elsewhere).

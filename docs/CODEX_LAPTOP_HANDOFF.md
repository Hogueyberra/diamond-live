# Diamond Live: laptop handoff

Prepared November 17, 2026. The replacement host is a Mac with an M5 Pro chip and 48 GB of RAM. It will replace the Mac mini as both the development computer and local AI server. Preparation on the old Mac does not perform that cutover.

## Start here in Codex

Open the cloned repository as a project and use this prompt:

> Read docs/CODEX_LAPTOP_HANDOFF.md, docs/continue-on-another-computer.md, docs/LOCAL_AI_SETUP.md, and docs/PERMANENT_ASSISTANT_SETUP.md. Continue Diamond Live from updated main. This M5 Pro / 48 GB Mac replaces the old Mac as the AI server. Restore only the necessary private files from the encrypted migration backup, recreate startup services for this computer, and verify local and signed-in public requests before retiring the old connector. Keep the permanent assistant URL, existing accounts, and real team data. Do not print credentials, create sample players, rerun hosted database migrations, or change DNS as part of this move.

Sign into Codex and ChatGPT with the same account and workspace. If both computers offer connected-host handoff, save this Git repository as a project on the destination, then use the existing chat's run-location menu to hand it off. Otherwise this document supplies a portable starting point for a new chat. Chat handoff is separate from migrating credentials, installed software, browser storage, or startup services. Reconnect required plugins and sign into websites on the laptop.

## Current project and behavior

- Canonical repository: https://github.com/Hogueyberra/diamond-live, branch `main`. The last application change before migration preparation is `24116869878fd547b910b39b929a92e431ec5df1` (PR #16). Pull newer main, including this handoff.
- Public website: https://diamondliveapp.com/. The new clubhouse is `/`; `/prototype` is the explicit demo and `/workspace` is the older UI. Do not switch back to an old feature branch to recover the design.
- Permanent API: `https://assistant.diamondliveapp.com/api/assistant`. Named tunnel: `diamond-live-assistant`. Preserve the existing tunnel identity. No DNS, registrar, email, or GitHub Pages endpoint change is needed for a host replacement.
- Local ports: API `127.0.0.1:8788`, Ollama `127.0.0.1:11434`, development frontend `127.0.0.1:5173`.
- Selected model: `qwen2.5:14b`, installed model ID prefix `7cdf5a0187d5`, about 9 GB on disk. Start with this tested model and benchmark the new hardware before changing it. Laya is not needed.
- Rules use supplied PDFs, indexed passages, source citations, and a narrow verified pitching answer. Model-generated rule interpretations alone failed eligibility tests. Preserve source checking and season mismatch labels. The supplied 2026 rules do not become 2027 rules because the team's season is 2027.
- Practice plans use reviewed drill steps and aggregate skill counts. Individual names, ratings, and private coach notes do not go into practice-generation requests. Coach review remains required. The real selected team was deliberately left empty; do not fill it with demo players.
- Existing acknowledged team data remains in the same hosted account service. A machine move is not a database migration. Do not run hosted migrations automatically.
- The pilot permits one concurrent model request. More laptop memory does not by itself change this application limit or establish performance with multiple coaches.

## What the encrypted migration package contains

The external-drive package includes an AES-256 encrypted `.dmg`, its SHA-256 checksum, and a non-secret start document. Its password must be kept separately. Mount the image on the laptop and read `START-HERE.md`.

Inside the encrypted image:

- `project/`: a snapshot of project files, including ignored configuration, `.assistant-local`, local reference material, private uploads, evaluation results, and untracked working files. Rebuildable `node_modules`, `dist`, and `dist-assistant`, the live `.git` directory, and this backup's staging directory are excluded.
- `recovery/diamond-live.bundle`: Git branches/tags and committed history as an offline recovery option. Prefer a fresh clone of current main when online.
- `machine/LaunchAgents/`: the three old service definitions for reference. They contain old absolute paths; reinstall services instead of copying them into the new user's LaunchAgents directory.
- `machine/cloudflared/cert.pem`: management-certificate recovery copy, if present. The running tunnel only needs `project/.assistant-local/tunnel-credentials.json`. Do not restore the broader management certificate unless a management task requires it.
- `machine/ollama/`: local settings/history, if present. Download model weights again; model binaries, unrelated Ollama account keys, and caches are excluded.
- `handoff/`: this guide, setup runbooks, model/runtime inventory, and the app-provided conversation record. The conversation record can contain truncated items and is reference material, not an importable Codex database or a guarantee of every original tool output.
- `manifest.json`: file checksums used for a complete decrypted-content verification after image creation.

The image does not contain browser cookies/passwords, browser-local drafts or IndexedDB documents, a full Codex profile, the hosted database, or hosted private storage. These are distinct from the local project backup. Keep original browser sessions/files until any required exports are complete; acknowledged hosted records remain accessible through the existing account. The local preview could not be inspected for browser-only drafts during backup preparation. Do not claim those drafts were exported.

Untracked duplicate files with ` 2` in their names were preserved as recovery material; their original counterparts are the implementation. Do not copy duplicate test/component files into a clean checkout indiscriminately. Private budget/reference PDFs must remain outside the public repository and public build.

## Restore on the laptop without interrupting coaches

1. Install Git, Node.js 22+, Python 3, and the official macOS Ollama app. Ensure the Ollama CLI is available at `/usr/local/bin/ollama`, which the current supervisor uses. Poppler (`pdftotext`) is needed only if rebuilding PDF indexes; existing indexes are committed. Use a stable local project folder, not a temporary directory or the removable drive.
2. Clone the repository, select updated `main`, and run `npm ci`. Follow [computer setup](continue-on-another-computer.md). Mount the encrypted image with its password. Do not place decrypted files in a public or shared folder.
3. Restore `project/.env.local` to the checkout, or recreate its public account configuration as documented. On the AI-hosting laptop, leave `VITE_DIAMOND_ASSISTANT_URL` blank for the local proxy. The deployed website retains the permanent API URL.
4. Run `ollama pull qwen2.5:14b` and `npm run assistant:setup`. The latter generates a new machine-local demo token; retaining the old token is unnecessary. Preserve the existing default model and private loopback binding.
5. Run `npm run assistant:build`, `npm test`, and `npm run build`. Do not rebuild or replace rule indexes unless their source PDFs changed. Start the assistant locally, sign into the local frontend, select the intended existing team, and check rules, practice, and general coaching requests. Never publish the raw Ollama port.
6. Install local startup services with `python3 scripts/install-assistant-services.py`. This regenerates paths for the laptop's user and Node installation. Avoid running a second manual API process on the same port. Reinstall if the Node executable path later changes.
7. Create `.assistant-local` with mode `0700`. Securely copy only the existing `tunnel-credentials.json` into it with mode `0600`. Restore the backed-up Apple Silicon cloudflared executable to `.assistant-local/bin/cloudflared` with execute permission, or obtain and verify the official binary at that path. Do not reuse the old absolute-path `tunnel.yml` or LaunchAgent.
8. Run `python3 scripts/install-assistant-tunnel.py --credentials-file .assistant-local/tunnel-credentials.json --prepare-only`. This validates the API-only configuration without starting an external connector. First verify the laptop's local backend is healthy and the signed-in tests pass.
9. Run the same installer without `--prepare-only` to connect the laptop to the existing named tunnel. While both connectors run, public requests may reach either Mac. Pause the old tunnel only after the laptop is locally ready; verify public requests with only the laptop connector active before declaring cutover complete. Keep the old configuration intact for rollback.
10. Run `npm run assistant:status` and `node scripts/verify-assistant-endpoint.mjs`. Then use a real signed-in owner/coach at the public website to verify a sourced rules answer and a reviewed team/home practice plan. The unsigned boundary check alone does not prove model generation or account access. Do not save test events into the real team merely to verify generation.
11. Test laptop service recovery and a full reboot followed by user unlock/login. Confirm public service resumes. Keep the laptop plugged in, awake, and online; normal lid-close sleep or network loss stops live AI responses. With these per-user jobs and FileVault, someone must unlock/sign in after a full restart.
12. After successful cutover, disable the old tunnel's login job so the retired Mac cannot silently rejoin and serve stale code. Retain the encrypted backup and old Mac until any browser-local data has been reviewed. Do not erase or deregister the old computer as part of an automated restore.

## Existing verification and next work

Before migration preparation, the published app was checked with an actual signed-in coach. A sourced pitching answer worked, and a team/home practice plan completed in 10.1 seconds of displayed processing after a service restart. Component recovery was tested; this was not a full-machine reboot or multi-coach load test.

On November 17, preparation checks again confirmed the public API/rules index, allowed app CORS, rejection of unsigned/invalid sessions, and closed non-assistant paths. The local model list includes `qwen2.5:14b`, `gemma3:12b`, and `qwen3.5:9b`; only the selected default is needed on the laptop. The replacement laptop has not been configured or benchmarked yet.

After migration, resume product work on current main with real team data, preserving the new clubhouse, reviewed practice workflow, and existing permission boundaries. Recheck account/service access when needed; the backup does not grant new permissions.

References: [Codex host handoff](https://learn.chatgpt.com/docs/remote-connections#hand-off-a-chat-between-hosts), [Ollama on macOS](https://docs.ollama.com/macos).

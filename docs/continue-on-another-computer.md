# Continue Diamond Live on another computer

Checkpoint: October 20, 2026. The canonical repository is **https://github.com/Hogueyberra/diamond-live**, default branch **`main`**. It is currently public. The app is hosted by GitHub Pages at **https://diamondliveapp.com**.

## Start development

Install Git and Node.js 22 with npm (Node 22 is the version used by CI). Then:

```sh
git clone https://github.com/Hogueyberra/diamond-live.git
cd diamond-live
git switch main
npm ci
npm run dev -- --port 4173
```

Open `http://localhost:4173/prototype` for the clubhouse, `/preview` for the original coaching demo, or `/sign-in` for account access. Without local account configuration, the demos work and account sign-in reports that setup is needed.

To enable the existing account service locally, copy `.env.example` to `.env.local` and replace the Supabase placeholders with the project's public URL and publishable key. Retrieve those values from the repository's **Settings → Secrets and variables → Actions → Variables**, named `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, or from the existing Supabase project settings. Repository settings require an authorized GitHub login even though source code is public. Restart the dev server after configuration changes. Do not copy a database password, service-role key, OAuth client secret, or SMTP secret into browser variables.

Leave both optional Clerk variables blank for now. Clerk activation is unfinished; follow [clerk-auth-setup.md](clerk-auth-setup.md) after the application choice is resolved. That choice is either a dedicated Diamond Live Clerk application or the existing Deal Desk application. Do not infer a selection from this backup request.

Validation commands:

```sh
npm test
npm run build
```

GitHub Actions also runs the isolated database permission/concurrency suite on pull requests. Deploying `main` reruns application checks and verifies the public routes and artwork. Existing checks passed for application release PR #13: **391 tests in 41 files**, build, database security, and public deployment. This handoff and QA-note backup change documentation only.

## What GitHub contains

- Application source, tests, the pinned dependency lockfile, and build configuration.
- Original clubhouse and umpire artwork, drill demonstrations, local fonts, and license/attribution files.
- Database schema migrations and permission/concurrency tests; migrations describe schema, not a backup of hosted account/team rows or stored files.
- GitHub Pages workflows, domain configuration notes, and account-service setup notes.
- Kestrel research findings, source provenance, screenshots/DOM evidence, implementation plans, and the [prototype QA record](../design-qa.md).

## What a clone does not copy

| Item | Where it lives / how to continue |
| --- | --- |
| `node_modules/` and its caches | Recreate with `npm ci`. |
| `dist/` | Recreate with `npm run build`; it is generated output. |
| `.env.local` and other private environment files | Intentionally excluded. No actual `.env` or `.env.local` file was present in this worktree at the checkpoint; `.env.example` is committed. Recreate public local configuration as above. |
| GitHub/Supabase/Clerk logins, API secrets, and machine credentials | Remain with those services or the local credential manager. Sign into the same authorized accounts on the new computer. GitHub Actions variables/settings are stored on GitHub, not in a clone. |
| Hosted account records, teams, coaching data, and private shared documents | Remain in the existing Supabase project `dzhilnvlsrsfkeezaomi` (`Diamand Demo`). Sign into the same Diamond Live account to access acknowledged shared records. This Git checkpoint does not create a database/storage backup. Do not rerun schema setup against the existing project just to change computers. |
| Prototype video links, Drill Inbox, and player assessments | Stored in browser localStorage for that exact website origin. These currently do **not** sync through the account service and are not in Git. Moving to another computer/browser or between localhost and the public site does not transfer them. |
| Local coaching/scouting/scoring demo edits and unshared guideline imports | Stored in localStorage/IndexedDB; unsynced cloud drafts and some prototype proposals are tab/session-only. Preserve needed originals and use existing JSON download/export controls where available. JSON restore and a complete prototype-data transfer workflow are not implemented. Do not assume those exports cover the video library or prototype assessments. |
| Raw reference downloads and large REA diagnostics | The ignored files listed below remain on this computer. The independent implementation, provenance and useful summaries/screenshots are committed; these raw inspection files are not needed to run the app. |
| Installed REA tools, skills, MCP configuration, Orca/browser sessions, and chat attachments | Machine/app state outside this repository. Reinstall or reconnect on the new computer. Relevant research setup is recorded in [the research plan](research/kestrel/PLAN.md); REA's upstream repository is `https://github.com/morluto/rea.git`. Historical absolute paths in evidence are not portable setup instructions. |

The raw local research exclusions at this checkpoint are:

```text
docs/research/kestrel/artifacts/index-CQLdyNS8.js
docs/research/kestrel/artifacts/index-qLNAtCzC.css
docs/research/kestrel/artifacts/index.html
docs/research/kestrel/browser-help.json
docs/research/kestrel/bundle-readable.js
docs/research/kestrel/evidence/index-CQLdyNS8.js
docs/research/kestrel/evidence/index-qLNAtCzC.css
docs/research/kestrel/evidence/index.html
docs/research/kestrel/rea-focused-static.json
docs/research/kestrel/rea-static.json
docs/research/kestrel/view-schema.json
```

Copy these separately if exact historical raw research is needed. A future download of the reference website may differ from the captured version; the committed `provenance.json` records original hashes.

## Resume the product work

The latest implemented requests are the clickable clubhouse destinations, social/video drill capture, player rating entry/history, and the umpire rules chat. The prototype still uses fictional examples and prepared assistant responses; saved prototype links/ratings are browser-local. The existing signed-in coaching workspace continues to use its established team permissions and cloud storage.

The next pending setup decision is the Clerk application selection. Its frontend and existing-account password fallback are already published, but real Clerk sign-in and verified identity linking have not been activated. Read [the Clerk setup record](clerk-auth-setup.md) before continuing. Current research and product directions are in [the Kestrel plan](research/kestrel/PLAN.md).

## Local AI pilot continuation — October 20

The Mac's AI work is saved on `codex/local-ai-coach` in [draft PR #15](https://github.com/Hogueyberra/diamond-live/pull/15), with `main` through `1a2ddf4` merged in. Continue from that branch to keep both computers' work. It includes the protected Ollama assistant, source-backed league rules, constrained team/parent practices, startup services, and the approved temporary Cloudflare pilot. The real-account pilot check passed. See [the complete local AI runbook](LOCAL_AI_SETUP.md) for the current address, operating commands, and measured limitations.

The live AI is in the signed-in coaching workspace's **Assistant** tab. The clubhouse prototype retains its prepared guide and browser-local records. Clerk remains optional and disabled in this pilot; existing password/email-code access works. The pilot branch has not been merged into the primary site's `main` branch.

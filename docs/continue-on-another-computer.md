# Continue Diamond Live on another computer

Updated November 17, 2026. The canonical repository is **https://github.com/Hogueyberra/diamond-live** and the default development/deployment branch is **`main`**. The public app is **https://diamondliveapp.com/**.

**Replacing the AI-hosting Mac with the M5 Pro laptop?** Use the [Codex laptop handoff and encrypted-backup restore checklist](CODEX_LAPTOP_HANDOFF.md), which also records the current product decisions and the order for moving the permanent tunnel without retiring the old server prematurely.

The new Diamond clubhouse is the home screen at `/`. Signed-in users enter their selected team's shared clubhouse; guests see the labeled sample clubhouse. `/prototype` is the explicit sample version, `/preview` redirects to `/`, and `/workspace` is the older coaching interface retained for compatibility. Do not open `/workspace` expecting the new design.

## Open the current version

For normal use, open **https://diamondliveapp.com/** and sign in with the same Diamond Live account. Select the team and season in the header. An account with owner or coach access can use the assistant and private assessments. If an already-open page still looks old after a release, reload it once.

For a fresh development checkout, install Git and Node.js 22 or later, then:

```sh
git clone https://github.com/Hogueyberra/diamond-live.git
cd diamond-live
git switch main
npm ci
npm run dev
```

Open **http://localhost:5173/**. This is the new clubhouse; no prototype URL or special branch is needed.

For an existing checkout, first inspect `git status`. Commit or preserve your own unfinished changes before switching branches. Then:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
npm ci
npm run dev
```

If `--ff-only` reports divergent local work, reconcile that work with `origin/main`; do not reset it away. The former `codex/local-ai-coach` branch and PR #15 record the work from this chat. New work should start from updated `main`.

## Connect accounts and the Mac-hosted assistant

Copy `.env.example` to `.env.local` and fill in these public browser values from **GitHub repository Settings → Secrets and variables → Actions → Variables**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_DIAMOND_ASSISTANT_URL` — the full protected HTTPS endpoint ending in `/api/assistant`.

With the authenticated GitHub CLI, retrieve each value using `gh variable get VARIABLE_NAME --repo Hogueyberra/diamond-live`. Paste only those public values into `.env.local`, then restart Vite. Do not commit the environment file or use a service-role key, database password, OAuth secret, or SMTP secret.

The frontend on another computer can use the assistant running on Nick's Mac; Ollama does not need to be installed on every computer. The Mac must remain awake, online, and running its assistant and protected tunnel. The backend already allows the production origin and the standard localhost/127.0.0.1 development origin on port 5173. Keep that development port unless the backend's explicit origin list is deliberately updated.

On the Mac that hosts the assistant, leave `VITE_DIAMOND_ASSISTANT_URL` blank to use Vite's local proxy. GitHub Pages reads the repository variable during its build; it cannot run Ollama or a Node backend itself. See [the assistant runbook](LOCAL_AI_SETUP.md) for setup, startup services, model details, and endpoint refresh instructions. The permanent endpoint is `https://assistant.diamondliveapp.com/api/assistant`. Its address survives tunnel and Mac restarts; after a full restart, FileVault still requires unlocking/signing into the Mac. See [permanent assistant operations](PERMANENT_ASSISTANT_SETUP.md).

Leave optional Clerk variables blank until [the Clerk setup](clerk-auth-setup.md) is deliberately completed. Existing account passwords and email codes work independently of that optional integration.

## What is shared

The existing Supabase project `dzhilnvlsrsfkeezaomi` (`Diamand Demo`) holds acknowledged account/team records, rosters, assessments, development plans, schedules, and shared documents. Sign into the same account to access them. A Git clone is not a database backup, and changing computers does not require rerunning schema migrations.

The current Angels Spring 2027 team is intentionally empty at the owner's request. Add real players through **Players → Add player / Import roster**, then record skills under **Development → Skill assessments**. The assistant uses saved skill counts, never demo players, for real-team requests. With no assessments it labels its output as a general beginner plan. Owners review and save AI plans as calendar drafts, assign coaches, and release practice blocks. The parent version is saved in event notes; individual development plans also support approved home cards and verified guardian access.

## What GitHub contains

- App source, tests, dependency lockfile, build/deployment workflows, and setup instructions.
- New clubhouse artwork, fonts/licenses, drill catalog, league PDFs, and searchable rule indexes.
- The protected local assistant server, model evaluation scripts, and Mac service installation scripts.
- Database migrations and isolated permission/concurrency tests, including development plans and My Practice.

## What stays on a computer or service

| Item | How to continue |
| --- | --- |
| `node_modules`, `dist`, `dist-assistant` | Recreate with `npm ci`, `npm run build`, or `npm run assistant:build`. |
| `.env.local`, `.assistant-local`, credentials, service logs | Excluded intentionally. Recreate public config as above; regenerate local secrets with the documented assistant setup. |
| Installed Ollama models and macOS LaunchAgents | Machine-specific. Use the runbook if moving the model host; a normal frontend checkout does not need them. |
| Hosted team rows and private stored documents | Remain in the existing account service, governed by team/guardian permissions. No service data is committed to Git. |
| Explicit sample clubhouse ratings, video links, Drill Inbox, local demo edits, unshared document imports | Browser-local to their exact origin. These do not become shared merely by signing in or cloning the repo. Use available exports and retain original files where needed. |
| Unsynced cloud drafts | Stay in the open tab until acknowledged. Resolve pending saves before switching accounts, teams, or computers. |
| Ignored research downloads, local evaluation output, unrelated reference uploads | Not needed to run the app and not included in the public repository. Historical research summaries and provenance are committed. |

## Verify and publish

```sh
npm test
npm run build
npm run assistant:build
```

`sh supabase/tests/run-local.sh` runs security and concurrency checks in a disposable local PostgreSQL cluster; it does not contact the hosted project. CI also runs those checks on pull requests.

Merging to **`main`** starts **Deploy GitHub Pages**. Wait for the build, deploy, and public verification steps to pass before treating the website as updated. Changes pushed only to another branch do not update the public app; that was the cause of the old-UI mismatch resolved by PR #15.

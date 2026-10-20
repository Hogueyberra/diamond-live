# Diamond Live local assistant

Prepared on October 19, 2026; updated October 20 after merging the latest GitHub work. The local assistant runs on Nick’s Mac mini (M4 Pro, 24 GB). Laya is not installed or required.

## Try it

Open **http://127.0.0.1:5173/** on this Mac, or the public pilot below. The new Angels clubhouse is now the default home, including after sign-in. Choose **Coach’s assistant** for the connected rules, practice, and coaching features. Sign in with an existing owner or coach account to use the assistant; the backend verifies team membership for every request. The clubhouse roster and assessments are demo data, separate from private shared records.

- **League rules:** select the division and season, then ask a question. Replies show matching source passages and original PDF page links. A verified answer handles the 2026 HVLL Minor B pitching inning/reentry case. Other rule explanations primarily show source wording, because model-written interpretations failed an important eligibility test.
- **Practice plan:** choose team priorities or one player, age, attendance, coaches, and the two session lengths. Recorded assessments select activities from a small reviewed library. A parent version uses one tennis ball on clear grass. Copying a handout does not send it to anyone.
- **Coaching chat:** short AI replies for coaching and communication questions. Each question is independent; include the situation in follow-ups. Answers are temporary and clear when leaving the assistant or changing teams.

The initial practice library is a beginner fundamentals pilot for ages 5–12. It does not generate arbitrary workouts, add throwing workloads, or diagnose injuries. Coach review is required before sharing a plan. Names, dates of birth, individual scores, rankings, and coach notes are not included in practice requests; only skill-level counts go to the local backend, and the model receives activity titles for its short coaching note.

## What is running

| Component | Address | Purpose |
| --- | --- | --- |
| Local app preview | `127.0.0.1:5173` | Sample workspace and signed-in app |
| Assistant backend | `127.0.0.1:8788` | Protected assistant API and built frontend |
| Ollama | `127.0.0.1:11434` | Runs `qwen2.5:14b` locally |

Port 8787 was already used by another process and was left alone. All three listed listeners stay on this Mac’s loopback interface. The backend never forwards arbitrary Ollama requests.

The per-user services `com.diamondlive.assistant` and `com.diamondlive.preview` start at login and restart after a crash. The assistant service prevents idle system sleep while it runs and checks Ollama periodically, starting a local Ollama server if it remains unavailable. The display can sleep. After a power failure or restart, macOS still needs the user to log in; FileVault and network availability can affect recovery.

Local settings and logs are in `.assistant-local/`, which is ignored by Git. `runtime.env` is readable only by this user. Its demo access token is injected only by the local development proxy and is never included in the browser bundle. Real teams always require normal authentication.

## Accuracy and speed results

Three installed models were evaluated: `qwen3.5:9b`, `gemma3:12b`, and `qwen2.5:14b`. Unconstrained responses were not reliable enough for pitching eligibility: models sometimes allowed a fourth inning despite citing a three-inning limit. Model choice alone did not solve this.

The selected default is **Qwen 2.5 14B**. It gave more relevant general coaching advice than the faster Qwen 3.5 test. The app limits output length, selects source IDs instead of asking the model to rewrite rules, caches repeated selections for five minutes, and supplies reviewed practice steps. The model stays loaded for 30 minutes after a request; an idle/cold start can take longer.

Observed on this Mac, one request at a time:

| Request | Observed completion |
| --- | --- |
| Verified Minor B fourth-inning answer | About 2 ms at the local API |
| New source lookup | Roughly 4–16 seconds in the selected-model tests |
| Repeated courtesy-runner lookup | 25 ms at the local API |
| Constrained practice plus AI note | About 3–6 seconds |
| Short coaching reply | About 3–6 seconds |

These are sample measurements, not guarantees or a multi-coach load test. The pilot accepts one model request at a time and asks other coaches to retry. Each account is limited to 12 requests per minute. Verified/source fallback behavior remains useful if the model is unavailable; general chat needs a working model.

The integrated rules test covers inning caps, weekly reset, reentry, courtesy runners, eight-player games, playing-time rotation, missing pitch-count/rest eligibility, Minor C bunting, and Rookie Ball stealing. The eight primary selection/behavior cases passed for the chosen model. This checks selected cases, not every possible league question.

Latest validation: 418 tests passed across 45 files, and the production build passed with the existing main-bundle size warning. Live checks rejected unsigned, invalid-session, and demo-to-real-team requests; PDF links opened successfully; simultaneous work returned a retry message; cancellation released capacity for the next request. Browser checks covered rule answers, both practice versions, copying parent instructions, cancelling, and clearing answers on team change. A real signed-in account completed the protected public pilot flow on October 20, including rules, practice, parent copy, and coaching chat. Built files were checked for the local demo token and the unrelated budget file; neither was present.

In that signed-in test, the courtesy-runner lookup showed 14.9 seconds of assistant processing, the repeated lookup rounded to 0.0 seconds, and the 15-minute team/10-minute home plan took 4.7 seconds. These displayed timers exclude authentication and network travel. The verification team had no assessments, so the plan correctly used beginner fielding; assessment-driven selection is covered by the automated and local tests. Current-season shared documents caused the pitching question to show the actual source passages rather than assert the bundled fixed answer.

The live general-chat check exposed unrelated throwing, hitting, and running suggestions for children waiting during a fielding drill. That narrow situation now receives explicit drill context and falls back to labelled coaching guidance if those activities or unsupervised groups appear. The corrected public response took 3.3 seconds and kept waiting players outside the ball path. A separate open-ended request for encouraging words after a missed ground ball returned two relevant phrases in 1.9 seconds. Other general replies remain AI drafts requiring coach review; this check does not certify arbitrary model advice.

## Documents

The supplied `public/rules/` folder contains 11 PDFs, indexed into 298 passages. The 2026 HVLL bylaws use the app’s existing structured section/page index. The supplied PDF’s hash is pinned so a replacement cannot silently reuse old structured answers. The 2024 Rookie Ball rules are historical and excluded from current-season answers. Dated supporting forms and the constitution remain references, not proof that an older policy is current.

The constitution has nine scanned pages. Its cached OCR text is labelled in the app and has not undergone a full transcription audit; open the original page before relying on it. Printed Article II objective text was compared with the scan. OCR may omit handwriting or misread characters. Boundary-map details still require viewing the map.

Shared team guideline documents are read using the coach’s verified session and existing row-level permissions. A failure to read that library stops the request. When a current-season shared document could amend the bylaws, the fixed pitching answer is disabled and the app presents source passages for review.

To rebuild after reviewing changed PDFs:

```sh
npm run assistant:index
npm run assistant:build
launchctl kickstart -k gui/$(id -u)/com.diamondlive.assistant
```

Indexing requires Poppler (`pdftotext`). For a new scanned document, install Tesseract as well, then use `python3 scripts/ocr-rule-pages.py 'public/rules/filename.pdf'`, review the cached transcription, and rebuild. A changed bylaws PDF requires reconciling `src/data/hvll2026.json`, the fixed pitching answer, and its tests before updating the expected hash.

The pilot uses a separate root-path production build in `dist-assistant/`. Run `npm run assistant:build` for this service. The normal `npm run build` retains the existing GitHub Pages configuration and does not replace the pilot files. The pilot installer checks that the built entry assets exist before enabling a tunnel.

## Restart, stop, or reproduce

From the project folder, restart the installed local services:

```sh
launchctl kickstart -k gui/$(id -u)/com.diamondlive.assistant
launchctl kickstart -k gui/$(id -u)/com.diamondlive.preview
```

Stop them for the current login session:

```sh
launchctl bootout gui/$(id -u)/com.diamondlive.assistant
launchctl bootout gui/$(id -u)/com.diamondlive.preview
```

Their files remain in `~/Library/LaunchAgents/`, so they start again on the next login. For a permanent reversible disable, stop them and move those two `com.diamondlive.*.plist` files out of that folder. The unrelated Ollama application can be quit separately if desired.

To reproduce manually with Node 22+ and Ollama installed:

```sh
npm ci
ollama pull qwen2.5:14b
npm run assistant:setup
npm run assistant:index
npm run assistant:build
npm run assistant
# In a second terminal:
npm run dev
```

The app’s existing public Supabase configuration is required for real-account access. No service-role key is used. `python3 scripts/install-assistant-services.py` installs/reinstalls the two local startup jobs, using the current Node executable path. Reinstall after changing that Node installation’s path.

Useful checks:

```sh
npm test
npm run assistant:build
node scripts/evaluate-assistant.mjs qwen2.5:14b
node scripts/smoke-assistant.mjs
```

Evaluation output is saved locally under `output/ai-evaluation/` and ignored by Git. Do not publish local tokens, environment files, logs, or private team questions. The server does not log prompts or authentication headers.

## Protected public pilot — enabled October 20

The user approved the persistent protected pilot on October 20. It is now running through the per-user `com.diamondlive.pilot` service and starts at login. The current address is:

**https://newer-volume-separation-racks.trycloudflare.com/**

Sign in at `/sign-in` with an existing Diamond Live password or email code. The homepage, clubhouse demo, and bundled league PDFs are public. AI requests require a verified owner/coach membership; the local demo bypass is rejected on forwarded requests. Ollama stays on loopback and its raw endpoints are not published. The primary `diamondliveapp.com` deployment is unchanged by this pilot.

The public HTTPS checks passed for the homepage, prototype, capture, preview, sign-in and callback routes, clubhouse/umpire images, and league PDF. Unsigned, invalid-session, and fake-demo-token AI requests returned 401. Raw model routes and local configuration/server source paths returned 404. The user signed in manually, and the owner/coach-protected assistant completed rules, practice, copying the parent handout, and coaching requests through that session. Unit tests cover viewer and other-team denial, and GitHub's isolated database-security checks passed. No messages or sign-in codes were sent automatically.

The optional Clerk setup remains disabled, as documented in `clerk-auth-setup.md`; the existing password/code account flow works without selecting a Clerk application or changing redirect settings. If Clerk is activated later, its provider and exact callback origins must be configured and verified separately.

A quick tunnel changes its address on restart and has no uptime guarantee. Find the latest address with `npm run assistant:pilot-status`. For ongoing coach use, configure a named tunnel and stable domain, then repeat the access checks. Keeping the Mac awake alone does not guarantee internet or service availability. See [Cloudflare's quick-tunnel limits](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

To verify a current pilot URL, run `node scripts/verify-assistant-pilot.mjs https://CURRENT.trycloudflare.com` and `node scripts/verify-public-site.mjs https://CURRENT.trycloudflare.com`. To stop public access, run `launchctl bootout gui/$(id -u)/com.diamondlive.pilot`; moving its plist out of `~/Library/LaunchAgents/` also disables the next-login start. This does not stop the private local assistant.

## GitHub continuation checkpoint

Merged GitHub `main` at `1a2ddf4` (the October 20 cross-computer handoff) into `codex/local-ai-coach`, preserving the clubhouse, drill/video library, local player assessments, umpire rules lookup, and password/optional-Clerk sign-in. At the user’s request, the new clubhouse is now the default home at `/`; `/preview` redirects there and `/prototype` remains compatible. The **Coach’s assistant** button now opens the live assistant in the clubhouse’s light design, replacing its prepared guide. Sign-in returns to the clubhouse.

Practice planning reads the demo’s broad hitting, throwing, fielding, and baserunning assessments without inventing granular scouting scores. Only observed/needs-practice counts leave the browser. The user’s real team ID authorizes the request and scopes shared rule sources; the demo roster and records are never uploaded into that team. Existing shared records remain available from the account menu at `/workspace`, with the older local demo at `/workspace/demo`.

Browser verification confirmed the signed-in default clubhouse and a demo-player-based plan (15 minutes team, 10 minutes home) in the new assistant. The planner selected balance work for a low hitting assessment. Public route/artwork and unauthorized-access checks passed again. Account/team changes abort assistant work and clear prior answers; guest and viewer accounts do not receive private assistant controls.

Compatible dependency fixes updated Vite to 8.3.4 and source-map-js to 1.2.2 with their build dependencies. The post-update audit reported zero vulnerabilities. Source, lockfile, tests, and startup scripts are saved together in [draft PR #15](https://github.com/Hogueyberra/diamond-live/pull/15). The unrelated budget PDF was not changed or published.

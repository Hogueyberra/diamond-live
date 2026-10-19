# Diamond Live local assistant

Prepared on October 19, 2026. The local assistant runs on Nick’s Mac mini (M4 Pro, 24 GB). Laya is not installed or required.

## Try it

Open **http://127.0.0.1:5173/preview** on this Mac and choose **Assistant**. The sample team works without sign-in. Sign in through the app to use a real team; the backend checks the signed-in account and requires an owner or coach membership on that team.

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

Final validation: 365 tests passed across 36 files, and the production build passed with the existing main-bundle size warning. Live checks rejected unsigned, invalid-session, and demo-to-real-team requests; PDF links opened successfully; simultaneous work returned a retry message; cancellation released capacity for the next request. Browser checks covered rule answers, both practice versions, copying parent instructions, cancelling, and clearing answers on team change. A real signed-in coach session still needs an end-to-end check. Built files were checked for the local demo token and the unrelated budget file; neither was present.

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

## Remote coach access — awaiting approval

The public website has not been deployed with this feature. A prepared Cloudflare pilot would serve the built app and its protected assistant API through a temporary `*.trycloudflare.com` address. The homepage and league PDFs would be public; assistant requests would require a signed-in owner or coach. The local sample bypass is rejected on forwarded requests. Ollama itself would remain private.

Automatic approval review rejected starting that persistent public tunnel because the destination, access scope, and persistent exposure needed specific approval. The user has been asked; no tunnel is running. `scripts/install-coach-pilot.py` is prepared but must not be run until that approval is received.

After approval, finish a real signed-in coach test using the existing emailed-code flow, verify viewer/other-team denial over the public route, and check simultaneous-request behavior before sharing the link. The current sign-in flow uses a code entered in the app, not a redirect or magic-link callback, so a pilot hostname does not require changing the auth redirect allowlist. A quick tunnel changes hostname when restarted and has no uptime guarantee. For ongoing coach use, configure a named tunnel and stable domain, then perform the same access checks. Keeping the Mac awake alone does not guarantee internet or service availability.

Work is saved on branch `codex/local-ai-coach`. The unrelated budget PDF was not changed.

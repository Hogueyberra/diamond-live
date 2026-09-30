# Diamond Live

Coaching workspace prototype for the **Angels, Huntington Valley Little League Minor B**, with an isolated **Seals** demo team. The home screen connects team schedules, coaching observations, practice activities, and source-linked division rules. Events, locations, and notes are clearly labeled demo data; the actual Angels schedule and roster have not been added.

The original **Tustin 10U Hawks** Saturday scoring prototype remains at `/demo`. Its simplified scoring rules are demo rules; it is not ready to serve as the Angels' official scorebook.

## Current implementation — September 29, 2026

Signed-out visitors begin on the public homepage: **Great seasons. Lifelong athletes.** It introduces the current coaching tools through an interactive product tour, explains three setup steps, and connects the product to long-term player development. **Start your team** opens email sign-in; **Explore the demo** opens `/preview`. Signed-in users enter their private team workspace. See the [homepage brief](docs/homepage-brief.md) and [original image notes](docs/homepage-imagery.md).

The coaching workspace has **Overview, Players, Schedule, Coaching, Rules, and Scouting** tabs within one screen. You can create and filter games and practices, open event details, capture coaching notes, review a note into a timed practice activity with an objective and success measure, and record completion and an outcome. Records are scoped to the selected demo team and its fixed demo season.

Uses the licensed **Clinch** design system. See the [design guidance](DESIGN.md), [license](src/design-system/LICENSE.md), and [attribution notices](src/design-system/ATTRIBUTION.md).

The Rules view searches **204 source sections** from the complete substantive text of the **2026 HVLL Bylaws and Local Rules** (PDF pages 2–55; the table of contents is omitted). It covers all seven listed divisions, general playing rules, policies, tournaments, and safety. Filter by division, document, and year; search words or quoted phrases; open the full original passage and its page citation. Division filters retain general sections, whose own conditions still need to be read.

The [league’s official PDF](https://dt5602vnjxv0c.cloudfront.net/portals/20562/docs/2026/2026%20hvll%20bylaws.pdf), linked from its [Document Center](https://www.hvll.org/Default.aspx?tabid=1297730), was downloaded and verified byte-for-byte against the supplied source on September 29. Only its searchable text is bundled; the PDF is linked externally. Separate Little League rulebooks, fall supplements, and subsequent updates are not included.

**Add document** reads PDF, UTF-8 text, and Markdown locally, previews the extracted text, and saves the original and index in IndexedDB. Limits are 20 MB and 150 PDF pages. Searchable-text PDFs are required; scanned-page gaps are reported. Duplicate imports and failed saves are surfaced. Imports stay in the current browser, survive reloads, and can be removed from Documents. They do not sync between devices or upload to a server. See [guidelines library](docs/guidelines-library.md).

Coaching edits persist in a separate browser store. Failed saves retain session changes and provide retry and JSON backup controls; invalid saved data pauses editing. Backup import/restore is not implemented. This is local storage, not shared storage or cloud backup.

Still to build: real Angels schedule and roster, event editing and cancellation, full season management, automated insights, video, and restoring exported backups. Coaching currently starts from human observations. Streaming will later add evidence for coaching and postgame takeaways; full GameChanger parity remains a longer-term backlog. An unconfigured public preview remains a demonstration workspace; shared team use activates after the Supabase setup and live verification below.

- Repository: [Hogueyberra/diamond-live](https://github.com/Hogueyberra/diamond-live)

## Web preview

The custom domain is configured as [diamondliveapp.com](https://diamondliveapp.com/), and the root-path deployment completed on September 30, 2026. **HTTPS is active and public routes are verified; final sign-in and shared-team verification are in progress.** GitHub Pages continues to host the app; no paid hosting plan is needed. See the [domain setup record](docs/diamondliveapp-domain-setup.md) for the completed checks and remaining verification. The previous address is [Diamond Live on GitHub Pages](https://hogueyberra.github.io/diamond-live/).

The release workflow publishes `main` after tests and a production build. Its base path defaults to `/` for the custom domain; repository variable `VITE_BASE_PATH` can override it for rollback or another host. Sign out or use a private browser window to see the public homepage.

Signed-in shared records remain in the existing Supabase project. A different website origin requires a new sign-in; browser-local demo records, unsynced drafts, and unshared document imports do not transfer automatically. Export or explicitly share needed local data before cutover.

## Run locally

```bash
npm ci
npm run dev
```

The dev server uses base path `/`. For the custom-domain production build, use `VITE_BASE_PATH=/ npm run build`; the Pages and PR-check workflows default to that root path. A manual build without the variable retains `/diamond-live/` for the original project-site deployment.

```bash
npm test
npm run build
```

The build copies `dist/index.html` to `dist/404.html`, so a refresh on a deep link such as `/scorebook` still opens the app. Old `/diamond-live/…` bookmarks are normalized to the corresponding root route with their query and fragment preserved. The original GitHub URL redirect must be verified during cutover.

## Routes

- `/` public homepage for signed-out visitors; private coaching workspace for signed-in users
- `/preview` explicit browser-local coaching demo with Overview, Players, Schedule, Coaching, Rules, and Scouting tabs
- `/demo` original Saturday board for the role you are viewing as
- `/lineup` batting order, positions, and who has arrived
- `/scorebook` count, diamond, complete pitch history, and audited undo
- `/film` Chris's shot list
- `/family` Jordan's arrival, orange slices, and a text for the group thread

## Local scoring foundation

Every accepted action has a stable game/event identity and an ordered record. The app reconstructs its state from a frozen checkpoint and those events. Pitch records retain batter identity, runner movements, demo actor, entry time, and an optional actual play time. **Undo last pitch** preserves the original pitch and adds a correction entry while retaining unrelated team updates.

The browser library keeps reset games, and **Download game records** exports the whole library as JSON. Import/restore from downloaded JSON is not implemented yet. Legacy saved games migrate as checkpoints with their earlier play history explicitly unavailable. Failed writes display an unsaved warning and retry; invalid or unsupported saved data opens a recovery screen without overwriting the game.

This is single-device storage, not cloud backup. Use one tab for scoring. Shared scoring, authentication, offline synchronization, HVLL rule enforcement, broadcasting, and video highlights remain future work. The coaching rules library is a reference layer and does not change the scoring engine. See [the event model and remaining rules](docs/event-model.md).

## Accounts and shared storage

Supabase integration adds email-code sign-in, profiles, private teams, coach/viewer permissions, invitation codes, shared coaching records, and private guideline files. Cloud access is enabled only when a real project has been migrated and configured. See [setup and live verification](docs/shared-storage-setup.md).

The signed-out demo continues using browser storage. Signed-in teams begin empty, sync every 15 seconds/on focus, and reject stale saves instead of overwriting another device. Guidelines refresh every 30 seconds; existing browser imports are shared only through an explicit review/upload action. Shared document removal is recoverable. Unsynced coaching drafts are tab-local until the server acknowledges them.

## Coach scouting and development

The **Scouting** tab provides private draft boards, player profiles, dated assessments, ten separate 1–10 skill ratings, coach observations, and development goals. Infield, Outfield, and Hitting each contribute one-third of the overall score; all ten skills must be observed to rank a player. The latest assessment submission from each coach counts once. Practice logs record effort without automatically raising ratings. See [scouting behavior, privacy, and setup](docs/scouting.md).

Only owners and coaches can access team scouting. Evaluations use a separate Supabase table and guarded RPCs, independent of the viewer-readable coaching workspace. Cloud drafts stay in memory until acknowledged, with retry/export/conflict recovery. Signed-out scouting contains clearly labeled synthetic examples saved only in that browser. Player/family progress views and video evidence remain future work.

## Team setup and practice planning

The Overview setup checklist leads coaches through Players → Schedule → Assessments → Practice plan. Players and Scouting share the same coach-only roster and player IDs. The team owner acts as manager.

- **Players → Import roster:** paste names, or upload CSV/TSV/text. Only names are required; review the preview before saving. Same-name duplicates are skipped for review. Existing players can be edited individually.
- **Schedule → Import schedule:** import a CSV/TSV or an iCalendar `.ics` file. Dates and times are validated and converted to the team's Pacific timezone. Unsupported all-day, overnight, recurring, or ambiguous calendar events are flagged for correction rather than guessed. Imports are one-time copies, not a GameChanger connection.
- **Scouting:** create a baseline assessment, rate observed skills, and use **Plan practice from these ratings**. Unobserved skills stay blank.
- **Practice plan:** the manager reviews a suggested team or player drill, edits its instructions, and approves a time block. Each block includes a setup, equipment, steps, coach cue, and success check. Managers can reorder blocks, change durations, assign staff, and open coach sign-up. Assistants can claim an unassigned released block or release their own; managers can override assignments.
- Ratings and draft rankings remain coach-only. An explicitly approved individual drill shares the selected player's name and instructions with team members. No ratings are copied into shared plans.

The importer links the official [GameChanger calendar instructions](https://help.gc.com/hc/en-us/articles/115005457626-Integrating-Your-Personal-Calendar) and [season stats export instructions](https://help.gc.com/hc/en-us/articles/360043583651-Exporting-Season-Stats). A stats export is only a starting point for preparing a roster; it is not represented as a complete roster export.

See [practice recommendations, permissions, and drill sources](docs/practice-planning.md). Database permission and simultaneous-claim tests run with `supabase/tests/run-local.sh` in an isolated PostgreSQL cluster. The additive `manager_practice_assignments` migration must be applied before publishing this UI.

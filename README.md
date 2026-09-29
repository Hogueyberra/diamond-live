# Diamond Live

Coaching workspace prototype for the **Angels, Huntington Valley Little League Minor B**, with an isolated **Seals** demo team. The home screen connects team schedules, coaching observations, practice activities, and source-linked division rules. Events, locations, and notes are clearly labeled demo data; the actual Angels schedule and roster have not been added.

The original **Tustin 10U Hawks** Saturday scoring prototype remains at `/demo`. Its simplified scoring rules are demo rules; it is not ready to serve as the Angels' official scorebook.

## Current implementation — September 28, 2026

The coaching workspace has **Overview, Schedule, Coaching, and Rules** tabs within one screen. You can create and filter games and practices, open event details, capture coaching notes, review a note into a timed practice activity with an objective and success measure, and record completion and an outcome. Records are scoped to the selected demo team and its fixed demo season.

Uses the licensed **Voltline Analytics** design system. See the [design guidance](DESIGN.md), [license](src/design-system/LICENSE.md), and [attribution notices](src/design-system/ATTRIBUTION.md).

Three Minor B rule references cover playing-time rotation, continuous batting, and pitching innings. Each cites a section and page of the [official public 2026 HVLL bylaws](https://dt5602vnjxv0c.cloudfront.net/portals/20562/docs/2026/2026%20hvll%20bylaws.pdf), linked from the [HVLL Document Center](https://www.hvll.org/Default.aspx?tabid=1297730). The app opens that external source. User-uploaded PDF files and rendered page images are excluded from the deployed assets. References are marked **Source checked · Coach review pending**; complete rule enforcement remains future work.

Coaching edits persist in a separate browser store. Failed saves retain session changes and provide retry and JSON backup controls; invalid saved data pauses editing. Backup import/restore is not implemented. This is local storage, not shared storage or cloud backup.

Still to build: real Angels schedule and roster, event editing and cancellation, authenticated shared access, full season management, automated insights, video, and restoring exported backups. Coaching currently starts from human observations. Streaming will later add evidence for coaching and postgame takeaways; full GameChanger parity remains a longer-term backlog. These notes describe local implementation, not a deployment or production-readiness claim.

- Repository: [Hogueyberra/diamond-live](https://github.com/Hogueyberra/diamond-live)

## Deployment preparation

The current coaching build is being prepared for [GitHub Pages](https://hogueyberra.github.io/diamond-live/). Publication of this revision and live verification are pending. The existing Pages workflow installs dependencies, runs tests, and builds the app with the `/diamond-live/` base path.

After deployment, verify the coaching home at phone width, a direct scorebook link and refresh, the external official rulebook link, and saving/reloading a coaching note. Earlier local screenshots are historical evidence; they do not verify the deployed revision or its updated external source links. Browser data stays on the device where it was entered, so a phone has its own local workspace.

## Run locally

```bash
npm ci
npm run dev
```

The dev server uses base path `/`. A production build defaults to `/diamond-live/` so a GitHub Pages project site can load assets and routes. Set `VITE_BASE_PATH` to override that.

```bash
npm test
npm run build
```

The build copies `dist/index.html` to `dist/404.html`, so a refresh on a deep link such as `/diamond-live/scorebook` still opens the app.

## Routes

- `/` coaching workspace with Overview, Schedule, Coaching, and Rules tabs
- `/demo` original Saturday board for the role you are viewing as
- `/lineup` batting order, positions, and who has arrived
- `/scorebook` count, diamond, complete pitch history, and audited undo
- `/film` Chris's shot list
- `/family` Jordan's arrival, orange slices, and a text for the group thread

## Local scoring foundation

Every accepted action has a stable game/event identity and an ordered record. The app reconstructs its state from a frozen checkpoint and those events. Pitch records retain batter identity, runner movements, demo actor, entry time, and an optional actual play time. **Undo last pitch** preserves the original pitch and adds a correction entry while retaining unrelated team updates.

The browser library keeps reset games, and **Download game records** exports the whole library as JSON. Import/restore from downloaded JSON is not implemented yet. Legacy saved games migrate as checkpoints with their earlier play history explicitly unavailable. Failed writes display an unsaved warning and retry; invalid or unsupported saved data opens a recovery screen without overwriting the game.

This is single-device storage, not cloud backup. Use one tab for scoring. Shared scoring, authentication, offline synchronization, HVLL rule enforcement, broadcasting, and video highlights remain future work. The coaching rules library is a reference layer and does not change the scoring engine. See [the event model and remaining rules](docs/event-model.md).

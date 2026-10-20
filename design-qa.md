# Coach Desk prototype verification

This is the chronological prototype QA record. The October 20 application release subsequently passed 391 tests, the production build, database permission checks, and public deployment verification. For the current resume point, see [the backup handoff](docs/continue-on-another-computer.md).

Source visual truth: `docs/research/kestrel/evidence/01-floor.png`, `02-athletes.png`, `03-assessments.png`, `04-calendar.png`, `05-programs.png`, and `06-chief.png`.

Implementation: `/prototype`, isolated from `/preview` and the existing scoring routes. This is the approved Diamond Live adaptation of Kestrel's workbench patterns, not a pixel-for-pixel copy of its business, branding, or example athletes.

## Findings and repairs

- Fixed player-to-development selection when the destination was already mounted, including repeated requests for the same player. Previously mounted views retain their session edits.
- Fixed missing React hook imports introduced during the final mobile detail-scroll refinement. Recovered the browser page and reran the prototype tests after repair.
- Reconciled sample coach names, player observations, and the Saturday practice across the independently built views.
- Reduced desktop stage height so navigation stations remain visible near the review queue. Original baseball illustration is shown without cropping or stretching.
- Replaced invented live weather with a sample practice status. Agent activity is not presented as live automation.
- Corrected empty-week event counts, drill-duration totals, and base-path-aware links to the existing workspace.
- Mobile player, assessment, drill, and event selection brings the corresponding details into view. Reduced-motion users receive an immediate scroll.
- Scoped all prototype styles and lazy-loaded the prototype route. Existing team data contracts, permissions, and scoring behavior were not changed.

## Visual comparison

The reference and desktop implementation were opened together at 1289×921 CSS pixels, scale factor 1; source and implementation PNG dimensions match. No rescaling or device frame was used. Tablet was checked at 834×900 and narrow layouts at 390×844. Reviewed full composition and readable detail captures for the queue, review dialog, player panel, development proposal, calendar, library, and assistant.

- **Fonts:** Locally bundled Barlow body and Barlow Condensed display fonts match the reference families. Fonts loaded in the browser. Headings, compact rows, selected labels, and dialog wrapping were inspected.
- **Spacing:** Warm workspace, white bordered panels, compact header, selected-record details, and right-hand work surfaces follow the reference. Diamond Live intentionally adds a short page heading and places station navigation below its original illustration. Pages use natural document scrolling rather than Kestrel's fixed-height interior panels.
- **Colors:** Paper, clay, forest, ink, and cobalt follow the reference palette. Clay marks the team/product identity; cobalt identifies assistant and primary actions; status also has text.
- **Images:** The clubhouse is an original generated 1536×1024 PNG, saved to `public/prototype/clubhouse.png`; aspect ratio is preserved with `object-fit: contain`. The reference's proprietary stadium illustration is not shipped. Library cards use deliberate Phosphor category icons and numbered drill cards, not claims of playable video thumbnails.
- **Copy:** Team coaching replaces training-business package sales, renewal, booking, and SMS concepts. Synthetic records, prepared assistant responses, session-only approvals, and the prototype-only rating rubric are labeled. No simulated result is presented as a production save or family delivery.

## Captured implementation states

Screenshots and DOM snapshots are paired under `docs/research/kestrel/prototype-qa/`:

| Capture | Evidence |
| --- | --- |
| Coach Desk | `21-desktop-final.png` |
| Review suggestion dialog | `02-review.png` |
| Players | `04-players.png` |
| Development | `05-development.png` |
| Calendar | `06-calendar.png` |
| Drill library | `07-library.png` |
| Prepared assistant | `08-assistant.png`, `09-assistant-answer.png` |
| Drill added to local draft | `11-library-added.png` |
| Category filtering and source references | `12-library-filter.png`, `13-rules.png` |
| Narrow layout | `14-mobile-desk.png` through `19-mobile-library.png` |
| Tablet layout | `20-tablet-desk.png` |

Initial `03-approved.png` was rejected because a subsequent navigation raced its screenshot; the approval transition is established by its DOM snapshot, the tested interaction, and a later browser check. Captures made during the missing-import failure were rejected and recaptured. Resizing/reload can reset Orca viewport emulation; final narrow captures explicitly set the viewport again.

## Interaction checks

- Desktop navigation, query-string views, and links to the existing workspace.
- Review dialog open, inspect, approve, and updated review count/activity.
- Player search, empty-result recovery, selection, and development handoff.
- Editable proposal cue/duration, validation, approval locking, completion, and retained edits across navigation.
- Calendar week navigation, empty weeks, return to sample week, agenda, and selected-event details.
- Drill categories, local draft addition/removal, rules, document references, and draft retention across navigation.
- Assistant suggestions, prepared response, destination link, close control, and native dialog behavior.
- Desktop image load, fonts loaded, narrow navigation without horizontal discovery, and stacked work areas.
- A fresh browser tab navigated through all five views after the final repairs. All expected headings were present and its console contained zero errors or warnings; see `fresh-navigation-check.json` and `fresh-console.json` in the capture folder. The preview remains open on Coach Desk.

## Automated validation

- Production build passed after final hook-import repair. Vite still reports the preexisting large main bundle warning; the prototype has its own lazy chunk.
- Full regression run with two workers: 350 tests passed; one older coaching test failed because its September practice had passed on the actual October clock.
- Pinned that existing test's Date clock to its fixture date, leaving real timers and application behavior intact. Focused rerun: 20 tests across prototype, coaching, and app entry passed.
- Added a calendar/library cross-view check and reran final prototype tests after mobile changes: **6 tests passed**.
- Initial default-concurrency and one subsequent worker startup attempt timed out in the local test runner; successful bounded-worker reruns are recorded above.
- `git diff --check` passed.

## Limits and follow-up polish

- This is a functional frontend prototype with fictional records and session state, not the durable task queue, cloud AI integration, or messaging system in later plan phases.
- Native browser dialog semantics and visible focus states were checked; no screen-reader certification or exhaustive accessibility audit is claimed.
- Some small secondary metadata can be enlarged in the next visual iteration. This does not hide required controls or primary content in the inspected layouts.
- Narrow captures are desktop-browser responsive emulation, not a physical touch-device test.
- Read-only dependency audit reported a preexisting transitive development-tool advisory in `source-map-js@1.2.1` (GHSA-68fv-2mgg-jv7q). Dependency versions were not changed in this UI task.
- No deployment, production team-data update, or external message send occurred.

final result: passed

## October 20 update: interactive clubhouse and video library

The clubhouse now contains four responsive navigation hit areas. Eleven original drill guides include stick-figure diagrams and opt-in playback. Saved video references persist in an isolated browser library and can be reviewed and attached to matching sample development proposals. Proposal and practice-draft edits remain session-only.

Final production build and all **14 prototype/media tests** passed. See [the interaction, evidence, and follow-up notes](docs/research/kestrel/INTERACTIVE-LIBRARY.md). The new phone layout places the clubhouse before the review queue.

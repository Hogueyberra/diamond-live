# Interactive clubhouse and visual drill library

Implemented October 20, 2026, at `/prototype`.

## Interaction model

- The source image and its four HTML button hit areas share a 3:2 coordinate space at every screen width. The dugout opens Players; batting cage opens Development; equipment wall opens Library; planning desk opens Calendar. Keyboard focus and hover reveal the active region. Top navigation remains available. The clubhouse appears first on narrow screens.
- Eleven existing original practice drills now have original SVG stick-figure illustrations. Lesson details offer three labelled poses, previous/next, and explicit play/pause. Nothing starts automatically. Playback pauses when the workspace is hidden; a changed reduced-motion preference stops playback. Manual playback remains available as an explicit choice.
- Library → Video links saves public HTTPS references from YouTube, Instagram, TikTok, Vimeo, Facebook, and other sites. The form captures a coach-entered title, creator, companion skill/lesson, notes, and review state. It does not download a video, import a transcript, infer its content, or fabricate a thumbnail.
- Search covers title, creator, platform, coaching notes, and associated drill metadata. Category filters narrow the results. Links open their original source in a separate tab.
- The companion lesson is our original skill guide, clearly identified separately from the linked creator's content. It includes a visual, setup, equipment, steps, cue, success measure, and existing safety guidance.
- Development matches saved resources to four sample observed player focuses. Reviewed resources can be attached to the player's session-only proposal. Approval locks attachment edits alongside the existing proposal fields. Unobserved sample players retain an observation-first state.

## Data boundaries

Saved resources use the isolated local-storage key `diamond-live:prototype:video-library:v1`. They survive reloads on this origin/browser, with a session fallback if storage is blocked. They are not synchronized to team accounts. A maximum of 200 links bounds this prototype collection.

Only HTTPS URLs without embedded credentials are accepted. Common YouTube watch, Shorts, and short links normalize for duplicate detection; common tracking parameters are removed. Unknown drill IDs and invalid stored records are rejected or skipped. Changing a saved URL or its associated skill clears the review checkbox. Prototype team data, approval state, and attachments still reset on reload.

## Validation

- `npm run build`: passed. Existing main-chunk size advisory remains.
- `npx vitest run src/prototype/Prototype.test.jsx src/prototype/drillMedia.test.jsx src/prototype/drillResources.test.js --pool=threads --maxWorkers=1 --testTimeout=60000`: **14 tests passed across 3 files**.
- Tests cover all four clubhouse destinations, existing cross-view behavior, URL validation and platform recognition, duplicate YouTube links, save/edit/review/attach/approval flow, persistence and removal, blocked/corrupt storage, and playback stepping, pause, and suspension.
- An earlier forks-worker startup timed out before the integration tests ran; the subsequent threads run above completed.
- Orca browser inspection covered the new cards, selected visual lesson, mobile link form, and a temporary saved resource. Mobile viewport measured 390 CSS pixels with document width 375 (no horizontal overflow).
- Screenshots are in `interactive-library-qa/`. The initial desktop emulation produced tiled capture artifacts and was replaced with a valid capture at the actual browser pane width. These captures are responsive browser checks, not physical-device certification.
- The temporary `https://example.org/prototype-qa-drill` browser entry was used only for form and layout verification and removed after the check. It is not a suggested drill.

## Next implementation steps

1. Add team-scoped persistence and shared coaching collections, keeping creator URL, notes, review status, and ownership.
2. Expand the authoring model beyond the eleven companion drills: age band, equipment, duration, skill tags, progressions, and authored diagrams or media.
3. Build an assistant retriever over approved library records. A recommendation should show the observed skill, why the resource matches, its original source, and the coach's notes before the coach attaches it.
4. Add external discovery and optional media previews as separate integrations. Preserve the distinction between a saved source, an extracted summary, and a coach-approved lesson.

Current skill matching is deterministic. No live AI video analysis, automatic social search, or cloud library synchronization is represented as implemented.

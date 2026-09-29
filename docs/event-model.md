# Local game record and future play-to-video links

## Scope

The local record layer in `src/gameRecord.js` gives the existing Saturday demo a durable, inspectable history. It records the actions accepted by the current simplified scorer and reconstructs its state after a reload. It is a foundation for later baseball rules, shared scoring and video work.

The active demo still uses the **Tustin Hawks versus Breakers fixture**. It is not an Angels or Huntington Valley Little League (HVLL) Minor B game. The Hawks fixture supplies player identities; the visitors have batting-slot identities rather than a complete named roster. A stable slot ID must not be presented as a verified player's identity. Film cards and their status changes remain demo controls, not recording or upload services.

## Versioned record contract

A record uses `schemaVersion: 1` and `engineVersion: "saturday-demo-v1"`.

- A stable game ID identifies one demo game throughout its life, including after archival.
- The record freezes its initial fixture, roster context and starting checkpoint. Replaying a saved game must not silently substitute a later version of the demo's roster or fixture.
- An ordered event history records actions with stable event IDs. Persisted order determines replay order; timestamps alone do not establish it.
- Events identify their actor using the demo role and actor ID. These values describe the local UI session; they are not authenticated identity or proof of authorization.
- `recordedAt` describes when the app recorded the action. `occurredAt` is nullable and describes when the action actually happened if that is known. A delayed entry must not silently claim its entry time is the play's real time.
- The replay engine is explicitly named. Future changes to baseball behavior require a deliberate engine/version migration rather than reinterpretation of old events using whichever reducer happens to be current.

The fixture/checkpoint plus history are the replay source. A rendered scoreboard and the short activity log are views of that record, not substitutes for it. This local history is not a cryptographically verified or league-certified scorebook.

## Pitch detail and present limits

New pitch events retain the batter ID and the runner movements associated with the accepted action, alongside the information needed to replay the demo. Balls and strikes that do not end a plate appearance belong in the history too; retaining only the final result would lose pitch sequences and future video anchors.

The supported scoring inputs remain the demo's balls, strikes, fouls, an out, a strikeout shortcut, singles, doubles, triples and home runs. Walks and strikeouts can also result from the count. Runner movements describe the demo engine's simplified advancement, not observations of every runner's actual decision on the field.

The record does not turn the existing model into a complete baseball scorer. It does not establish full pitcher identities, per-pitcher eligibility, defensive assists/errors, detailed runner decisions, complete opponent rosters, a 150-stat catalog or HVLL rules. The legacy scoreboard's pitch display is not an official per-player pitch-count log. Keep those gaps visible when consuming this history for stats or coaching.

## Undo is an additional event

Undoing the latest active pitch appends a `pitch-voided` event with `targetEventId` and a reason. The original pitch remains in history, and replay excludes its effect. This preserves which action was corrected and why.

This correction mechanism is deliberately narrow: **the latest active pitch only**. Arbitrary historical edits are rejected/deferred. Reassigning an old batter, moving a runner several plays back or inserting a missed substitution requires a broader correction design, dependency validation and recalculation of subsequent plays. Editing a historical event in place is not that design. Do not infer that this pitch-undo operation provides general rollback of every team-management action or imported checkpoint.

## Local persistence and migration

The local game library retains prior demo records when a reset starts a new game. Reset archives the old demo and gives the new one its own game ID. This is local retention in the current browser; clearing browser storage or losing that device can still lose the records. Archival is not a cloud backup or cross-device account history.

Legacy snapshot migration preserves what was actually saved. It establishes a checkpoint from the legacy state and identifies the incomplete provenance; it cannot recover a complete historical play sequence that the old app did not retain. Pre-migration totals or occupied bases may therefore be known while their originating pitch, runner or video identity is unknown. Do not synthesize authoritative historical pitches to fill that gap.

Unreadable, corrupt or future-version storage is protected from silent replacement. A load failure must not become an automatic overwrite with an empty demo. When a local write fails, the app exposes that the current changes are unsaved and allows a retry. An in-memory change is not durable until the write succeeds. This protection does not provide concurrent-tab conflict resolution, scorekeeper handoff or server reconciliation.

## Proposed video-link contract — not implemented

Future clips should link to stable plays and recording segments rather than only to a free-text play description. The proposed link includes:

| Field | Meaning |
| --- | --- |
| `gameId` | The game owning the play and recording. |
| `eventId` | The stable scoring event anchoring the clip. |
| `recordingId` | The actual recording asset, distinct from a reusable stream input. |
| `segmentId` | The continuous segment containing the play; a reconnect may create another segment. |
| `mediaOffsetMs` | Milliseconds from that segment's defined start, not from an assumed game start. |
| `alignmentMethod` | How alignment was established, such as a scorer timestamp estimate or human adjustment. |
| `uncertainty` | An explicit alignment error range/status; unknown remains unknown. |

Clip start/end ranges, review status and correction history will build on this link. `recordedAt` alone is insufficient to synchronize video because scoring can be delayed and cameras can buffer, disconnect or restart. A voided pitch must invalidate or flag its associated clip/insight links for review rather than silently relabeling footage. Preserving a clip after deleting its source recording also requires an explicit asset-retention design.

No media ingestion, recording, timestamp alignment, clip generation, playback authorization or video-provider integration is implemented by this record layer.

## Next gate: an approved HVLL Minor B rules profile

The supplied *2026 HVLL Bylaws and Local Rules*, certified January 5, 2026, provide the initial reference. Before scoring Angels games, confirm the applicable season and any Fall/interleague amendments, resolve the remaining rule-book references, and implement a separately versioned rules profile. Relevant requirements include:

- **Continuous batting and eight players:** all eligible players present remain in the batting order regardless of defensive substitutions. Games may start/continue with eight without an extra batting penalty. Defensive bench rotation is separate from batting eligibility (Section X, p.26).
- **Inning endings:** apply the five-run rule through inning five; the sixth and later innings are open for runs, even if an earlier inning is expected to be the last because of time. Every inning still allows only one trip through the batting order. Resolve the referenced LLRB 5.07 scoring details before applying a simplistic score clamp (Section X.O, p.27).
- **Pitching:** regular-season limits are three innings per game and six per Monday–Sunday week; throwing one pitch in an inning counts as an inning for this limit. A removed pitcher cannot return, players over league age ten cannot pitch, and the published hit-batter removal thresholds are three in one inning or five in three innings. DCT removes the local daily/weekly inning limits, while Little League pitch-count/rest rules still apply. The exact applicable Little League thresholds and eligibility exceptions remain a verification gate (Section X.F/K, pp.26–27).
- **Timing and suspension:** retain the agreed official start time and posted sunset. Minor B has a two-hour no-new-inning rule, weekday/last-Saturday provisions and a sunset-minus-15-minute restriction. Confirm how those provisions interact before automating cutoff decisions. Suspended games need exact-state resumption (Sections VI–VII, pp.15–19).
- **Other required behavior:** catcher courtesy runners, 15/10/8-run concessions at the specified inning boundaries, playing-time tracking, pool-player restrictions and DCT overrides need explicit support and scenario checks (Section X, pp.26–28; Sections XV/XVIII, pp.43–44,52).
- **Official records:** lineups, pitching eligibility and substitutions are recorded separately; completed official books signed by managers have restricted correction authority. The app must distinguish a demo/private record from an official league record (Section V, p.14).

## Remaining product work

Accounts and confirmed family membership, server-side permissions, durable shared storage, multi-device conflict handling, offline synchronization, real scorekeeper handoff, complete player/pitcher identities, accepted HVLL scoring, live phone broadcasting on iPhone/Android, video access controls, stats and coaching insights remain separate work. The event foundation makes those additions more traceable; it does not by itself deliver them.

## Verification — September 23, 2026

- Original checkout: all 25 existing tests passed; production build passed.
- After this change: all 69 tests across six files passed with `npm test`; `npm run build` and `git diff --check` passed using Node 24.13.1.
- Record tests cover replay across innings and walk-off, runner movements, retained pitch history, event retry deduplication, audited undo, legacy checkpoints and invalid records.
- Storage/UI tests cover failed writes and retries, corrupt/future-version data protection, Strict Mode reloads, archived resets and undo preserving coach notes.
- A Chrome browser check scored a ball and single, reloaded the game, then undid the single. The original batter and 1–0 count returned; the original single and its void remained visible. The 390-pixel-wide screenshot was inspected, and the console contained no application errors. This desktop browser check is not an iPhone or Android field test.
- Changes are local on `codex/game-record-foundation`; no public deployment was performed.

# Player assessment entry

The prototype Players tab now supports **select player → Record assessment → Save assessment**. Four broad coach ratings cover Hitting, Throwing, Fielding, and Baserunning. The previous 1–5 display was fixed sample data with no input path.

## Scoring and history

- Use whole numbers from 1–10, with the existing `RATING_ANCHORS` from `src/scouting.js`. Fictional sample baselines now use that scale. No saved team evaluation was converted.
- Every new form starts with all four skills unobserved. Record at least one skill, an observation date, setting, coach name, and an evidence note.
- Skipping a skill keeps its last observed value and date; it neither clears it nor silently treats it as reassessed. Never-observed skills stay blank.
- Each skill uses the most recent **observation date**, then recording timestamp and ID for ties. Backdated entries appear in history without replacing newer observations. Reassessing on the same date can correct a score while preserving the original entry.
- Profile bars show their own source date, coach or sample label, and change from the previous observation. History keeps separate entries and notes.
- Development reads the same observation for its focus category. Receiving remains a separate, unobserved sample focus; a broad Fielding rating does not manufacture a receiving assessment.
- Sample practice proposals and their approvals remain separate. Recording practice completion never awards rating points or automatically revises a plan.

## Scope and persistence

This is an isolated prototype with six fictional players. Assessments persist in this browser under `diamond-live:prototype:player-assessments:v1`. There is no cloud/team sync, account authorization, or verified author identity in this flow; coach names are entered by the user. The existing detailed scouting workflow, its ten subskills, multi-coach aggregation, and draft rankings remain unchanged.

The four broad category ratings are not computed from the detailed scouting schema. Matching the numeric scale does not equate the two types of observation. No overall player ranking or leaderboard is inferred from incomplete category ratings.

The prototype retains up to 1,000 observations. It merges saved observations before each append and responds to storage changes from other tabs. This is not transactional concurrent storage. When browser storage is blocked, the UI labels changes as session-only. Invalid saved assessment data pauses new saves and preserves the original stored content.

## Verification

Targeted tests cover partial ratings, initial baselines, missing values, historical ordering and corrections, input validation, persistence after remount, Development integration, cancel, and unavailable storage. Browser layout evidence belongs in `player-assessment-qa/`; this does not claim physical iPhone verification.

Verified October 20, 2026:

- 21 tests passed across `playerAssessments.test.js`, `Prototype.test.jsx`, and `shareCapture.test.jsx`.
- `npm run build` passed; the existing main-bundle size warning remains.
- Browser inspection at 390 × 844 confirmed the assessment dialog, initial unobserved states, score buttons, and sticky save controls. Temporary form selections were canceled without saving.
- `git diff --check` passed. No production deployment or existing team data change was performed.

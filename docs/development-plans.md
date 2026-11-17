# Coach development plans

October 2, 2026. Implemented locally; the hosted migration and release verification are pending.

## Workflow

Open **Development**, use **Create development plan** on a Scouting player profile, or use **Assign home challenge** on an at-home library card. Choose an active player, one achievable goal, a practice drill, and an optional home challenge. Add an easier substitute, optional follow-up date, and private coach notes. Review and adapt the instructions before saving. Known player ages must fit every selected activity; unknown ages require coach review. Bunting requires explicit division confirmation.

Plans retain approved instruction snapshots, catalog ID/content version, age range, helper/equipment requirements, readiness notes, source attribution, and coach author/date. **Edit plan** appends a version. **Close plan** adds a closed version; earlier instructions and follow-up notes remain available. The list filters by player and active/closed status, with overdue check-ins identified using Pacific dates.

The manager can **Review practice drill** to prepare the selected drill for the next scheduled practice. This opens the existing approval workflow and does not automatically release a team block. Once approved, return to **Edit plan → Link an approved practice block**. Eligible links belong to the same team/season and a non-cancelled practice, and are approved for the whole team or that player. Historical links remain in plan versions if a block is later removed.

**Download approved home card** exports the current home snapshot and child-facing goal. The substitute has its own download. Cards contain no player identifiers, assessments, ranking/recommendation rationale, private coach notes, or review history. They contain equipment, helper needs, short instructions, an easier option, readiness notes, and optional reflection prompts. A coach should keep private information out of the goal and instructions they approve for a family. Cards are manual handouts and do not send a message or submit feedback online.

**Record follow-up** distinguishes coach-observed practice from family-reported Tried it / Needs help / Chose another activity / Not tried yet. A reflection and coach observation are optional. Each immutable note identifies the plan version reviewed. Plan saves, follow-ups, practice links, and closure never change assessment ratings. A new coach assessment supplies any change in ability evidence.

## Storage and access

`development_workspaces` is separate from the viewer-readable team workspace and the coach-only scouting workspace. Only a current team owner or coach can read or save it. Direct client writes are denied; guarded `load_development_workspace` and `save_development_workspace` RPCs validate team membership, roster identity, authorship, instruction fields, age fit, practice links, and immutable history. The parent team row serializes saves, including concurrent first saves. Expected revisions reject stale requests; mutation IDs permit an acknowledgment-lost retry without duplicating a plan or review.

Cloud drafts stay in memory, scoped to account/team. Failed saves keep the draft, expose retry/private export controls inside the open dialog, and guard navigation/refresh/account changes. A conflict requires explicit review before replacing a draft. Revoked coach access clears private plan and form content. Signed-out `/preview` is labeled synthetic demo storage, separate by demo team, and persists only in that browser. Exported private draft backups may contain coach notes; they are separate from home cards. Backup import/restore is not implemented.

Version 1 limits a team snapshot to 2 MB, 500 plans, 100 versions per plan, and 3,000 reviews. It approves one appended version per changed plan per save and retains all earlier plans/reviews. Individual records are not deletable through the coach UI. Future retention/deletion workflows need a deliberate policy and server implementation.

## Release and verification

Apply `supabase/migrations/20261002183655_coach_development_plans.sql` after the existing shared workspace, scouting, and practice migrations. This local change does not apply a migration or publish a release to the hosted project. Before release, use synthetic accounts to verify owner/coach saves, viewer/other-team denial, removed-coach access, two-device refresh/retry/conflicts, and the manual card download on the deployed app.

Verification on October 2: **383 passing application tests**, a successful production build, and passing local SQL security/concurrency tests. The synthetic browser walkthrough checked both entry points, manager approval and linking, edited instructions, the downloaded card’s privacy, follow-ups, closure/history, persistence after reload, and a 390 px phone viewport.

Local checks: `npm test`, `npm run build`, and `sh supabase/tests/run-local.sh`. The SQL runner creates and removes a disposable PostgreSQL cluster and never contacts a hosted database. Tests cover plan/review immutability, valid and forged data, roster/age/link fit, role isolation, lost acknowledgments, stale revisions, access revocation, unchanged scouting data, and a two-session first-save race. Application tests exercise create/edit/follow-up/close, downloaded-card privacy, modal recovery, background refresh, account/team scoping, and navigation guards.

Verified guardian links, a family **My Practice** view, and family-submitted reflections are now implemented locally in the [next development phase](my-practice.md). Notifications, a revised scoring rubric, and clinician-managed rehab remain later milestones. See the [build sequence](development-build-plan.md) and [ranking/library review](player-development.md).

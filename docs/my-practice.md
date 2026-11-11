# My Practice and verified guardian access

Implemented locally on October 6, 2026. This phase adds owner-managed guardian links, a family view at `/my-practice`, and family-submitted reflections beside the coach’s development plans. It does not apply a hosted migration or publish a release.

## Coach → family → coach

1. An owner opens **Development → Manage family access**, chooses an active player, and enters the intended adult’s email. The panel describes the information being shared. It returns a 256-bit, one-use code that expires after seven days. Copy it and share it directly; the app sends no invitation email.
2. The adult opens **My Practice** from their account, signs in using that email’s one-time sign-in code, and accepts the family invitation. They do not need a coaching team membership or a separate child email. Claiming never adds a team membership.
3. The adult selects their linked child. The child can use **Player view** within the adult’s signed-in account. Approved home challenges show the goal, steps, equipment, helper needs, time ceiling, readiness notes, an easier choice, substitute, and optional check-in date. Active plans appear first; closed plans retain their history.
4. **Tried it / Need help / Chose another activity / Not today**, an optional short reflection, and optional fun feedback go to the coaches. Practice is optional; there are no streaks, completion quotas, ranking points, or missed-day penalties. Each guardian account sees its own submitted reflections. Other adults linked to the same child do not automatically see that account’s reflections.
5. Owners and assistants see **family-submitted reflections** on the matching development plan. Coach-entered follow-ups remain separate. Coaches can revise the home instructions, offer a substitute, or close the plan. None of these operations changes assessment ratings.

The signed-out `/practice-preview` is an explicitly fictional Alex Example experience. It uses an independent repository in memory and resets when the route is left or reloaded. It never reads real player records, claims invitations, or copies coach demo plans into a household. Signed-in users are redirected to real My Practice.

## Server authorization and data boundaries

`diamond_private.guardian_invites`, `guardian_links`, and `family_reflections` have RLS enabled and no direct client privileges. Guarded RPCs supply the only client access. Functions have fixed empty search paths and revoked PUBLIC/anonymous execution. Private helpers are not callable by authenticated clients.

The claim function compares the intended email with **verified, non-anonymous `auth.users` data**. Neither client-selected player IDs, editable profile metadata, matching names, nor existing viewer/coach roles establish family access. Owners alone create/revoke links and see guardian email metadata. Reads and writes check the live link and active roster player. Archiving a player hides their family records; removing a guardian also revokes used and outstanding invitations for their player/email association, including previous verified emails, so old codes cannot restore access.

`load_my_practice()` takes no child/team arguments. Its allowlisted response includes only linked player/team names, approved goals/home snapshots, optional check-in dates/status, and that account’s reflections. It excludes assessments, rankings, private coach notes, practice blocks, other players, authors, and other households’ reflections. Families cannot edit plans, approve practice blocks, or write to team/scouting/development workspaces.

Reflections identify a team, plan, and approved version. Authorship and timestamps come from the server. The team row serializes reflection saves, invitation claims, revocation, and coach plan writes. A stable request UUID makes an identical retry idempotent; changing the payload under the same UUID is rejected. New reflections require a current active plan with approved home instructions. A stale/closed plan fails with `40001`; a revoked/archived/unlinked plan fails with `42501`. Already-confirmed retries still succeed after a newer plan version, provided the guardian remains authorized.

## Drafts and recovery

Real family data and drafts stay in memory, scoped to the signed-in account. No real reflection draft is written to local storage. Background reads run every 15 seconds and on focus. Older responses cannot replace a newer refresh. Account changes immediately remount the family view; revoked access clears visible data and the draft.

A lost save response retains the exact frozen request for **Retry sharing**. A changed plan retains the reflection text and requires reviewing the current instructions and choosing **Use current instructions** before submitting a new request/version. An unavailable plan clears its draft. Home navigation, sign-out, refresh controls, child changes, and tab unload are guarded while a reflection or invitation code is open. Discarding an uncertain request cannot undo a save the server already received; the UI explains this.

Reflections are immutable records. Removing access hides them from that guardian but preserves coach history. These controls are access revocation, not a retention/deletion policy. Notifications, media uploads, clinician-managed rehabilitation, separate child accounts, and a revised ranking rubric remain separate work.

## Verification and release

Apply `supabase/migrations/20261006221511_guardian_my_practice.sql` after the shared workspace, scouting, practice, and coach development migrations. Both this migration and the coach development migration remain unapplied to the hosted project in this phase.

Local verification: **421 passing application tests**, a successful production build, and passing local SQL security/concurrency tests. Commands: `npm test`, `npm run build`, and `sh supabase/tests/run-local.sh`. The isolated PostgreSQL runner exercises distinct authenticated identities, verified/anonymous email rules, wrong-email claims, field allowlists, household isolation, unchanged ratings, forged IDs/authors, exact retries, stale versions, closure, expiry, archiving, and revocation after an email change. Two real PostgreSQL sessions verify duplicate-request and revocation/write races. The synthetic browser walkthrough covers player view, substitutes, reflected feedback/history, draft navigation protection, and a 390 px phone viewport.

The Supabase CLI security advisor was attempted against the disposable fixture but could not connect to the non-TLS PostgreSQL fixture (the server refused its TLS connection attempt). It was not counted as a passing check. Before release, run hosted security/performance advisors and fix actionable findings. Then verify the complete invitation/reflection loop from separate synthetic owner, assistant, and guardian browser sessions on the deployed app, including a second household, removed access, and two-device retry/version changes. Local SQL role simulations do not substitute for that deployed Auth/PostgREST smoke test.

See [coach development plans](development-plans.md) and the [build sequence](development-build-plan.md).

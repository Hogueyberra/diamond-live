# Scouting and player development

## First release

Team owners and coaches can open **Scouting**, create an assessment for a tryout or later check-in, and add players. The board supports name/number search, category sorting, observation coverage, and Available / Shortlist / Drafted planning status. Individual player pages show skill scores, assessment history, written coaching observations, development goals, and practice counts.

Use **Evaluate player** to enter whole-number scores from 1 through 10. Leave skills that were not observed unrated. The step-by-step form supports saving partial observations and moving to the next player. The scoring guide gives shared anchors so coaches can agree on consistent expectations and drills before evaluating.

The current release contains ten skills:

| Category | Skills |
| --- | --- |
| Infield | Glove fielding, footwork, agility, arm accuracy |
| Outfield | Glove fielding, footwork, agility, arm accuracy |
| Hitting | Bunting, swing mechanics |

Bunting practice suggestions are conditional on the division permitting it. A drill suggestion is a starting point for coach review. Recording practice does not award score points; a coach must reassess the observed skill.

Player and family access, automated video assessment, league draft administration, and links from scouting goals into the shared schedule are future work. Draft status is a coaching planning note, not official league registration.

## Scoring rules

For one player within one assessment:

1. Use each coach's latest submission, determined by its timestamp and then ID to break an exact timestamp tie. A newer partial submission replaces that coach's earlier submission for this assessment.
2. Average the non-null observations for each skill across those coaches. Missing observations are never zero.
3. Average the skills within each category.
4. When all ten skills have at least one observation, calculate `overall = (infield + outfield + hitting) / 3`.

Each category contributes one third despite Hitting having fewer skills. Incomplete players keep their observed category/skill scores but receive no overall score or draft rank. The board shows overall ranks for complete players, with equal full-precision scores sharing a rank. Display uses one decimal; sorting retains full precision.

Create a new assessment to measure later progress. Comparisons should use similar drills and conditions; a different mix of evaluating coaches can change the aggregate. Earlier submissions remain in storage even though each coach counts once in the current score.

## Access and storage

`public.scouting_workspaces` is separate from the ordinary, Viewer-readable `team_workspaces`. Authenticated team owners and coaches can read scouting. Viewer accounts, unrelated accounts, and anonymous callers cannot read or save it. Row-level security also protects direct table reads, and direct client writes are denied.

Only these authenticated RPCs expose the snapshot:

- `load_scouting_workspace(p_team_id)` returns `{ data, revision, updatedAt }`. A new team returns an empty schema-v1 snapshot at revision zero with a null timestamp; loading does not create a row.
- `save_scouting_workspace(p_team_id, p_expected_revision, p_data, p_mutation_id)` validates the complete snapshot and returns the acknowledged revision. It locks the team before the first insert so concurrent revision-zero saves cannot overwrite one another.

`src/scoutingRepository.js` supplies the unbound client methods. `WorkspaceGateway` binds those methods to the active team and only constructs a repository for owners/coaches. `useScouting` receives `{ load(), save(expectedRevision, data, mutationId) }`.

Server limits are 2 MB per snapshot, 500 players, 200 assessments, 5,000 evaluation submissions, and 2,000 goals. IDs and references are validated, evaluations cannot be changed or deleted, and existing players, assessments, and goals cannot be hard-deleted. New evaluation author IDs and names must match the signed-in coach's actual profile. Goal creator, creation time, player, and skill cannot change after creation.

Private cloud records stay in memory on the device and are cleared when the account/team scope changes. The explicitly labeled signed-out demo uses separate browser-local keys and synthetic players; it is never copied automatically into a team. A coach can explicitly download a draft backup; that downloaded file contains private scouting data.

## Synchronization and recovery

The client refreshes about every 15 seconds while visible, and on focus/reconnection. Each save includes the expected server revision and a stable mutation ID. Retrying the latest identical save by the same coach is idempotent. A different payload under the same mutation ID is rejected.

If another device saved first, the server returns a conflict without replacing its data. The client retains the unsaved draft in memory, disables further edits, and offers download and explicit reload. An offline draft remains in that tab until a retry succeeds. Closing a tab with unsaved changes shows a browser warning; account/team switching is blocked while scouting has an open dirty form or pending save.

An open edit form retains its base revision. If a background refresh changes that revision, the UI rejects saving the stale form instead of silently replacing another coach's updated fields. Copy unsaved form notes before closing and reopening against the latest data.

## Deployment and migration order

The additive migration is `supabase/migrations/20260929223628_coach_scouting_workspace.sql`. It depends on the previously deployed `202609300001_shared_workspace.sql` baseline.

**Ordering exception:** The baseline uses an older 12-digit, future-dated filename, while the new migration was generated by the Supabase CLI with its actual 14-digit timestamp. Filename sorting alone puts the new file first. For a fresh database, apply the baseline first, then the additive migrations. `supabase/tests/run-local.sh` explicitly follows this order. Do not use an unreviewed blanket migration reset/push on the hosted project. Preserve the existing deployed baseline history.

The scouting migration was applied to the hosted project on September 29, 2026. A rollback-only hosted probe confirmed owner access and denied unauthorized access. The migration contains plain `CREATE` statements and is not intended to be rerun after successful application. Website publication is a separate release step.

No new frontend secret is required. The existing public Supabase URL/publishable key and the current signed-in session are used. Service-role credentials must never enter the frontend.

## Verification

Targeted application checks:

```sh
npm test -- src/scouting.test.js src/useScouting.test.js src/useScoutingScope.test.jsx src/scoutingRepository.test.js src/ScoutingWorkspace.test.jsx src/WorkspaceGateway.test.jsx
```

Permission, validation, history, retry, and genuine two-connection first-save race checks run in a disposable local PostgreSQL cluster:

```sh
sh supabase/tests/run-local.sh
```

The SQL runner never contacts Supabase. It requires local PostgreSQL command-line tools. The gateway tests confirm that Viewers never receive a scouting repository or demo, owners/coaches use the selected team, account/team scopes remount, role removal hides scouting, and pending scouting prevents account/team mutations.

Before publishing a change to permissions, rerun the SQL suite and inspect hosted security advisors. Use synthetic records for live checks; verify signed-in coach access, Viewer denial, and cross-browser refresh before real player entry.

## Expected advisor findings

The September 29 hosted security review returned these known findings:

- **Authenticated SECURITY DEFINER functions:** The two scouting RPCs intentionally enforce owner/coach authorization, strict validation, and a fixed empty search path while table writes remain unavailable to clients. Anonymous execution and private helper execution are revoked. Retain these guards when changing the APIs; do not remove them merely to silence the advisor. [Supabase advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- **RLS enabled with no policy on `team_invites`:** This existing table intentionally denies direct access to invitation token hashes. Guarded RPCs expose only appropriate invitation operations and safe metadata. Scouting does not add this finding. [Supabase advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- **Leaked password protection disabled:** This existing Auth setting is separate from the app's email-code sign-in flow. Supabase documents the feature as available on Pro and above; review it if password sign-in is introduced. [Password protection documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

# Player-development build plan

Updated October 2, 2026. This plan integrates the recovered Ballgame Builders material into Diamond Live's existing coaching workflow. It distinguishes the local implementation from proposed work and does not record a deployment or change any player scores.

## Product workflow

**Observe → Choose a goal → Practice together → Try an optional home challenge → Reflect → Reassess.**

The assessment supplies evidence for a coach's decision. The drill library supplies suitable options. The practice planner supplies staff, timing, and instructions. A development assignment connects those pieces for one player; a family view eventually provides the child's own approved home challenges. Completing an activity supplies a learning note, not automatic ability points.

Example: a coach observes that a player struggles to gather their feet after fielding. The coach sets a concrete goal, adds Field, gather, aim to the team practice, and offers its empty-hand home version using two socks. The family can report Tried it, Needed help, or Chose another activity. At the next comparable fielding station, the coach makes a new observation and decides whether a dated reassessment is warranted. No household equipment or completion status affects the ranking.

## Existing foundation — implemented locally

| Area | What is connected today | Remaining boundary |
| --- | --- | --- |
| Assessments | Coach-only dated observations, ten skills, development goals, ranking review, feedback worksheet | Revised criteria/weights await coach feedback; no new rubric version |
| Library | 58 drills, 55 home versions, guide/age/helper/setting filters, recovered source attribution | Catalog is bundled; approved development plans retain versioned instruction snapshots; no content editing dashboard |
| Recommendations | Observed current skills select eligible activities and alternatives | Running, decisions, reflection, and recovered throwing games remain manual choices |
| Practice plans | Manager reviews instructions, selects audience, approves a time block, assigns a coach, and records outcomes | An approved individual practice block is team-readable; it is not a private family assignment |
| Development plans | Coach-only create/edit/close, preserved instructions, practice links, optional check-ins, substitutes, and recorded family feedback | Hosted migration/release verification pending; guardian access is a later phase |
| Take-home practice | Approved home/substitute cards, Progress Loop, one-cue parent guidance, optional reflection | Manual handouts; no guardian links, reminders, or child-specific dashboard |

Phase 2 verification: **383 passing application tests, a successful production build, and passing local SQL security/concurrency tests**. The browser verification uses synthetic demo plans. Hosted family-access behavior is not implemented. Release validation must exercise the deployed app and apply the required scouting/practice/development migrations. See [development plan behavior and release checks](development-plans.md).

## Build sequence

### 1. Put the current library through a coach pilot

Use the current Drills and Practice Plan views. Select a small, varied set of activities for the pilot; give coaches the ranking worksheet and parents the home cards. Record instruction clarity, setup time, waiting time, fun, equipment/helper burden, and what the coach actually observed. Name a coach reviewer and revision date for each pilot activity before describing it as reviewed.

The coaches can discuss missing assessment qualities while trying the drills. This feedback does not block development of the assignment workflow. Qualities such as baserunning or decisions can remain development goals until a rubric is agreed.

**Done when:** a coach can find a suitable drill, approve a usable practice block, hand out a home card, and capture useful feedback. Local changes have been reviewed and the chosen release has passed deployment smoke checks. This plan does not publish the app.

### 2. Coach development assignments — implemented locally

Added **Create development plan** to a player profile and **Assign home challenge** to the library. A coach chooses one concrete goal, one practice drill, and an optional home challenge. Plans include an optional follow-up date, an easier substitute, and short notes. Coaches have a list of active plans and a review action after practice.

Plans store an approved instruction snapshot with stable assignment ID, player/team/season, activity ID and content version, goal, setting, equipment/helper requirements, adapted instructions, author, and dates. The snapshot preserves what was actually assigned when the catalog changes. Keep private assessment evidence/recommendation rationale separate from the family-facing objective and instructions.

These records are coach-only and export the family-safe card manually. The coach can record family-reported feedback at practice. Do not add them to the existing viewer-readable team workspace: its audience is broader than one child's household. Review role permissions explicitly; a coach-created personal assignment does not need to release a manager's team practice plan.

**Done when:** a coach can create, edit, list, and close a player development plan; link it to an approved practice block; export only approved home instructions; preserve prior snapshots; recover failed/conflicting saves; and review a reported reflection. Creating or closing a plan does not modify ratings. Non-coaches cannot read the private plan records.

### 3. Connect families and children to My Practice

Add owner-managed, verified guardian-to-player links. Begin with a child experience inside the guardian's signed-in account rather than requiring a separate child email. The household sees that child's approved assignments, equipment/helper needs, easier choices, and optional follow-up dates.

Offer **I tried it**, **I need help**, **I chose another activity**, a short optional reflection, and fun feedback. Let the parent help and the child decide how much to share. The coach sees submitted reflections and can offer a substitute or a follow-up. Notifications, media uploads, and streak systems are outside this first family release.

Build family access as a separate server-authorized view of approved assignment snapshots and submitted reflections. Do not infer access from a shared surname, a client-selected player ID, user-editable profile metadata, or the existing viewer role. Guardian relationships must be checked on reads and writes; families cannot approve assignments, change the assigned player, see other households, or read assessments/draft boards/private coach notes. A guardian's removal must revoke new assignment access. Follow the current [Supabase row-level security guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) when implementing and testing the access rules.

**Done when:** a guardian and coach can complete the assignment/reflection loop from separate authenticated sessions; a second household cannot read or mutate the first child's records; changing IDs in requests does not widen access; removal revokes access; and refresh/retry behavior is verified. Use synthetic households and players for these checks.

### 4. Introduce a revised assessment rubric after coach feedback

Turn proposed qualities into observable behaviors, age/division applicability, scoring anchors, and an agreed purpose: development, selection, or both. Resolve the current bunting requirement and relative weights explicitly. Pilot a common demonstration with independent coach ratings before changing calculations.

Save a rubric version on each new assessment, keep older assessments and their original meaning, and map only agreed skills to drill tags. Do not recalculate historical scores using new weights. Show which behaviors remain unobserved and how many comparable observations support a rating. Optional play points, assignment completion, nutrition habits, body size, rehab participation, and parent availability stay outside ability scoring.

**Done when:** agreed criteria produce consistent interpretations in the pilot, eligibility handles division differences, new assessments use the chosen version, historical assessments remain interpretable, and the skill-to-drill mappings are covered by regression checks. This work can proceed alongside the assignment milestones once feedback arrives.

### 5. Expand the recovered guides into reviewed programs

After the assignment/reflection loop works, turn selected source quests into optional sequences such as a short Barrel Quest choice pack. Use the existing eight-week/sixteen-quest companion as content and interaction reference. Reuse the earlier JSON authoring schema and PDF generator for printable program packs; approved catalog content should drive both the app and print outputs so they stay aligned.

Add demonstration clips with verified permissions, equipment substitutions, per-activity review history, and a dated content version. Begin with the coach-approved pilot activities, then expand based on feedback. A program should offer repeats, easier levels, alternate activities, and respectful endings rather than requiring every session or awarding ranking points.

Keep Strong All Season in a separate 14+ track. Everyday Energy and Fuel the Game fit a future parent resources area. Clinician-managed rehabilitation requires a separate plan with prescribed activities, restrictions, review dates, and guardian access; it is not selected from ranking weaknesses.

**Done when:** a coach can offer a reviewed sequence, families can use individual sessions without losing earlier reflections, print and app content share a version, and age/source/review metadata is preserved. Resolve the earlier project's outstanding source-rights and qualified-review items before commercial publication.

## Next milestone

Release and pilot the completed coach development plans after hosted migration and smoke checks. Then build **verified guardian access and My Practice**, with separate household permissions and child-friendly reflections. Continue gathering coach feedback before changing the ranking rubric.

Related records: [player development and current ranking review](player-development.md), [practice planning](practice-planning.md), [earlier project reuse inventory](legacy-project-reuse.md), and [shared-storage verification](shared-storage-setup.md).

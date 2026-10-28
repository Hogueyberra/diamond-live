# Player development: rubric review and drill library

Updated October 2, 2026. This local build supplies a coach-review starting library and feedback materials. Activities include Diamond Live ideas and adaptations from the earlier Ballgame Builders guides, with fundamental references; they have not been independently rated for impact or clinically reviewed.

See the [development build plan](development-build-plan.md) for the implementation sequence from the current library to coach assignments, family access, a revised rubric, and guided programs.

## Review of the current ranking system

The scoring implementation in `src/scouting.js` remains unchanged. All ten skills must have an observation to produce a rank. Only each coach's latest submission within an assessment counts; a new partial submission replaces that coach's older complete one. Each skill averages observed ratings across coaches, each category averages its skills, and the categories contribute equally to overall. Missing scores remain null. Equal full-precision scores share a rank; display rounds to one decimal.

| Category | Current dimensions | Overall contribution per skill |
| --- | --- | --- |
| Infield | Glove fielding, footwork, agility, arm accuracy | 8.33% |
| Outfield | Glove fielding, footwork, agility, arm accuracy | 8.33% |
| Hitting | Bunting, swing mechanics | 16.67% |

Coach discussion points:

- **Eligibility:** bunting is required for a rank even if the division prohibits it. Library eligibility filters do not change that requirement.
- **Weights:** bunting supplies half the hitting score. Each hitting observation has twice the overall influence of each defensive observation. Confirm whether this fits development, tryouts, or team selection.
- **Evidence:** one observation counts as coverage. Sample size, coach disagreement, age, conditions, and assessment freshness do not affect rank. Completeness does not imply a reliable or age-normalized measure.
- **Overlap:** distinguish footwork from agility, and decide whether shared throwing accuracy should contribute separately in infield and outfield.
- **Missing dimensions:** discuss contact/pitch recognition, baserunning, game decisions, receiving/transfers, communication/teamwork, response to coaching, movement/body control, and pitching/catching readiness.
- **Fairness:** use observable baseball behaviors, not personality labels. Home equipment, family availability, missed homework, body size, rehab participation, and streaks should not become ability scores. Some qualities fit narrative development goals better than selection ranks.

The **Drills** tab has a coach-only ranking review and downloadable feedback worksheet. The same review is in **Scouting → Scoring guide → Review criteria and gather coach feedback**. It does not modify ratings or contact other coaches.

For each proposed quality, ask which behavior is observable, at what station, at which ages, with how many comparable observations, and with what importance for development versus selection. Have coaches independently rate a common demonstration and reconcile disagreement before piloting a rubric. Future schema changes should attach a rubric version and applicable skills to each assessment. Create a new assessment under the new version; preserve historical ratings and their original meaning.

## The library

`src/drillLibrary.js` is the shared catalog: **58 drills**, eight areas, **55 home versions**. Initial ages are 7–12; the directly supervised small-hop activity starts at 8. These ranges are editorial fit suggestions, not medical clearance. Every existing rated skill has at least two practice options, including two optional bunting activities.

Each record has a stable ID, topic, optional current skill ID, age range, difficulty, time ceiling, equipment, setup, steps, cue, progress check, group size, rotation, fun challenge, easier/harder variants, readiness notes, throwing/bunting flags, and fundamental reference. Home versions add household equipment, a shorter time ceiling, child-facing setup/steps/challenge, and a helper requirement. Activities without home variants stay at coached practice.

The UI searches text, skill area, age, training guide, home/practice setting, no throwing, and no partner. Eighteen adaptations from Barrel Quest, Diamond Dash, Next Pitch, and Command Quest retain guide/activity attribution, optional game points, and the source age gates. Six swing games can enter existing swing suggestions; recovered decision, running, reflection, and throwing games are manual choices. See [the source inventory and adaptation decisions](legacy-project-reuse.md). Adults check space and readiness even for solo activities. Bunting is hidden until division eligibility is explicitly confirmed. Known ages outside the catalog range receive no automatic recommendations; unknown ages require coach review.

The recommendation heuristic remains: scores of 5 or below are practice candidates; team themes sort by candidate count, average score, then skill ID; individuals start with the lowest observed eligible skill. Options now include alternative activities and prefer drills not already in the current practice. This is deterministic variety within a plan, not a cross-season usage history or validated development model. A team suggestion must fit all active players with known ages, including unassessed players. Missing skills are never backfilled from earlier assessments. New topics such as baserunning and teamwork are coach-selected, not automatically scored.

**Review for practice** opens the next scheduled practice with the chosen drill ready for manager review. If no practice exists, schedule one and return to the library. The manager chooses the audience, edits instructions, and approves the block. The planner also offers **Other drills for this skill** and **Browse the drill library**. Group, rotation, and source attribution become reviewed setup; challenges, adaptations, celebrations, and optional game rules become reviewed steps. Approved practice blocks use existing snapshot fields and permissions. The catalog alone needs no new migration; coach development plans require their separate additive migration.

Minutes are not throwing-volume targets. Review workload/rest across teams, warm up, and stop for discomfort or fatigue. Pitching activities remain manual choices. Qualified supervision/readiness review is required for bodyweight and small-hop activities; these are not rehab prescriptions.

## Home practice and the child's part

With default bunting eligibility, **54 home drills** are visible; confirming eligibility exposes the 55th. Thirteen need no partner after an adult checks readiness and space. Many use socks, paper, a foam ball, or empty hands.

**Download home card** creates a UTF-8 text handout with household equipment and selected instructions. It contains a mission, short time ceiling, fun challenge, easier version, adult notes, and spaces for “I tried it,” “Something I noticed,” fun feedback, and a question for the coach. Families can print it using a text editor. No scouting names, ratings, private rationale, or leaderboard positions are included. The home view and cards reuse the Progress Loop: Choose → Play → Score (optional) → Celebrate → Level up. The parent guide offers child choice, one-cue coaching, and respectful endings. Adapted cards include their guide/activity attribution and optional game points; these points never feed ratings. These checks are observations, not promises of increased speed or strength.

The **Development** tab now connects one player goal to approved practice/home snapshots, an optional check-in date, an easier home substitute, and private coach notes. Coaches can create a plan from a profile or home drill, edit it with history preserved, link an approved practice block, export its approved home card, record family feedback, and close it. See [development plan behavior, privacy, and migration](development-plans.md).

Families receive manual handouts and return notes at practice. Child accounts, guardian/player links, child-submitted completion, medical-plan storage, and notifications remain future work. Practice celebrates effort; ability scores change only after coach reassessment.

Before implementing in-app homework:

1. Add guardian-mediated access to one child's assignments, enforced server-side. Existing viewer memberships can see ordinary team plans and are not a child-specific privacy boundary. Exclude assessments, draft boards, coach-only notes, and other children's assignments from family payloads.
2. Expose a family-safe view of the implemented coach-approved plan snapshots: drill/version, objective, adapted instructions, equipment/helper check, time ceiling, and optional check-in. Enforce guardian authorization on every read/write and exclude private notes and evaluation data.
3. Let the child/guardian record tried it, reflection, fun feedback, or “I need help.” Avoid punitive streaks or ability points; offer substitutions for equipment/time barriers.
4. Provide coach follow-up and a new dated assessment when comparable evidence supports a skill change.
5. For rehab, use a clinician-provided plan, guardian-controlled access, restrictions, and review/expiry dates. Clinicians define activity, dose, and stop criteria. Rankings never diagnose injuries, select PT exercises, progress rehab load, or determine return to play. No generic PT routine is bundled here.

## Quality review and references

Pilot a few activities and gather feedback on instruction clarity, setup/waiting time, skill relevance, engagement, helper/equipment burden, and observed control at the age range. Establish review owners and revision dates before claiming validated impact. Add verified demonstration videos with permission; none are bundled today.

References inspected September 30, 2026:

- [Little League fielding](https://www.littleleague.org/university/articles/tee-ball-drills-fielding/) and [direction/movement](https://www.littleleague.org/university/articles/tee-ball-drills-left-field-center-field-right-field/).
- [Little League team throwing](https://www.littleleague.org/university/articles/tee-ball-drills-team-throwing/) and [protecting children's arms](https://www.littleleague.org/partnerships/pitch-smart/protecting-childrens-arms/).
- [Little League soft toss](https://www.littleleague.org/university/articles/backyard-tip-soft-toss/) and [baserunning](https://www.littleleague.org/university/articles/breakdown-baserunning-drill/).
- [MLB/USA Baseball Pitch Smart: ages 8 and under](https://www.mlb.com/pitch-smart/pitching-guidelines/ages-8-and-under), a fundamentals and participation reference.
- [American Academy of Pediatrics: strength training](https://www.healthychildren.org/English/healthy-living/sports/Pages/Strength-Training.aspx), general guidance on supervision, readiness, technique, and stopping for pain. It does not clinically validate specific catalog activities.

These sources demonstrate fundamentals or general guidance. The catalog adaptations do not imply league endorsement.

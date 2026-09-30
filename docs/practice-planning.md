# Practice planning and coach responsibilities

## What coaches can do

1. Start with a practice on the imported or manually created calendar.
2. Review suggested team themes or choose an individual player. Suggestions are private to coaches; the team owner approves shared blocks.
3. Read and adapt the setup, equipment, steps, one coaching cue, and progress check. A drill is added only after **Approve & add to practice**.
4. Arrange sequential blocks inside the scheduled start and end time. Leave room for preparation, water, and transitions; add these as custom blocks.
5. The team owner acts as manager: assign preferred blocks first, then open coach sign-up. Assistants may take an unassigned block or release their own. The manager can assign and reassign any block.
6. At practice, open the instruction sheet, record what happened, and mark blocks completed. Finishing a drill does not raise a scouting score; a coach must reassess the player.

A player's name and drill in an approved plan are visible to team members, including while sign-up is paused. Ratings and recommendation reasoning are never copied into a shared practice block. The approval form explains this before saving.

## How suggestions work

This release uses a deterministic mapping of observed skills to beginner activities. It is not an AI diagnosis or video analysis feature.

- For each active player, select the latest evaluation event dated on or before the practice. Existing scouting aggregation uses each coach's latest submission within that event.
- Do not backfill missing skills from an older event or treat unobserved skills as a low score.
- Scores of 5 or below are candidates for more practice. This is a product heuristic based on the current scouting anchors, not a validated performance threshold.
- Rank team themes by number of players who could use practice, then average skill score, then skill ID. Show up to three themes.
- Show the lowest observed eligible skill as an individual starting point, with a stable skill-ID tie break. Coaches choose the actual focus.
- Bunting suggestions are omitted by default until division eligibility is confirmed. Pitching is a manually selected activity; an arm-accuracy score does not diagnose release mechanics or prescribe bullpen work.

The activity payload is deliberately limited to instruction fields, player identity (if selected), time/order, and coach assignment. It excludes evaluation IDs, scores, rankings, and recommendation reasons.

## Instruction sources and editorial scope

Reviewed September 30, 2026. The short activity sheets are original Diamond Live instructions for fundamental, supervised practice. Links lead to official guidance or demonstrations; the activities are not official Little League plans or an endorsement.

- [Little League: Fielding](https://www.littleleague.org/university/articles/tee-ball-drills-fielding/) — a foundation for gentle rolled-ball work.
- [Little League: Left Field, Center Field, Right Field](https://www.littleleague.org/university/articles/tee-ball-drills-left-field-center-field-right-field/) — direction cues and movement between cones.
- [Little League: Team Throwing](https://www.littleleague.org/university/articles/tee-ball-drills-team-throwing/) — broad targets for controlled throws.
- [Little League: Backyard Tips](https://www.littleleague.org/university/backyard-tips/) — fundamental hitting, catching, throwing, and fielding demonstrations.
- [Little League: Bunting](https://www.littleleague.org/university/articles/backyard-tip-bunting/) — optional library guidance; not enabled in recommendations without division confirmation.
- [Little League: Target Skill—Pitching](https://www.littleleague.org/university/articles/target-skill-pitching/) — a reference for a coach-selected pitching setup. Our activity uses comfortable target control, without prescribed pitch counts or velocity targets.
- [Little League: Protecting Your Children's Arms](https://www.littleleague.org/partnerships/pitch-smart/protecting-childrens-arms/) and [pitch-count rules](https://www.littleleague.org/playing-rules/pitch-count/) — coaches review workload and required rest across teams before adding throwing work.
- [MLB/USA Baseball Pitch Smart: Ages 8 and Under](https://www.mlb.com/pitch-smart/pitching-guidelines/ages-8-and-under) — emphasizes fun, fundamentals, warm-up, rest, and fatigue monitoring.

No automatic throwing-volume or pitching-eligibility calculation is included. Practice duration is not a throw-count target. Instruction sheets favor easy movements and target control; they do not promise velocity gains. Player discomfort or fatigue ends throwing work. Coaches remain responsible for age, rules, readiness, appropriate equipment, and adult supervision.

## Save behavior

The parent workspace persists event and activity changes in one revision-checked save. Database permissions enforce manager edits and assistant claim limits. Pending reviews and typed outcomes signal the navigation guard; errors keep unsaved input available. Structured blocks cannot overrun the event. Historical unstructured overflow remains readable so it can be repaired.

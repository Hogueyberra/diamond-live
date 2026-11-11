# Reusing the earlier Baseball project

Reviewed September 30, 2026. Source project: `/Users/nickhogue/Desktop/01_Projects/Baseball`. The earlier project is **Ballgame Builders**, with eight editable guide manuscripts, generated PDFs, and an interactive hitting companion. Its structured content is much more useful than a collection of unrelated drill links. The source project has been left unchanged.

## What is now in Diamond Live

The shared library contains **58 activities, including 55 home versions**. Eighteen new activities were adapted from four earlier guides, and the home view includes parent guidance from a fifth. Find the activities using **Drills → Training guide**, or search for a guide or original quest title. Every adapted card and downloaded handout names the guide and original activity.

The reusable behavior is the **Progress Loop: Choose → Play → Score → Celebrate → Level Up**. In this app, counting is optional, misses do not erase successes, and the player can repeat an easier level, switch games, or finish. Game points describe that day's play; they do not change rankings or become leaderboards. Home cards carry this guidance. The parent quick-start incorporates child choice, one-cue coaching, and permission to skip post-practice discussion.

| Earlier resource | Original audience | Reuse in this release | Keep for later |
| --- | --- | --- | --- |
| `01_barrel_quest.json` — Barrel Quest | 7–10 | Eight target, balance, location, and decision games; preserve the 7–10 range | Full eight-week/sixteen-quest companion, same-condition starting score and retest, demonstration videos |
| `02_strong_all_season.json` — Strong All Season | 14+ | No activities added to the current 7–12 library | A separate older-athlete catalog with qualified review; do not lower its age gate |
| `03_next_pitch.json` — Next Pitch | 8–14 | Optional Process-Win Bingo and Next-Pitch Movie, restricted to 8–12 for this library | Other reset options; an older-player edition if the app later supports it |
| `04_diamond_dash.json` — Diamond Dash | 7–12 | Six reaction, rhythm, run-through, and controlled slowing games | Additional child-choice sessions and warm-up companion |
| `05_everyday_energy.json` — Everyday Energy | 7–12; parent-led | Inventoried, no nutrition activities added | Parent education and meal/snack planning, with appropriate expert review |
| `06_fuel_the_game.json` — Fuel the Game | 7–12; parent-led | Inventoried, no nutrition activities added | A family game-day preparation checklist; no food, bodyweight, or hydration compliance rating |
| `07_command_quest.json` — Command Quest | 8–12 | Two comfortable catch/target games, selected manually by coaches | A reviewed workload companion; not a velocity or pitching-progression program |
| `08_baseball_joy_playbook.json` — The Baseball Joy Playbook | Adults supporting 5–12 | Home-view parent guide: The 12-Minute Play Invitation, One-Cue-Max Challenge, Car-Ride Choice Card | Parent onboarding, child-choice prompts, adult reflection resources |

Manuscripts are under the earlier project's `rebrand/content/`; corresponding PDFs are under `output/pdf/` with preserved copies in `rebrand/assets/`. Use the manuscripts for future editing and extraction; use the PDFs as reference handouts.

## Exact activity provenance

Implementation: `src/recoveredDrills.js`, appended to `src/drillLibrary.js`. Ages stay within both the source guide and current catalog. The eight Barrel Quest adaptations include six swing activities eligible for the existing swing recommendation; the two decision games have no rating mapping. All running, reflection, and recovered throwing games are manual coach choices.

| Current ID | Original guide | Original activity |
| --- | --- | --- |
| `quest-launch-pad` | Barrel Quest | Quest 1A - Freeze-Frame Launch Pad |
| `quest-step-trail` | Barrel Quest | Quest 2A - Step-Line Trail |
| `quest-gap-gates` | Barrel Quest | Quest 2B - Gap-Gate Delivery |
| `quest-traffic-light` | Barrel Quest | Quest 3A - Traffic-Light Hitter |
| `quest-window-washer` | Barrel Quest | Quest 5A - Window Washer |
| `quest-contact-chain` | Barrel Quest | Quest 5B - Barrel-Streak Builder |
| `quest-location-cards` | Barrel Quest | Quest 7A - Mystery-Location Cards |
| `quest-mini-game` | Barrel Quest | Quest 8A - Mini-Game Adventure |
| `dash-rolling-cue` | Diamond Dash | Beat the Rolling Ball |
| `dash-build-glide` | Diamond Dash | Build, Glide, Freeze |
| `dash-treasure-gate` | Diamond Dash | Run Through the Treasure Gate |
| `dash-drumbeat` | Diamond Dash | Drumbeat Dash |
| `dash-message` | Diamond Dash | Deliver the Message |
| `dash-coach-says` | Diamond Dash | Coach Says Go |
| `next-pitch-bingo` | Next Pitch | Process-Win Bingo |
| `next-pitch-movie` | Next Pitch | Next-Pitch Movie |
| `command-team-shield` | Command Quest | Build the Team Shield |
| `command-clock-target` | Command Quest | Call the Number |

Editorial changes for short cards:

- Use short time ceilings rather than required rounds, swings, sprints, or throws. Remove boss-round quotas and personal-best chasing. Retain optional successes and child choice.
- Batting practice uses supervised tee/foam-ball/net setups. Traffic-Light Hitter has an empty-hand home version; Mini-Game Adventure has a paper-and-coin home version. Color decisions are not represented as verified pitch-recognition assessments.
- Running uses comfortable paces, full recovery, clear lanes, and ample slowing space. A freeze happens only after a controlled stop. The rolling ball stays in a separate lane, treasure is retrieved after stopping, and message delivery uses an imaginary prop. No sprint times or lead-off assumptions.
- Throwing requires a workload/rest check and warm-up, with no fixed volume, RPE target, extra repair throws, weighted balls, or maximum effort. Adults account for total throwing; the score supplies no reason to continue.
- Reflection is voluntary. A player may keep a scene private, leave a bingo card blank, or choose a different activity. These games do not assess mood, personality, coachability, or mental health.

Reviewed practice snapshots retain guide/activity attribution in setup and optional game rules in steps, through the existing approval form and instruction fields. Home exports use the home-specific equipment and stop notes. No original PDF, registration data, assessment, or source filesystem path is bundled into a family card.

## Other reusable assets

- **`rebrand/content/SCHEMA.md`:** an authoring model for quests, sessions, checklists, trackers, and notes. Its mission/setup/cue/score/levels/stop structure informed the recovered cards. The current catalog adds setting, equipment/helper, age eligibility, throwing/bunting flags, and optional existing skill links.
- **`interactive/index.html` and `barrel-quest-field-aid.html`:** an eight-week/sixteen-quest selector with embedded content and one selected quest at a time. Its content is useful for a future program companion. The current guide filter groups activities without imposing a weekly sequence; the standalone HTML/styles were not copied over the app.
- **`rebrand/build_guides.py`, `qa_guides.py`, and `render_qa.py`:** reusable PDF generation, structural/text checks, and render-review tools when we add illustrated printable packs. They are inventoried, not connected to the app build.
- **`Gamechanger/Research/Build Context.md` and `Feature Map.md`:** useful pilot context and workflow research checklists. The feature map explicitly separates requested capabilities from verified evidence. They overlap the current Diamond Live direction; they are context rather than another working application to transplant.
- **`PROJECT_STATUS.md`:** records previous page-by-page PDF layout review and future review work. Layout approval is not clinical validation or evidence of effectiveness. No source registration exports were opened or imported.

## Next useful work

The [development build plan](development-build-plan.md) turns this inventory into ordered milestones with acceptance criteria. The next implementation is coach development assignments; family access follows after the assignment model and permissions are ready.

Coach feedback should first establish which observable qualities belong in the assessment rubric. The old guides contribute development activities and possible observation prompts, not a validated ranking model. Personal contact/decision notes may later support dated reassessment under comparable conditions; homework completion, optional scores, and parent availability must remain separate from ability rankings.

Pilot a small selection with coaches and parents before expanding to all quests. Collect setup clarity, waiting time, fun, helper/equipment burden, and whether the cue helped. A useful next artifact is a coach-reviewed two-week choice pack with verified demonstration videos and a printable progress map. Synced assignments and child-specific access still require the workflow described in `player-development.md`.

The source project carries a proprietary notice and lists ownership/licensing and expert review as unfinished before commercial release. This local reuse follows the user's request; it does not establish third-party source rights or certify the guide programs. Keep source attribution and review those outstanding items when preparing publication.

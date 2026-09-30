# Diamond Live homepage brief

Reviewed September 29, 2026. This brief informs the public, signed-out homepage; it is not a new product roadmap or a claim that planned features are available.

## Direction

Introduce Diamond Live as a youth baseball coaching workspace that connects preparation, observations, practice, and player development. Make the mission of helping build lifelong athletes explicit and aspirational. Show the current product, use the existing Clinch black/lime/lavender identity, and offer a clear path to sign in or explore a labeled demo.

Suggested hero:

> **Great seasons. Lifelong athletes.**
>
> Plan the week, turn coaching observations into practice, and see each player’s progress—one skill at a time.

Primary action: **Start your team**. Secondary action: **Explore the demo**. Returning users need a visible **Log in** action. The account flow supports email-code sign-in and account creation, then creating a team or joining with an invitation code.

## Page structure and original copy direction

1. **Mission and product introduction.** Pair the headline with a human baseball moment and a clearly labeled sample of the product. Do not imply a photograph shows actual customers or the Angels team.
2. **A useful week, in one place.** Schedule games and practices; keep the time, location, and preparation together. Describe schedule creation and viewing, without implying calendar integrations, RSVP tracking, or cancellation workflows.
3. **Turn what you notice into what you practice.** Capture an observation, choose a practice objective, and record what improved. A simple visual sequence can demonstrate observation → practice activity → outcome.
4. **See the next step for every player.** Evaluate ten skills across Infield, Outfield, and Hitting. Compare assessments, set a focused goal, and log practice. Evaluation and draft information stays accessible only to team owners and coaches.
5. **Find the rule. Know the source.** Search the division rules library, see the original passage and page citation, and share uploaded team guideline documents. This is a reference tool; it does not automatically enforce rules or include every league rulebook.
6. **Start with your next practice.** Sign in with an email code → create or join your team → add a practice and coaching focus. Show the real steps without a fabricated setup-time promise.
7. **Why we’re building this.** “Our goal is to help coaches make progress feel possible—for every player, at every stage. Clear goals, patient practice, and small wins can build a reason to keep coming back.” End with another direct action.

Useful FAQ topics: phone and computer access; account creation; coach-only evaluations; whether a demo contains real players; what streaming support exists today. If streaming is mentioned, label it as planned. A short FAQ is preferable to foregrounding a long backlog.

## Capability checks

| Safe to explain now | Important boundary |
| --- | --- |
| Games and practices in a shared team schedule | No calendar sync, automated reminders, or RSVP workflow |
| Human observations linked to timed practice activities, objectives, success measures, and recorded outcomes | No automatic video or scorebook insight generation |
| Ten skill ratings, three equally weighted categories, multiple-coach averages, dated assessments, goals, and practice logs | Full observation is required for an overall rank; completing practice does not automatically increase ratings |
| Owner/coach-only scouting and draft planning | No player/family progress portal; general shared coaching records can be read by invited viewers |
| Searchable rule passages and original-source citations; private shared guideline files | No universal rule coverage, legal interpretation, or automatic game enforcement |
| Email-code sign-in, profiles, invitations, shared team storage across devices | Do not claim offline cloud synchronization or immediate real-time broadcasting |
| Browser-based use on phones and computers | No native App Store/Google Play download claims |

These checks come from `README.md`, `docs/scouting.md`, `src/AccountPanel.jsx`, and `src/CoachingWorkspace.jsx`. Some older planning documents predate the shared-storage and scouting releases, so the current implementation takes precedence.

## GameChanger research

The review used official public pages only:

- [GameChanger homepage](https://gc.com/): a clear opening promise and account action, benefit-led product sections, repeated conversion points, and practical FAQs help a new visitor understand the service. Adapt this clarity and hierarchy in original Diamond Live content. Do not reuse their ratings, audience metrics, partner logos, testimonials, or product claims.
- [GameChanger for Coaches](https://gc.com/coaches): a short setup sequence leads into focused feature explanations. Diamond Live can demonstrate its own email/team/practice sequence and the coaching-to-practice loop.
- [GameChanger Baseball](https://gc.com/baseball): sport-specific language and product imagery make the offering concrete. Diamond Live should stay centered on youth baseball and illustrate currently working features.
- [GameChanger About](https://gc.com/about): mission language and human sports photography connect the product to participation and community. Diamond Live should articulate its own lifelong-athlete aspiration without promising measured retention, confidence, or health outcomes.

Use the competitive review as structural inspiration, not a visual or textual copy. Product examples should use synthetic records and should not expose real youth names, scores, or photographs from private team storage.

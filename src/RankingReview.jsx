import { SCOUTING_CATEGORIES, RATING_ANCHORS } from './scouting.js';
import { Button } from './WorkspaceUI.jsx';

export const REVIEW_QUALITIES = [
  ['Contact and pitch recognition', 'Recognizes a hittable pitch and makes controlled contact.', 'Tee, gentle feed, then age-appropriate live observation.'],
  ['Baserunning', 'Knows base order, runs through first, and follows a base coach.', 'Base path walk-through and short run with clear runoff space.'],
  ['Game decisions', 'Chooses a sensible play and finds a backup position.', 'Explain a simple runner-and-outs scenario before a walk-through.'],
  ['Receiving and transfers', 'Secures the ball before moving to the next action.', 'Soft roller or toss, secure, gather, and pause.'],
  ['Communication and teamwork', 'Calls clearly, listens, and supports a teammate.', 'Observe specific examples over several practices.'],
  ['Response to coaching', 'Tries one cue, asks for help, and adjusts on a later rep.', 'Record the cue and the observed response; avoid personality labels.'],
  ['Movement and body control', 'Starts, changes direction, and stops comfortably in balance.', 'Short cone movement; compare within the same age and conditions.'],
  ['Pitching and catching readiness', 'Shows role-specific control and follows safety routines.', 'Separate coach-selected observations after workload and readiness review.'],
];

export function createCoachFeedbackSheet() {
  return ['Diamond Live · Ranking and drill review', 'Coach: __________   Division / ages: __________   Date: __________',
    'Current rules: 1–10 observations; Infield, Outfield, Hitting each contribute one third. All ten skills must be observed to rank. Each coach’s latest submission counts once per assessment; a newer partial submission replaces that coach’s prior one. Missing observations are never zero. Practice completion never awards score points.',
    ...SCOUTING_CATEGORIES.map((category) => `${category.label} (one third): ${category.skills.map((skill) => skill.label).join(', ')}`),
    'Review concerns: Bunting is required for a complete rank even if the division does not allow it. Each hitting skill contributes about 16.7% overall; each infield/outfield skill about 8.3%. A single observation can count as coverage. Age, observation confidence, coach disagreement, and assessment freshness are not included in rank. Scores are not a validated talent measure.',
    'For each quality: Keep / change / add / optional? Importance for development (1–5)? Importance for team selection (1–5)? What observable behavior and station would you use?',
    ...REVIEW_QUALITIES.map(([quality, behavior, station]) => `${quality}\nExample behavior: ${behavior}\nPossible observation: ${station}\nCoach feedback: ____________________________________________`),
    'Should bunting and position-specific skills be optional by division? ____________________',
    'Should category weights vary by age or assessment purpose? ____________________',
    'What minimum observations, common conditions, and coach calibration would make a score trustworthy? ____________________',
    'Which skills should remain narrative goals rather than draft-rank inputs? ____________________',
    'Review a drill: title / ages / equipment / time / setup / cue / success check / easier version / home helper / fun / safety / what to improve: ____________________',
    'Name three drills you recommend and explain why: ____________________',
    'Player home practice: What is realistic for the family? What needs an adult? What would make a child want to return? ____________________',
    'Do not include child names, ratings, medical details, or private family information in this feedback sheet.',
    'Proposed changes require a versioned rubric and a new assessment; historical ratings must keep their original meaning.'].join('\n\n');
}

export function downloadText(filename, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function RankingReview() {
  return <section className="dl-ranking" aria-label="Ranking system review">
    <h2>Review what we measure.</h2>
    <p>Use this with other coaches before changing the rubric. Existing assessments keep their current scoring rules.</p>
    <div className="dl-weight-grid">{SCOUTING_CATEGORIES.map((category) => <div key={category.id}><h3>{category.label}</h3><strong>⅓ of overall</strong><p>{category.skills.map((skill) => skill.label).join(' · ')}</p><small>Each skill contributes {(100 / 3 / category.skills.length).toFixed(1)}% of overall.</small></div>)}</div>
    <details open><summary>How a rank is calculated today</summary><ol><li>Use each coach’s latest submission within the assessment. A newer partial submission replaces that coach’s earlier one.</li><li>Average observed ratings for each skill, then average skills within each category.</li><li>Rank only when all ten skills are covered. Average the three categories equally; missing observations stay blank.</li><li>Equal full-precision overall scores share a rank. Practice logs and home challenges never change a score.</li></ol></details>
    <details><summary>Decisions to review with coaches</summary><ul><li><strong>Bunting eligibility:</strong> bunting is required for a complete rank today, even when the division does not allow it. It also accounts for half the hitting score.</li><li><strong>Weighting:</strong> one hitting rating carries twice the weight of one infield or outfield rating. Decide whether this fits the assessment’s purpose.</li><li><strong>Evidence:</strong> a single observation counts as coverage. The score does not measure confidence, disagreement, age differences, or how old an assessment is.</li><li><strong>Missing qualities:</strong> baserunning, game decisions, communication, and response to coaching need discussion.</li><li><strong>Fairness:</strong> use observable behaviors in comparable conditions. Home equipment, attendance constraints, body size, rehab, and completion streaks should not become ability scores.</li></ul></details>
    <details><summary>Possible qualities and how to observe them</summary><div className="dl-table-wrap"><table><thead><tr><th>Quality for discussion</th><th>Observable behavior</th><th>Possible observation</th></tr></thead><tbody>{REVIEW_QUALITIES.map(([quality, behavior, station]) => <tr key={quality}><th scope="row">{quality}</th><td>{behavior}</td><td>{station}</td></tr>)}</tbody></table></div><p>These are discussion proposals. They are not scored in the current rubric. Keep supportive development observations separate from selection decisions where appropriate.</p></details>
    <details><summary>Current rating anchors</summary>{RATING_ANCHORS.map((anchor) => <p key={anchor.value}><strong>{anchor.value} · {anchor.label}:</strong> {anchor.description}</p>)}</details>
    <Button onClick={() => downloadText('diamond-live-coach-feedback.txt', createCoachFeedbackSheet())}>Download coach feedback worksheet</Button>
  </section>;
}

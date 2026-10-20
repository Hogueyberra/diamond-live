import { getPlayerHistory, SCOUTING_SKILLS } from './scouting.js';

// The request carries skill aggregates only. Names, dates of birth, rankings,
// individual scores and coach notes remain in the existing private workspace.
export function assessmentSummary(data, playerId = '', asOfDate = new Date().toISOString().slice(0, 10)) {
  if (!data?.players || !data?.sessions || !data?.evaluations) return [];
  const players = data.players.filter((p) => !p.archived && (!playerId || p.id === playerId));
  const ratings = players.map((p) => getPlayerHistory(data, p.id).filter((h) => h.session.date <= asOfDate).at(-1)?.ratings).filter(Boolean);
  return SCOUTING_SKILLS.filter((s) => s.id !== 'hit_bunting').map((skill) => ({ skillId: skill.id, observed: ratings.filter((r) => Number.isFinite(r[skill.id])).length, needsPractice: ratings.filter((r) => Number.isFinite(r[skill.id]) && r[skill.id] <= 5).length }))
    .filter((s) => s.observed > 0).sort((a, b) => b.needsPractice / b.observed - a.needsPractice / a.observed || b.needsPractice - a.needsPractice);
}

const fieldingSource = 'https://www.littleleague.org/university/articles/tee-ball-drills-fielding/';
const movementSource = 'https://www.littleleague.org/university/articles/tee-ball-drills-left-field-center-field-right-field/';
const basicsSource = 'https://www.littleleague.org/university/backyard-tips/';

// Constrained adaptations of the app's existing fundamentals. Every option fits
// the same simple equipment contract; no model-generated steps are executed.
export const ASSISTANT_DRILLS = {
  ready: { title: 'Ready-position rehearsal', steps: 'Stand comfortably with soft knees and hands ready. Partner points left or right; take one small step, settle, and reset. No ball needed.', cue: 'Soft knees, ready hands.', measure: 'Notice three balanced resets at a comfortable pace.', sourceUrl: fieldingSource },
  receive: { title: 'Receive a gentle roll', steps: 'Partner rolls a tennis ball slowly along clear grass. Get behind it and receive it in front with two bare hands. Pause, then roll it back only when the partner is ready. Switch roles regularly.', cue: 'Get behind; receive in front.', measure: 'Notice three controlled receptions; reduce the distance if needed.', sourceUrl: fieldingSource },
  gather: { title: 'Field, gather, aim', steps: 'Receive a slow roll with two hands, gather your feet, turn toward the ready partner, and freeze in balance. Roll the ball back; do not throw it. Switch roles regularly.', cue: 'Field, gather, find your partner.', measure: 'Repeat three balanced sequences without rushing.', sourceUrl: fieldingSource },
  move: { title: 'Read and move', steps: 'Without a ball, partner points left or right. Take a few controlled side steps, stop balanced, then return. Stay in your own space; switch roles.', cue: 'Eyes up, small steps.', measure: 'Notice three controlled stops in either direction.', sourceUrl: movementSource },
  aim: { title: 'Roll to a ready partner', steps: 'From an easy distance, roll a tennis ball toward the ready partner’s hands at ground level. The partner receives with two hands and rolls it back. Pause between rolls. This practices aiming without throwing workload.', cue: 'Look, aim, gentle roll.', measure: 'Notice three rolls the partner can receive without reaching far.', sourceUrl: fieldingSource },
  balance: { title: 'Balance rehearsal', steps: 'Without a bat or ball, find a comfortable athletic stance, turn gently through the hips, and pause in balance. Keep arms close and stay in your own space. Avoid forceful twisting.', cue: 'Comfortable stance, balanced finish.', measure: 'Notice three comfortable balanced finishes.', sourceUrl: basicsSource },
};
// The clubhouse records broad categories. Keep them broad rather than inventing
// granular scouting scores from a category rating.
const categorySkills = ['hitting', 'throwing', 'fielding', 'baserunning'];
const drillFor = (skill) => ['hit_swing', 'hitting'].includes(skill) ? 'balance' : skill === 'throwing' || /accuracy$/.test(skill) ? 'aim' : skill === 'baserunning' || /agility$/.test(skill) ? 'move' : /footwork$/.test(skill) ? 'gather' : 'receive';

export function createAssistantPractice(input = {}) {
  const bounded = (value, lo, hi, fallback) => Number.isInteger(value) && value >= lo && value <= hi ? value : fallback;
  const age = bounded(input.age, 5, 12, 8);
  const players = bounded(input.players, 1, 24, 8);
  const coaches = bounded(input.coaches, 1, 8, 2);
  const teamMinutes = bounded(input.teamMinutes, 10, 90, 15);
  const homeMinutes = bounded(input.homeMinutes, 5, 30, 10);
  const summary = Array.isArray(input.summary) ? input.summary.filter((x) => (categorySkills.includes(x.skillId) || SCOUTING_SKILLS.some((s) => s.id === x.skillId && s.id !== 'hit_bunting')) && Number.isInteger(x.observed) && x.observed > 0 && x.observed <= 100 && Number.isInteger(x.needsPractice) && x.needsPractice >= 0 && x.needsPractice <= x.observed) : [];
  const priorities = [...summary].filter((s) => s.needsPractice > 0).sort((a, b) => b.needsPractice / b.observed - a.needsPractice / a.observed || b.needsPractice - a.needsPractice);
  const selected = [...new Set(priorities.map((s) => drillFor(s.skillId)))].slice(0, 2);
  for (const id of ['receive', 'gather']) if (selected.length < 2 && !selected.includes(id)) selected.push(id);
  const blocks = (duration) => {
    const warm = Math.min(3, Math.floor(duration / 5));
    const second = Math.floor((duration - warm) / 2);
    let start = 0;
    return ['ready', ...selected].map((id, index) => { const minutes = [warm, second, duration - warm - second][index]; const block = { id, ...ASSISTANT_DRILLS[id], minutes, start, end: start + minutes }; start += minutes; return block; });
  };
  const pairs = Math.floor(players / 2);
  const hasOdd = players % 2 === 1;
  const extraAdult = hasOdd ? 1 : 0;
  const lanes = pairs + extraAdult;
  const supervision = players === 1 ? 'One coach works with the child.' : `Use ${pairs} child pair${pairs === 1 ? '' : 's'}${hasOdd ? ' and one child–coach pair' : ''}, each in a separate rolling lane. ${coaches} coach${coaches === 1 ? '' : 'es'} supervise ${lanes} lanes${hasOdd ? '; one coach partners with the unpaired child' : ''}. If everyone cannot be supervised, run smaller groups. Switch roles; no crossing lanes or scramble games.`;
  const safety = 'Use flat, clear grass and short, comfortable rolling distances. Leave enough space between lanes that balls and people cannot cross. Return balls by rolling only. Stop for discomfort or fatigue; an adult supervises throughout.';
  return {
    title: 'A little practice, a clear next step', age,
    basis: priorities.length ? `Focus selected from ${input.individual ? 'the selected player’s' : 'the team’s'} recorded skill assessments. Coach review confirms today’s priorities.` : 'No assessed priority is available. This is a general beginner fielding plan.',
    team: { title: 'Team session', minutes: teamMinutes, equipment: `${Math.max(1, lanes)} tennis ball${lanes > 1 ? 's' : ''}; no gloves, cones, bats, or other equipment.`, setup: supervision, blocks: blocks(teamMinutes), success: ASSISTANT_DRILLS[selected[0]].measure, safety },
    home: { title: 'At home with a parent', minutes: homeMinutes, equipment: 'One tennis ball; no other equipment.', setup: 'One child and one parent face each other on clear grass at an easy rolling distance. Take turns, pause to reset, and praise effort.', blocks: blocks(homeMinutes), success: ASSISTANT_DRILLS[selected[0]].measure, safety },
  };
}

export function practiceText(plan, audience = 'home') {
  const p = plan[audience];
  return `${p.title} · ${p.minutes} minutes\nEquipment: ${p.equipment}\n${p.setup}\n\n${p.blocks.map((b) => `${b.start}–${b.end} min: ${b.title}\n${b.steps}\nCue: ${b.cue}`).join('\n\n')}\n\nLook for: ${p.success}\n${p.safety}`;
}

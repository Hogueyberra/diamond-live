import { ASSESSMENT_SKILLS, DEMO_PLAYERS, playerSnapshot, localAssessmentDate } from './playerAssessments.js';

export const assistantDemoPlayers = DEMO_PLAYERS.map(({ id, name }) => ({ id: String(id), name }));

// Only category counts leave the browser. Never send names, notes, raw ratings,
// assessment history or the sample player's identifier to the assistant API.
export function demoAssessmentSummary(records = [], playerId = '', asOfDate = localAssessmentDate()) {
  const players = DEMO_PLAYERS.filter((player) => !playerId || String(player.id) === String(playerId));
  const eligibleRecords = records.filter((record) => record.observedOn <= asOfDate);
  const snapshots = players.map((player) => playerSnapshot(player.id, eligibleRecords));
  return ASSESSMENT_SKILLS.map(({ id }) => {
    const values = snapshots.map((snapshot) => snapshot[id]).filter((item) => item.source?.observedOn <= asOfDate && Number.isFinite(item.value));
    return { skillId: id, observed: values.length, needsPractice: values.filter((item) => item.value <= 5).length };
  }).filter((skill) => skill.observed > 0);
}

import { describe, expect, it } from 'vitest';
import { createDemoScoutingData, createEmptyRatings } from './scouting.js';
import { PRACTICE_DRILLS, canAddPracticeBlock, createPracticeActivity, getPracticeRecommendations, getPracticeTimeline, mergePracticeActivities, practiceMinutes, updatePracticeAssignment, validatePracticeFields } from './practicePlanning.js';
const event = { id: 'practice', teamId: 'team', seasonId: 'season', date: '2026-10-01', startTime: '16:30', endTime: '17:30' };

describe('practice suggestions', () => {
  it('uses each player’s latest assessment and does not invent missing observations', () => {
    const data = createDemoScoutingData(); const player = data.players[0];
    data.players = [player]; data.evaluations = data.evaluations.filter((entry) => entry.playerId === player.id);
    data.evaluations[0].ratings = Object.fromEntries(Object.keys(createEmptyRatings()).map((skill) => [skill, 1]));
    data.evaluations[1].ratings = { ...createEmptyRatings(), hit_swing: 4 };
    const result = getPracticeRecommendations(data, { asOfDate: '2026-10-01' });
    expect(result.team.map((item) => item.skillId)).toEqual(['hit_swing']);
    expect(result.individual[0]).toMatchObject({ playerId: player.id, skillId: 'hit_swing' });
    expect(result.individual[0].reason).toContain('2026-09-26');
    expect(JSON.stringify(result)).not.toContain('NaN');
  });
  it('excludes future and archived players, and counts only observed players for a skill', () => {
    const data = createDemoScoutingData();
    data.players[0].archived = true;
    const current = getPracticeRecommendations(data, { asOfDate: '2026-09-10' });
    expect(current.observedPlayers).toBe(5);
    expect(current.individual.every((item) => item.playerId !== data.players[0].id)).toBe(true);
    expect(current.individual.every((item) => item.reason.includes('2026-09-05'))).toBe(true);
    expect(getPracticeRecommendations(data, { asOfDate: '2026-01-01' }).observedPlayers).toBe(0);
  });
  it('never recommends bunting without division eligibility or infers a pitching prescription', () => {
    const data = createDemoScoutingData();
    data.evaluations.forEach((entry) => { entry.ratings = { ...createEmptyRatings(), hit_bunting: 1 }; });
    expect(getPracticeRecommendations(data, { asOfDate: '2026-10-01' }).team).toEqual([]);
    expect(getPracticeRecommendations(data, { asOfDate: '2026-10-01', allowBunting: true }).team[0].skillId).toBe('hit_bunting');
    data.evaluations.forEach((entry) => { entry.ratings = { ...createEmptyRatings(), if_accuracy: 1 }; });
    expect(getPracticeRecommendations(data, { asOfDate: '2026-10-01' }).team[0].id).toBe('target-throws');
  });
  it('does not copy ratings, ranking rationale or assessments into a shared activity', () => {
    const suggestion = { ...PRACTICE_DRILLS[0], ratings: { if_glove: 1 }, reason: 'Private ranking explanation', playerId: 'p1', playerName: 'Example Player', average: 1 };
    const activity = createPracticeActivity(event, suggestion, { id: 'block-1' });
    expect(activity).toMatchObject({ playerId: 'p1', playerName: 'Example Player', minutes: 8, completed: false });
    expect(activity).not.toHaveProperty('ratings'); expect(activity).not.toHaveProperty('reason'); expect(activity).not.toHaveProperty('average');
  });
});

describe('practice time blocks and assignments', () => {
  it('keeps legacy array order, honors explicit ordering, and computes consecutive clock times', () => {
    const result = getPracticeTimeline(event, [{ id: 'a', minutes: 10 }, { id: 'b', minutes: 15 }]);
    expect(result.blocks.map((block) => [block.startsAt, block.endsAt])).toEqual([['16:30', '16:40'], ['16:40', '16:55']]);
    expect(result.remainingMinutes).toBe(35);
    expect(getPracticeTimeline(event, [{ id: 'a', minutes: 10, order: 1 }, { id: 'b', minutes: 15, order: 0 }]).blocks[0].id).toBe('b');
  });
  it('allows exact fit and rejects overflow, invalid durations and backwards events', () => {
    expect(canAddPracticeBlock(event, [{ minutes: 50 }], 10)).toBe(true);
    expect(canAddPracticeBlock(event, [{ minutes: 50 }], 11)).toBe(false);
    for (const value of [0, -1, 2.5, NaN, 121]) expect(canAddPracticeBlock(event, [], value)).toBe(false);
    expect(practiceMinutes({ ...event, endTime: '16:00' })).toBe(0);
    expect(getPracticeTimeline(event, [{ minutes: 65 }])).toMatchObject({ remainingMinutes: -5, overflow: true });
  });
  it('reserves drafts for the manager and prevents assistants stealing/assigning another coach’s block', () => {
    const block = { id: 'a' }; const actor = { actorId: 'coach-a', isManager: false, targetCoachId: 'coach-a', targetCoachName: 'A' };
    expect(() => updatePracticeAssignment(block, { ...actor, planStatus: 'draft' })).toThrow(/after the manager/);
    expect(updatePracticeAssignment(block, { ...actor, planStatus: 'released' })).toMatchObject({ assignedCoachId: 'coach-a' });
    expect(() => updatePracticeAssignment({ ...block, assignedCoachId: 'coach-b' }, { ...actor, planStatus: 'released' })).toThrow();
    expect(() => updatePracticeAssignment(block, { ...actor, planStatus: 'released', targetCoachId: 'coach-b' })).toThrow();
    expect(updatePracticeAssignment({ ...block, assignedCoachId: 'coach-a', assignedCoachName: 'A' }, { ...actor, planStatus: 'released', targetCoachId: '' })).toEqual(block);
    expect(updatePracticeAssignment({ ...block, assignedCoachId: 'coach-a' }, { ...actor, isManager: true, planStatus: 'draft', targetCoachId: 'coach-b' })).toMatchObject({ assignedCoachId: 'coach-b' });
  });
});


describe('practice metadata validation', () => {
  const workspace = (activity = {}, practice = {}) => ({ events: [{ ...event, type: 'practice', ...practice }], activities: [{ id: 'block', eventId: event.id, minutes: 10, ...activity }] });
  it('rejects oversized instructions, unsafe references, unknown skills and duplicate orders', () => {
    for (const values of [{ steps: Array(21).fill('Step') }, { steps: [''] }, { setup: 'x'.repeat(2001) }, { sourceUrl: 'javascript:alert(1)' }, { skillId: 'pitch_velocity' }, { playerName: 'Name without ID' }, { assignedCoachId: 'coach' }]) expect(() => validatePracticeFields(workspace(values))).toThrow(/Invalid practice/);
    const duplicate = workspace({ order: 0 }); duplicate.activities.push({ id: 'other', eventId: event.id, minutes: 5, order: 0 });
    expect(() => validatePracticeFields(duplicate)).toThrow(/order must be unique/);
  });
  it('allows legacy overflow for repair but rejects new structured overflow', () => {
    expect(() => validatePracticeFields(workspace({ minutes: 65 }))).not.toThrow();
    expect(() => validatePracticeFields(workspace({ minutes: 65, order: 0 }))).toThrow(/exceed/);
    expect(() => validatePracticeFields(workspace({ minutes: 65 }, { planStatus: 'released' }))).toThrow(/exceed/);
    expect(() => validatePracticeFields(workspace({ minutes: 60, setup: '', equipment: '', steps: [] }, { planStatus: 'draft' }))).not.toThrow();
  });
});


describe('merging practice changes into the shared workspace', () => {
  const first = { id: 'first', eventId: 'practice-a', teamId: 'team', minutes: 8, order: 0 };
  const second = { id: 'second', eventId: 'practice-b', teamId: 'team', minutes: 10, order: 0 };
  const third = { id: 'third', eventId: 'practice-a', teamId: 'team', minutes: 5, order: 1 };
  it('preserves the global activity ID sequence when an assistant claims an earlier practice block', () => {
    const all = [first, second, third];
    const updated = mergePracticeActivities(all, [{ ...first, assignedCoachId: 'assistant', assignedCoachName: 'Assistant' }, third], 'practice-a', 'team');
    expect(updated.map((item) => item.id)).toEqual(all.map((item) => item.id));
    expect(updated[0].assignedCoachId).toBe('assistant');
    expect(updated[1]).toEqual(second);
    expect(all[0]).not.toHaveProperty('assignedCoachId');
  });
  it('uses order metadata for manager reordering without shifting other practices', () => {
    const updated = mergePracticeActivities([first, second, third], [{ ...third, order: 0 }, { ...first, order: 1 }], 'practice-a', 'team');
    expect(updated.map((item) => item.id)).toEqual(['first', 'second', 'third']);
    expect(getPracticeTimeline(event, updated.filter((item) => item.eventId === 'practice-a')).blocks.map((item) => item.id)).toEqual(['third', 'first']);
  });
  it('removes only omitted target blocks and appends new blocks while preserving other teams', () => {
    const elsewhere = { ...first, id: 'elsewhere', teamId: 'other-team' };
    const fresh = { ...first, id: 'new', order: 2 };
    const updated = mergePracticeActivities([first, second, third, elsewhere], [first, fresh], 'practice-a', 'team');
    expect(updated.map((item) => item.id)).toEqual(['first', 'second', 'elsewhere', 'new']);
    expect(updated[2]).toEqual(elsewhere);
  });
});

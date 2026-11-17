import { describe, expect, it } from 'vitest';
import { addReviewedPractice } from './livePractice.js';
import { createAssistantPractice } from '../assistantPractice.js';
const team = { id: 'private-team', seasonId: 'private-season', name: 'Real team', division: 'Minor B', league: 'HVLL', season: '2026' };
const data = () => ({ schemaVersion: 1, teams: [team], events: [], activities: [], observations: [] });
const details = { title: 'Tuesday reps', date: '2026-11-17', startTime: '17:00', location: 'Team field' };
describe('reviewed assistant plan storage', () => {
  it('saves a valid scoped draft with exact minutes, instructions, and a parent version without assessment data', () => {
    const plan = createAssistantPractice({ teamMinutes: 23, homeMinutes: 10, summary: [{ skillId: 'if_footwork', observed: 4, needsPractice: 3 }] });
    let n = 0; const initial = data();
    const result = addReviewedPractice(initial, team, details, plan, () => `id-${++n}`);
    expect(initial.events).toEqual([]);
    expect(result.event).toMatchObject({ teamId: team.id, seasonId: team.seasonId, planStatus: 'draft', endTime: '17:23' });
    expect(result.data.activities.reduce((sum, block) => sum + block.minutes, 0)).toBe(23);
    expect(result.data.activities.every((block) => block.eventId === result.event.id && block.steps.length && block.safetyNote)).toBe(true);
    expect(result.event.notes).toContain('At home with a parent');
    expect(result.event.notes.length).toBeLessThan(4000);
    expect(JSON.stringify(result.data)).not.toMatch(/observed|needsPractice|rankings|playerId/);
  });
  it('rejects stale team scope, midnight overflow, and invalid event details', () => {
    const plan = createAssistantPractice();
    expect(() => addReviewedPractice(data(), { ...team, seasonId: 'changed' }, details, plan)).toThrow(/team changed/);
    expect(() => addReviewedPractice(data(), team, { ...details, startTime: '23:55' }, plan)).toThrow(/one day/);
    expect(() => addReviewedPractice(data(), team, { ...details, location: '' }, plan)).toThrow(/invalid event/);
  });
  it('appends a new practice while preserving existing shared plans', () => {
    const plan = createAssistantPractice();
    const first = addReviewedPractice(data(), team, details, plan);
    const next = addReviewedPractice(first.data, team, details, plan);
    expect(next.data.events[0]).toEqual(first.event);
    expect(next.data.activities.slice(0, 3)).toEqual(first.data.activities);
    expect(new Set(next.data.activities.map((block) => block.id)).size).toBe(6);
  });
});

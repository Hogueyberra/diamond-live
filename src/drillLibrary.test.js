import { describe, expect, it } from 'vitest';
import { DRILL_LIBRARY, RECOVERED_GUIDES, createHomePracticeCard, getEligibleDrills } from './drillLibrary.js';
import { SCOUTING_SKILLS, createDemoScoutingData, createEmptyRatings, getRankedPlayers } from './scouting.js';
import { createPracticeActivity, getPracticeRecommendations, validatePracticeFields } from './practicePlanning.js';

describe('drill fit and family handouts', () => {
  it('offers multiple options for every rated skill, with bunting enabled deliberately', () => {
    for (const skill of SCOUTING_SKILLS) expect(getEligibleDrills({ skillId: skill.id, allowBunting: true, autoOnly: true }).length).toBeGreaterThanOrEqual(2);
    expect(new Set(DRILL_LIBRARY.map((item) => item.id)).size).toBe(DRILL_LIBRARY.length);
  });
  it('restricts home, helper, age, throwing, and bunting combinations', () => {
    const safeHome = getEligibleDrills({ setting: 'home', age: 7, soloOnly: true, noThrowing: true });
    expect(safeHome.length).toBeGreaterThan(5);
    expect(safeHome.every((item) => item.home.helper === 'solo' && !item.throwing && !item.requiresBunting && item.ages[0] <= 7)).toBe(true);
    expect(getEligibleDrills({ setting: 'home' }).some((item) => item.id === 'quiet-landings' || item.id === 'bullpen-reset')).toBe(false);
    expect(getEligibleDrills({ age: 7 }).some((item) => item.id === 'quiet-landings')).toBe(false);
    expect(getEligibleDrills({ age: 14 })).toEqual([]);
    expect(() => createHomePracticeCard(DRILL_LIBRARY.find((item) => !item.home))).toThrow(/coached practice/);
  });
  it('exports household equipment and prompts without leaking any private recommendation fields', () => {
    const drill = DRILL_LIBRARY.find((item) => item.id === 'field-gather');
    const card = createHomePracticeCard({ ...drill, playerName: 'Private child', reason: 'Private explanation', ratings: { if_glove: 1 } });
    expect(card).toContain('You need: Two socks');
    expect(card).toContain('Something I noticed'); expect(card).toContain('No partner needed');
    expect(card).not.toContain('Private'); expect(card).not.toContain('if_glove');
    for (const item of DRILL_LIBRARY.filter((entry) => entry.home)) {
      expect(item.home.equipment).toBeTruthy();
      expect(createHomePracticeCard(item)).not.toContain('undefined');
    }
  });
  it('keeps every library drill compatible with shared instruction validation', () => {
    const event = { id: 'practice', type: 'practice', teamId: 'team', seasonId: 'season', startTime: '16:00', endTime: '17:00' };
    for (const item of DRILL_LIBRARY) expect(() => validatePracticeFields({ events: [event], activities: [createPracticeActivity(event, item)] })).not.toThrow();
  });
  it('preserves recovered age gates and keeps new qualities outside automatic ratings', () => {
    expect(getEligibleDrills({ guide: 'Barrel Quest', age: 11 })).toEqual([]);
    expect(getEligibleDrills({ guide: 'Command Quest', age: 7 })).toEqual([]);
    expect(getEligibleDrills({ guide: 'Next Pitch', age: 7 })).toEqual([]);
    expect(getEligibleDrills({ guide: 'Diamond Dash', age: 7 }).length).toBeGreaterThan(0);
    const recovered = DRILL_LIBRARY.filter((item) => item.sourceGuide);
    for (const item of recovered) {
      expect(RECOVERED_GUIDES.some((guide) => guide.title === item.sourceGuide)).toBe(true);
      expect(item.sourceActivity).toBeTruthy();
      expect(createHomePracticeCard(item)).toContain(`Adapted from: ${item.sourceGuide} · ${item.sourceActivity}`);
      if (item.topic !== 'Hitting') expect(item).toMatchObject({ skillId: '', autoRecommend: false });
    }
    expect(getEligibleDrills({ guide: 'Barrel Quest', autoOnly: true, age: 9 }).every((item) => item.skillId === 'hit_swing')).toBe(true);
    expect(getEligibleDrills({ query: 'Quest 5B - Barrel-Streak' }).map((item) => item.id)).toEqual(['quest-contact-chain']);
  });
  it('uses the home version of a recovered game without requiring the practice equipment', () => {
    const traffic = createHomePracticeCard(DRILL_LIBRARY.find((item) => item.id === 'quest-traffic-light'));
    const paper = createHomePracticeCard(DRILL_LIBRARY.find((item) => item.id === 'quest-mini-game'));
    expect(traffic).toContain('empty hands only');
    expect(paper).toContain('Paper, pencil, coin');
    for (const card of [traffic, paper]) {
      expect(card).not.toMatch(/Wear a helmet|secured net/);
      expect(card).toContain('never a player rating');
      expect(card).toContain('You may repeat an easy level');
      expect(card).not.toContain('/Users/');
    }
  });
});

describe('recommendation variety without score changes', () => {
  const observedGlove = () => {
    const data = createDemoScoutingData();
    data.players = [data.players[0]];
    data.evaluations = data.evaluations.filter((item) => item.playerId === data.players[0].id).map((item) => ({ ...item, ratings: { ...createEmptyRatings(), if_glove: 3 } }));
    return data;
  };
  it('uses unused alternatives and exposes home options without changing assessments', () => {
    const data = observedGlove(); const saved = structuredClone(data);
    const initial = getPracticeRecommendations(data, { asOfDate: '2026-10-01' });
    expect(initial.individual[0].id).toBe('quiet-glove');
    expect(initial.individual[0].alternatives.map((item) => item.id)).toContain('glove-gate');
    const next = getPracticeRecommendations(data, { asOfDate: '2026-10-01', recentDrillIds: ['quiet-glove'], setting: 'home' });
    expect(next.individual[0].id).toBe('glove-gate');
    expect(next.individual[0].home).toBeTruthy();
    expect(data).toEqual(saved); expect(getRankedPlayers(data, data.sessions[1].id)[0].overall).toBeNull();
  });
  it('does not recommend out-of-range activities to a player or a whole team', () => {
    const data = observedGlove(); data.players[0].age = 14;
    expect(getPracticeRecommendations(data, { asOfDate: '2026-10-01' })).toMatchObject({ team: [], individual: [] });
    data.players[0].age = null;
    expect(getPracticeRecommendations(data, { asOfDate: '2026-10-01' }).individual).toHaveLength(1);
    data.players.push({ ...data.players[0], id: 'unobserved-player', age: 14 });
    expect(getPracticeRecommendations(data, { asOfDate: '2026-10-01' }).team).toEqual([]);
  });
});

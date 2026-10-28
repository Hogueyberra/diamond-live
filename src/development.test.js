import { describe, expect, it } from 'vitest';
import { DRILL_LIBRARY } from './drillLibrary.js';
import { DEMO_SCOUTING_AUTHOR_ID, createDemoScoutingData, getRankedPlayers } from './scouting.js';
import { checkDevelopmentFit, createDevelopmentHandout, createDrillSnapshot, createEmptyDevelopmentData, validateDevelopmentData, validateDevelopmentUpdate } from './development.js';
export const planId = '30000000-0000-4000-8000-000000000001';
export function planFixture() {
  const player = createDemoScoutingData().players[0];
  const item = DRILL_LIBRARY.find((entry) => entry.id === 'field-gather');
  const now = '2026-10-02T18:00:00.000Z';
  return { id: planId, playerId: player.id, seasonId: 'test-season', createdBy: DEMO_SCOUTING_AUTHOR_ID, createdAt: now,
    versions: [{ version: 1, createdBy: DEMO_SCOUTING_AUTHOR_ID, createdAt: now, goal: 'Gather my feet in balance.', privateNotes: 'PRIVATE coach explanation', followUpDate: '2026-10-09', status: 'active', practice: createDrillSnapshot(item), home: createDrillSnapshot(item,'home'), alternateHome: null, practiceBlockId: '' }] };
}
describe('coach development plans', () => {
  it('captures compatible instructions for every catalog entry without recommendation metadata', () => {
    for (const item of DRILL_LIBRARY) {
      const snapshot = createDrillSnapshot({ ...item, ratings:{if_glove:1},reason:'PRIVATE',playerName:'PRIVATE' });
      expect(snapshot).not.toHaveProperty('ratings'); expect(snapshot).not.toHaveProperty('reason');
      const plan = planFixture(); plan.versions[0].practice = snapshot;
      plan.versions[0].home = item.home ? createDrillSnapshot(item,'home') : null;
      expect(() => validateDevelopmentData({ schemaVersion:1,plans:[plan],reviews:[] })).not.toThrow();
    }
  });
  it('retains prior instructions and original identity, with one coach-authored version per update', () => {
    const previous = { ...createEmptyDevelopmentData(), plans:[planFixture()] };
    const next = structuredClone(previous);
    next.plans[0].versions.push({...structuredClone(next.plans[0].versions[0]),version:2,createdAt:'2026-10-03T18:00:00Z',goal:'A new goal.'});
    expect(() => validateDevelopmentUpdate(previous,next,DEMO_SCOUTING_AUTHOR_ID)).not.toThrow();
    next.plans[0].versions[0].home.setup = 'Rewritten old instructions';
    expect(() => validateDevelopmentUpdate(previous,next,DEMO_SCOUTING_AUTHOR_ID)).toThrow(/permanent/);
    const deleted = {...previous, plans:[]}; expect(() => validateDevelopmentUpdate(previous,deleted,DEMO_SCOUTING_AUTHOR_ID)).toThrow(/cannot be deleted/);
    const reassigned = structuredClone(previous); reassigned.plans[0].playerId = '30000000-0000-4000-8000-000000000002';
    expect(() => validateDevelopmentUpdate(previous,reassigned,DEMO_SCOUTING_AUTHOR_ID)).toThrow(/identity/);
  });
  it('binds authors and immutable follow-ups to a real saved plan version', () => {
    const previous = {...createEmptyDevelopmentData(),plans:[planFixture()]};
    const review = {id:'40000000-0000-4000-8000-000000000001',planId,version:1,createdBy:DEMO_SCOUTING_AUTHOR_ID,createdAt:'2026-10-02T19:00:00Z',outcome:'needs-help',reflection:'Asked for an easier game.',coachNotes:''};
    const next = {...previous,reviews:[review]};
    expect(() => validateDevelopmentUpdate(previous,next,DEMO_SCOUTING_AUTHOR_ID)).not.toThrow();
    expect(() => validateDevelopmentUpdate(next,{...next,reviews:[{...review,reflection:'Changed history'}]},DEMO_SCOUTING_AUTHOR_ID)).toThrow(/cannot be changed/);
    expect(() => validateDevelopmentData({...next,reviews:[{...review,version:2}]})).toThrow(/missing plan version/);
    expect(() => validateDevelopmentUpdate(previous,next,'40000000-0000-4000-8000-000000000002')).toThrow(/current coach/);
  });
  it('exports only approved home instructions and never private notes, IDs, scores, or review history', () => {
    const plan = planFixture(); const card = createDevelopmentHandout({...plan,ratings:'PRIVATE',reason:'PRIVATE'});
    expect(card).toContain('You need: Two socks'); expect(card).toContain('My goal: Gather my feet in balance.');
    expect(card).not.toContain('PRIVATE'); expect(card).not.toContain(plan.playerId); expect(card).not.toContain(plan.id);
    expect(card).toContain('does not submit anything online');
    const data = createDemoScoutingData(); const ranked = getRankedPlayers(data,data.sessions[0].id);
    validateDevelopmentData({...createEmptyDevelopmentData(),plans:[plan]});
    expect(getRankedPlayers(data,data.sessions[0].id)).toEqual(ranked);
  });
  it('enforces known age, active roster and deliberate bunting eligibility', () => {
    const version = planFixture().versions[0];
    const player = {...createDemoScoutingData().players[0],age:7};
    version.home = createDrillSnapshot(DRILL_LIBRARY.find(item=>item.id==='command-team-shield'),'home');
    expect(() => checkDevelopmentFit(version,player,false)).toThrow(/ages 8–12/);
    version.home = createDrillSnapshot(DRILL_LIBRARY.find(item=>item.id==='soft-bunt'),'home');
    expect(() => checkDevelopmentFit(version,player,false)).toThrow(/division permits bunting/);
    expect(() => checkDevelopmentFit(version,player,true)).not.toThrow();
    expect(() => checkDevelopmentFit(version,{...player,archived:true},true)).toThrow(/active player/);
  });
});

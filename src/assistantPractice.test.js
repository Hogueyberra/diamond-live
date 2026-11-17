import { describe, it, expect } from 'vitest';
import { createAssistantPractice, practiceText, assessmentSummary } from './assistantPractice.js';

describe('constrained assistant practice', () => {
  it('keeps exact time totals across supported durations and does not add home equipment', () => {
    for (const teamMinutes of [10, 15, 23, 60, 90]) for (const homeMinutes of [5, 10, 17, 30]) {
      const plan = createAssistantPractice({ teamMinutes, homeMinutes });
      for (const key of ['team', 'home']) {
        expect(plan[key].blocks.reduce((sum, b) => sum + b.minutes, 0)).toBe(plan[key].minutes);
        expect(plan[key].blocks.at(-1).end).toBe(plan[key].minutes);
      }
      expect(plan.home.equipment).toBe('One tennis ball; no other equipment.');
      expect(plan.team.setup).toContain('4 child pairs');
      expect(plan.team.setup).toContain('2 coaches');
    }
  });
  it('uses assessed skills and excludes private comparison data from the parent handout', () => {
    const plan = createAssistantPractice({ summary: [{ skillId: 'if_footwork', observed: 8, needsPractice: 6 }, { skillId: 'if_glove', observed: 8, needsPractice: 5 }], individual: true });
    expect(plan.team.blocks[1].id).toBe('gather');
    const home = practiceText(plan);
    expect(home).not.toMatch(/ranking|score|six of|6 of|assessment/i);
    expect(home).toContain('roll');
    expect(home).toContain('discomfort');
  });
  it('handles odd groups, one child, no observations, invalid inputs and bunting safely', () => {
    expect(createAssistantPractice({ players: 7 }).team.setup).toContain('child–coach pair');
    expect(createAssistantPractice({ players: 1 }).team.setup).toContain('One coach');
    const plan = createAssistantPractice({ teamMinutes: -1, summary: [{ skillId: 'hit_bunting', observed: 8, needsPractice: 8 }] });
    expect(plan.team.minutes).toBe(15);
    expect(plan.basis).toContain('No assessed priority');
    expect(assessmentSummary(null)).toEqual([]);
  });
});

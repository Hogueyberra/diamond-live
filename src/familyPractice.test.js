import { describe, expect, it } from 'vitest';
import { createFamilyDemoRepository } from './familyDemo.js';
import { validateMyPractice, validateReflectionDraft, validateFamilyReflection } from './familyPractice.js';
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const fixture = () => createFamilyDemoRepository().load();
describe('family payload boundary', () => {
  it('accepts only the approved home snapshot for the linked child', async () => {
    const data = await fixture(); expect(validateMyPractice(data)).toBe(data);
    expect(JSON.stringify(data)).not.toMatch(/privateNotes|evaluations|rank|practiceBlockId|createdBy/);
  });
  it.each(['privateNotes','practice','rank','guardianId'])('rejects a leaked %s field on a plan', async (field) => {
    const data = await fixture(); data.plans[0][field] = 'PRIVATE'; expect(() => validateMyPractice(data)).toThrow();
  });
  it('rejects home instructions for an unlinked child or different team', async () => {
    const data = await fixture(); data.plans[0].playerId=uid(7); expect(() => validateMyPractice(data)).toThrow(/linked child/);
    data.plans[0].playerId=data.children[0].playerId; data.plans[0].teamId=uid(8); expect(() => validateMyPractice(data)).toThrow(/linked child/);
  });
  it('rejects private data nested in an instruction snapshot', async () => {
    const data = await fixture(); data.plans[0].home.privateNotes='PRIVATE'; expect(() => validateMyPractice(data)).toThrow();
  });
  it('allows older reflections while showing newer or removed home assignments', async () => {
    const data = await fixture(); const plan=data.plans[0];
    data.reflections=[{id:uid(9),teamId:plan.teamId,planId:plan.id,version:1,outcome:'tried',reflection:'Fun',fun:null,createdAt:'2026-10-06T20:00:00Z'}];
    data.plans=[]; expect(validateMyPractice(data)).toBe(data);
  });
  it.each([0,4,2.5,'2'])('rejects invalid fun feedback %s', (fun) => {
    expect(() => validateReflectionDraft({id:uid(1),teamId:uid(2),planId:uid(3),version:1,outcome:'tried',reflection:'',fun})).toThrow();
  });
  it('rejects caller-supplied authors and timestamps on a write', () => {
    const draft={id:uid(1),teamId:uid(2),planId:uid(3),version:1,outcome:'tried',reflection:'',fun:null};
    expect(validateReflectionDraft(draft)).toBe(draft);
    expect(() => validateReflectionDraft({...draft,guardianId:uid(4)})).toThrow();
    expect(() => validateReflectionDraft({...draft,createdAt:'2026-10-06T20:00:00Z'})).toThrow();
    expect(validateFamilyReflection({...draft,createdAt:'2026-10-06T20:00:00Z'})).toBeTruthy();
  });
});

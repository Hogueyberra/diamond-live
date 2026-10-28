import { DRILL_LIBRARY } from './drillLibrary.js';
import { createDrillSnapshot } from './development.js';
import { validateMyPractice, validateReflectionDraft } from './familyPractice.js';
const teamId = '40000000-0000-4000-8000-000000000001';
const playerId = '40000000-0000-4000-8000-000000000002';
export function createFamilyDemoRepository() {
  const data = validateMyPractice({
    children: [{ linkId: '40000000-0000-4000-8000-000000000003', teamId, teamName: 'Angels · Sample family', playerId, playerName: 'Alex Example' }],
    plans: [{ id: '40000000-0000-4000-8000-000000000004', teamId, playerId, version: 1, goal: 'Gather my feet and finish in balance.', followUpDate: '2026-10-09', status: 'active', home: createDrillSnapshot(DRILL_LIBRARY.find((item) => item.id === 'field-gather'), 'home'), alternateHome: createDrillSnapshot(DRILL_LIBRARY.find((item) => item.id === 'balance-star'), 'home') }],
    reflections: [],
  });
  return { load: async () => structuredClone(data), save: async (draft) => {
    validateReflectionDraft(draft);
    const existing = data.reflections.find((item) => item.id === draft.id);
    if (existing) return structuredClone(existing);
    const saved = { ...draft, createdAt: new Date().toISOString() }; data.reflections.push(saved); return saved;
  } };
}

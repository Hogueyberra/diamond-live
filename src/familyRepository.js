import { validateFamilyFeedback, validateFamilyReflection, validateGuardianAccess, validateMyPractice, validateReflectionDraft } from './familyPractice.js';

export function createFamilyRepository(client) {
  if (!client?.rpc) throw new Error('Family practice storage is not configured.');
  async function rpc(name, args) {
    let response;
    try { response = await client.rpc(name, args); } catch (error) { throw Object.assign(new Error('Family practice could not be reached. Your draft is still in this tab.'), { code: error.code || 'NETWORK' }); }
    if (response.error) throw Object.assign(new Error(response.error.message || 'Family practice could not be loaded.'), { code: response.error.code });
    return response.data;
  }
  return {
    load: async () => validateMyPractice(await rpc('load_my_practice')),
    claim: (code) => { if (!/^[0-9a-f]{64}$/.test(code)) throw new Error('Enter the 64-character family invitation code from your team owner.'); return rpc('claim_guardian_invite', { p_code: code }); },
    save: async (draft) => { validateReflectionDraft(draft); const result = validateFamilyReflection(await rpc('save_family_reflection', { p_data: draft })); if (Object.keys(draft).some((key) => result[key] !== draft[key])) throw new Error('The saved reflection could not be verified. Keep your draft and retry.'); return result; },
    access: async (teamId) => validateGuardianAccess(await rpc('list_guardian_access', { p_team_id: teamId })),
    invite: async (teamId, playerId, email) => {
      const result = await rpc('create_guardian_invite', { p_team_id: teamId, p_player_id: playerId, p_email: email.trim() });
      if (!result || !/^[0-9a-f]{64}$/.test(result.code) || !Number.isFinite(Date.parse(result.expiresAt))) throw new Error('The invitation code could not be verified. Refresh access before creating another.');
      return result;
    },
    revoke: (teamId, id, kind) => rpc('revoke_guardian_access', { p_team_id: teamId, p_id: id, p_kind: kind }),
    feedback: async (teamId) => { const result = validateFamilyFeedback(await rpc('list_family_feedback', { p_team_id: teamId })); if (result.some((item) => item.teamId !== teamId)) throw new Error('The family feedback belongs to another team.'); return result; },
  };
}

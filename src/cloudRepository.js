import { validateCoachingData } from './coachingStore.js';

export class CloudConflictError extends Error {
  constructor(cause) {
    super('This team changed on another device. Your draft is retained; load the latest version before saving again.');
    this.name = 'CloudConflictError';
    this.code = 'CONFLICT';
    this.cause = cause;
  }
}

function cloudError(error) {
  if (error?.code === '40001') return new CloudConflictError(error);
  const message = error?.code === '42501'
    ? 'Your account does not have access to this team action. Refresh your team access or sign in again.'
    : error?.message || 'The server could not be reached. Your changes have not been confirmed as saved.';
  const result = new Error(message);
  result.code = error?.code || 'NETWORK';
  result.cause = error;
  return result;
}

function workspaceResult(result) {
  if (!result || !Number.isSafeInteger(result.revision) || result.revision < 1 || !Number.isFinite(Date.parse(result.updatedAt))) {
    throw new Error('The server returned an invalid workspace. Your local draft has not been changed.');
  }
  validateCoachingData(result.data);
  return { data: result.data, revision: result.revision, updatedAt: result.updatedAt };
}

/** Access always uses the current signed-in Supabase session. Never supply a service key. */
export function createCloudRepository(client) {
  if (!client?.rpc) throw new Error('Shared storage is not configured.');
  async function rpc(name, args = {}) {
    let result;
    try { result = await client.rpc(name, args); }
    catch (error) { throw cloudError(error); }
    if (result.error) throw cloudError(result.error);
    return result.data;
  }
  return {
    getProfile: () => rpc('get_profile'),
    saveProfile: (displayName) => rpc('save_profile', { p_display_name: displayName.trim() }),
    listTeams: () => rpc('list_my_teams'),
    createTeam: ({ name, league, division, season }) => rpc('create_team', {
      p_name: name.trim(), p_league: league.trim(), p_division: division.trim(), p_season: season.trim(),
    }),
    loadWorkspace: async (teamId) => workspaceResult(await rpc('load_workspace', { p_team_id: teamId })),
    saveWorkspace: async (teamId, expectedRevision, data, mutationId) => {
      validateCoachingData(data);
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mutationId ?? '')) {
        throw new Error('A valid revision and save request ID are required.');
      }
      return workspaceResult(await rpc('save_workspace', {
        p_team_id: teamId, p_expected_revision: expectedRevision, p_data: data, p_mutation_id: mutationId,
      }));
    },
    createInvite: (teamId, role) => rpc('create_team_invite', { p_team_id: teamId, p_role: role }),
    joinTeam: (code) => rpc('join_team', { p_code: code.trim().toLowerCase() }),
    listMembers: (teamId) => rpc('list_team_members', { p_team_id: teamId }),
    removeMember: (teamId, userId) => rpc('remove_team_member', { p_team_id: teamId, p_user_id: userId }),
    listInvites: (teamId) => rpc('list_team_invites', { p_team_id: teamId }),
    revokeInvite: (teamId, inviteId) => rpc('revoke_team_invite', { p_team_id: teamId, p_invite_id: inviteId }),
  };
}

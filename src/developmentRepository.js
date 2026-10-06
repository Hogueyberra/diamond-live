import { CloudConflictError } from './cloudRepository.js';
import { validateDevelopmentData } from './development.js';

export function createDevelopmentRepository(client) {
  if (!client?.rpc) throw new Error('Development plan storage is not configured.');
  async function rpc(name, args) {
    let response;
    try { response = await client.rpc(name, args); } catch (error) {
      throw Object.assign(new Error(error.message || 'Development plans could not be reached. Your draft is still in this tab.'), { code: error.code || 'NETWORK' });
    }
    if (response.error) {
      if (response.error.code === '40001') throw new CloudConflictError(response.error);
      const error = new Error(response.error.code === '42501' ? 'Development plans are available only to the team’s coaches. Refresh your access.' : response.error.message || 'Development plans could not be saved.');
      error.code = response.error.code; throw error;
    }
    const result = response.data;
    if (!result || !Number.isSafeInteger(result.revision) || result.revision < 0 || (result.revision === 0 ? result.updatedAt !== null : !Number.isFinite(Date.parse(result.updatedAt)))) throw new Error('The development plan response could not be verified.');
    validateDevelopmentData(result.data);
    if (result.revision === 0 && (result.data.plans.length || result.data.reviews.length)) throw new Error('An unsaved development workspace must be empty.');
    return result;
  }
  return {
    loadWorkspace: (teamId) => rpc('load_development_workspace', { p_team_id: teamId }),
    saveWorkspace: (teamId, revision, data, mutationId) => {
      validateDevelopmentData(data);
      if (!Number.isSafeInteger(revision) || revision < 0 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mutationId ?? '')) throw new Error('A valid revision and save request ID are required.');
      return rpc('save_development_workspace', { p_team_id: teamId, p_expected_revision: revision, p_data: data, p_mutation_id: mutationId });
    },
  };
}

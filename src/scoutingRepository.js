import { CloudConflictError } from './cloudRepository.js';
import { validateScoutingData } from './scouting.js';

function scoutingError(error) {
  if (error?.code === '40001') return new CloudConflictError(error);
  const result = new Error(error?.code === '42501'
    ? 'Scouting is available only to this team’s owner and coaches. Refresh your team access or sign in again.'
    : error?.message || 'Scouting could not be reached. Your changes have not been confirmed as saved.');
  result.code = error?.code || 'NETWORK';
  result.cause = error;
  return result;
}

function scoutingResult(result) {
  if (!result || !Number.isSafeInteger(result.revision) || result.revision < 0
    || (result.revision === 0 ? result.updatedAt !== null : !Number.isFinite(Date.parse(result.updatedAt)))) {
    throw new Error('The server returned an invalid scouting workspace. Your draft has not been changed.');
  }
  validateScoutingData(result.data);
  if (result.revision === 0 && ['players', 'sessions', 'evaluations', 'goals'].some((key) => result.data[key].length)) {
    throw new Error('An unsaved scouting workspace must be empty.');
  }
  return { data: result.data, revision: result.revision, updatedAt: result.updatedAt };
}

/** Scouting uses separate coach-only RPCs, never the viewer-readable team snapshot. */
export function createScoutingRepository(client) {
  if (!client?.rpc) throw new Error('Shared scouting storage is not configured.');
  async function rpc(name, args) {
    let response;
    try { response = await client.rpc(name, args); }
    catch (error) { throw scoutingError(error); }
    if (response.error) throw scoutingError(response.error);
    return scoutingResult(response.data);
  }
  const loadWorkspace = (teamId) => rpc('load_scouting_workspace', { p_team_id: teamId });
  const saveWorkspace = async (teamId, expectedRevision, data, mutationId) => {
    validateScoutingData(data);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mutationId ?? '')) {
      throw new Error('A valid revision and save request ID are required.');
    }
    return rpc('save_scouting_workspace', {
      p_team_id: teamId, p_expected_revision: expectedRevision, p_data: data, p_mutation_id: mutationId,
    });
  };
  return { loadWorkspace, saveWorkspace, load: loadWorkspace, save: saveWorkspace };
}

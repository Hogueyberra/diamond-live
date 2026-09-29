import { describe, expect, it, vi } from 'vitest';
import { CloudConflictError, createCloudRepository } from './cloudRepository.js';
import { INITIAL_COACHING_DATA } from './coachingData.js';

const mutation = 'aabfc325-56a5-47a2-93f6-e052f4880555';
const response = { data: INITIAL_COACHING_DATA, revision: 2, updatedAt: '2026-09-30T01:00:00Z' };
const setup = (data = response, error = null) => {
  const client = { rpc: vi.fn().mockResolvedValue({ data, error }) };
  return { client, repository: createCloudRepository(client) };
};

describe('cloud repository boundary', () => {
  it('sends exact revision and stable mutation ID so a lost response can be retried', async () => {
    const { client, repository } = setup();
    expect(await repository.saveWorkspace('team', 1, INITIAL_COACHING_DATA, mutation)).toEqual(response);
    await repository.saveWorkspace('team', 1, INITIAL_COACHING_DATA, mutation);
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'save_workspace', { p_team_id: 'team', p_expected_revision: 1, p_data: INITIAL_COACHING_DATA, p_mutation_id: mutation });
  });
  it('distinguishes conflicts from network failures without acknowledging an unsaved snapshot', async () => {
    const conflict = setup(null, { code: '40001', message: 'stale' });
    await expect(conflict.repository.saveWorkspace('team', 1, INITIAL_COACHING_DATA, mutation)).rejects.toBeInstanceOf(CloudConflictError);
    const offline = setup();
    offline.client.rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(offline.repository.loadWorkspace('team')).rejects.toMatchObject({ code: 'NETWORK' });
  });
  it('rejects malformed remote data and revisions before accepting a load', async () => {
    await expect(setup({ ...response, data: { ...INITIAL_COACHING_DATA, teams: [] } }).repository.loadWorkspace('team')).rejects.toThrow();
    await expect(setup({ ...response, revision: 0 }).repository.loadWorkspace('team')).rejects.toThrow('invalid workspace');
    await expect(setup({ ...response, updatedAt: 'bad' }).repository.loadWorkspace('team')).rejects.toThrow('invalid workspace');
  });
  it('rejects malformed local records and absent mutation IDs before a network write', async () => {
    const { client, repository } = setup();
    await expect(repository.saveWorkspace('team', 1, { ...INITIAL_COACHING_DATA, teams: [] }, mutation)).rejects.toThrow();
    await expect(repository.saveWorkspace('team', 1, INITIAL_COACHING_DATA)).rejects.toThrow('request ID');
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it('keeps profile, team and invitation calls behind authenticated RPCs', async () => {
    const { client, repository } = setup([]);
    await repository.saveProfile(' Nick ');
    expect(client.rpc).toHaveBeenLastCalledWith('save_profile', { p_display_name: 'Nick' });
    await repository.createTeam({ name: ' Angels ', league: ' HVLL ', division: ' Minor B ', season: ' Fall 2026 ' });
    expect(client.rpc).toHaveBeenLastCalledWith('create_team', { p_name: 'Angels', p_league: 'HVLL', p_division: 'Minor B', p_season: 'Fall 2026' });
    await repository.joinTeam(' ABCD ');
    expect(client.rpc).toHaveBeenLastCalledWith('join_team', { p_code: 'abcd' });
    await repository.removeMember('team', 'user');
    expect(client.rpc).toHaveBeenLastCalledWith('remove_team_member', { p_team_id: 'team', p_user_id: 'user' });
  });
  it('treats denied access as a failure rather than an empty workspace', async () => {
    const { repository } = setup(null, { code: '42501', message: 'permission denied for table' });
    await expect(repository.loadWorkspace('team')).rejects.toMatchObject({ code: '42501', message: expect.stringContaining('does not have access') });
  });
});

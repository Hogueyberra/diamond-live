import { describe, expect, it, vi } from 'vitest';
import { createScoutingRepository } from './scoutingRepository.js';

const empty = () => ({ schemaVersion: 1, players: [], sessions: [], evaluations: [], goals: [] });
const mutation = 'aabfc325-56a5-47a2-93f6-e052f4880555';
const saved = { data: empty(), revision: 1, updatedAt: '2026-09-30T01:00:00Z' };
function setup(data = saved, error = null) {
  const client = { rpc: vi.fn().mockResolvedValue({ data, error }) };
  return { client, repository: createScoutingRepository(client) };
}

describe('private scouting repository', () => {
  it('accepts a new empty revision-zero workspace without inventing a save time', async () => {
    const response = { data: empty(), revision: 0, updatedAt: null };
    const { client, repository } = setup(response);
    expect(await repository.loadWorkspace('team')).toEqual(response);
    expect(client.rpc).toHaveBeenCalledWith('load_scouting_workspace', { p_team_id: 'team' });
  });
  it('sends the first revision and stable mutation ID exclusively to the scouting RPC', async () => {
    const { client, repository } = setup();
    expect(await repository.saveWorkspace('team', 0, empty(), mutation)).toEqual(saved);
    await repository.saveWorkspace('team', 0, empty(), mutation);
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'save_scouting_workspace', {
      p_team_id: 'team', p_expected_revision: 0, p_data: empty(), p_mutation_id: mutation,
    });
  });
  it('never converts denied viewer access or a conflict into an empty successful load', async () => {
    await expect(setup(null, { code: '42501' }).repository.loadWorkspace('team')).rejects.toMatchObject({ code: '42501' });
    await expect(setup(null, { code: '40001' }).repository.saveWorkspace('team', 0, empty(), mutation)).rejects.toMatchObject({ code: 'CONFLICT' });
    const { repository, client } = setup();
    client.rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(repository.loadWorkspace('team')).rejects.toMatchObject({ code: 'NETWORK' });
  });
  it('rejects invalid server snapshots before acknowledging them', async () => {
    for (const response of [
      { ...saved, revision: -1 }, { ...saved, revision: 0 }, { ...saved, updatedAt: null },
      { ...saved, data: { ...empty(), evaluations: [{ id: 'forged' }] } },
    ]) await expect(setup(response).repository.loadWorkspace('team')).rejects.toThrow();
  });
  it('rejects invalid local data and save identifiers without sending them', async () => {
    const { client, repository } = setup();
    await expect(repository.saveWorkspace('team', 0, { ...empty(), players: [{}] }, mutation)).rejects.toThrow();
    await expect(repository.saveWorkspace('team', -1, empty(), mutation)).rejects.toThrow();
    await expect(repository.saveWorkspace('team', 0, empty(), undefined)).rejects.toThrow();
    expect(client.rpc).not.toHaveBeenCalled();
  });
});

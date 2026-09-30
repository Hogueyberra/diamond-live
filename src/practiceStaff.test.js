import { describe, expect, it, vi } from 'vitest';
import { listPracticeStaff } from './practiceStaff.js';

const teamId = '10000000-0000-4000-8000-000000000001';
const manager = { userId: '20000000-0000-4000-8000-000000000001', displayName: 'Manager', role: 'owner' };
const coach = { userId: '20000000-0000-4000-8000-000000000002', displayName: 'Assistant', role: 'coach' };

describe('practice staff directory', () => {
  it('uses the signed-in team RPC and returns only staff identity and role', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: [manager, coach] }) };
    expect(await listPracticeStaff(client, teamId)).toEqual([manager, coach]);
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith('list_practice_staff', { p_team_id: teamId });
  });
  it('rejects emails, viewers, missing names, and duplicate staff rather than accepting unsafe assignment choices', async () => {
    for (const data of [[{ ...coach, email: 'private@example.test' }], [{ ...coach, role: 'viewer' }], [{ ...coach, displayName: '' }], [coach, coach], null]) {
      const client = { rpc: vi.fn().mockResolvedValue({ data }) };
      await expect(listPracticeStaff(client, teamId)).rejects.toThrow('could not be verified');
    }
  });
  it('fails clearly after access removal and does not turn errors into an empty staff list', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ error: { code: '42501' } }) };
    await expect(listPracticeStaff(client, teamId)).rejects.toMatchObject({ code: '42501', message: expect.stringContaining('cannot view') });
    client.rpc.mockRejectedValue(new Error('network'));
    await expect(listPracticeStaff(client, teamId)).rejects.toThrow('Check your connection');
  });
});

// @vitest-environment jsdom
import { useEffect, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceGateway } from './WorkspaceGateway.jsx';
import { INITIAL_COACHING_DATA } from './coachingData.js';

const mocks = vi.hoisted(() => ({
  createRepository: vi.fn(), load: vi.fn(), save: vi.fn(), scout: vi.fn(), client: {},
}));
vi.mock('./supabaseClient.js', () => ({ supabase: mocks.client }));
vi.mock('./cloudGuidelines.js', () => ({ createCloudGuidelinesRepository: vi.fn(() => ({ scopeKey: 'guidelines-test' })) }));
vi.mock('./scoutingRepository.js', () => ({ createScoutingRepository: mocks.createRepository }));
vi.mock('./ScoutingWorkspace.jsx', () => ({ ScoutingWorkspace: (props) => {
  mocks.scout(props);
  useEffect(() => () => props.onPendingChange?.(false), [props.onPendingChange]);
  return <section aria-label="Scouting test boundary"><p>{props.repository ? 'Shared scouting' : 'Scouting demo'}</p><button onClick={() => props.onPendingChange(true)}>Start pending scouting</button><button onClick={() => props.onPendingChange(false)}>Resolve pending scouting</button></section>;
} }));
vi.mock('./AccountPanel.jsx', () => ({ AccountPanel: ({ account }) => {
  const [error, setError] = useState('');
  const run = async (action) => { try { await action(); setError(''); } catch (failure) { setError(failure.message); } };
  return <section aria-label="Account test boundary">{error && <p role="alert">{error}</p>}<button onClick={() => run(() => account.setActiveTeamId('other-team'))}>Switch test team</button><button onClick={() => run(() => account.signOut())}>Sign out test account</button><button onClick={() => run(() => account.createTeam({ name: 'New team' }))}>Create test team</button><button onClick={() => run(() => account.joinTeam('code'))}>Join test team</button></section>;
} }));

const team = (role = 'owner', id = 'team-one') => ({ id, name: 'Test Angels', league: 'HVLL', division: 'Minor B', season: 'Fall 2026', seasonId: 'season-one', role });
function account(role = 'owner', id = 'team-one') {
  return { user: { id: 'coach-one' }, profile: { display_name: 'Test Coach' }, teams: [team(role, id)], activeTeamId: id,
    loading: false, error: '', reload: vi.fn().mockResolvedValue(undefined), setActiveTeamId: vi.fn(),
    createTeam: vi.fn(), joinTeam: vi.fn(), signOut: vi.fn() };
}
function shared(accountValue) {
  return { mode: 'cloud', status: 'synced', pending: false, readOnly: accountValue.teams[0]?.role === 'viewer',
    data: { schemaVersion: 1, teams: accountValue.teams, events: [], observations: [], activities: [] },
    setData: vi.fn(), retrySave: vi.fn(), exportData: vi.fn(), loadLatest: vi.fn() };
}
const localStore = { data: INITIAL_COACHING_DATA, setData: vi.fn() };
const latestScouting = () => mocks.scout.mock.calls.at(-1)[0];
const app = (current, sharedValue = shared(current)) => <MemoryRouter><WorkspaceGateway account={current} shared={sharedValue} localStore={localStore} /></MemoryRouter>;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue({ data: {}, revision: 0, updatedAt: null });
  mocks.save.mockResolvedValue({ data: {}, revision: 1, updatedAt: '2026-09-30T01:00:00Z' });
  mocks.createRepository.mockReturnValue({ loadWorkspace: mocks.load, saveWorkspace: mocks.save });
});
afterEach(cleanup);

describe('scouting account and navigation boundary', () => {
  it('never constructs a scouting repository or renders a demo for a signed-in Viewer', () => {
    render(app(account('viewer')));
    expect(screen.queryByRole('button', { name: 'Scouting', exact: true })).toBeNull();
    expect(mocks.createRepository).not.toHaveBeenCalled();
    expect(mocks.scout).not.toHaveBeenCalled();
    expect(screen.queryByText('Scouting demo')).toBeNull();
  });

  it.each(['owner', 'coach'])('binds %s scouting reads and writes to the active team', async (role) => {
    const current = account(role);
    render(app(current));
    fireEvent.click(screen.getByRole('button', { name: 'Scouting', exact: true }));
    await screen.findByText('Shared scouting');
    const props = latestScouting();
    expect(mocks.createRepository).toHaveBeenCalledWith(mocks.client);
    expect(props.authorId).toBe(current.user.id);
    expect(props.team.id).toBe('team-one');
    await props.repository.load();
    await props.repository.save(7, { revisionFixture: true }, 'mutation-one');
    expect(mocks.load).toHaveBeenCalledWith('team-one');
    expect(mocks.save).toHaveBeenCalledWith('team-one', 7, { revisionFixture: true }, 'mutation-one');
  });

  it('remounts private scouting for a different account/team and removes it after Viewer downgrade', async () => {
    const first = account(); const { rerender } = render(app(first));
    fireEvent.click(screen.getByRole('button', { name: 'Scouting', exact: true })); await screen.findByText('Shared scouting');
    const oldRepository = latestScouting().repository;
    const second = { ...account('coach', 'team-two'), user: { id: 'coach-two' } };
    rerender(app(second));
    expect(screen.queryByRole('region', { name: 'Scouting test boundary' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Scouting', exact: true })); await screen.findByText('Shared scouting');
    expect(latestScouting().authorId).toBe('coach-two');
    expect(latestScouting().repository).not.toBe(oldRepository);
    await latestScouting().repository.load(); expect(mocks.load).toHaveBeenLastCalledWith('team-two');
    const downgraded = { ...second, teams: [team('viewer', 'team-two')] };
    mocks.createRepository.mockClear(); rerender(app(downgraded));
    expect(screen.queryByRole('button', { name: 'Scouting', exact: true })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Scouting test boundary' })).toBeNull();
    expect(mocks.createRepository).not.toHaveBeenCalled();
  });

  it('blocks account/team mutations while scouting is pending, then permits them after resolution', async () => {
    const current = account(); render(app(current));
    fireEvent.click(screen.getByRole('button', { name: 'Scouting', exact: true })); await screen.findByText('Shared scouting');
    fireEvent.click(screen.getByRole('button', { name: 'Start pending scouting' }));
    fireEvent.click(screen.getByRole('button', { name: 'Test Coach' }));
    for (const label of ['Switch test team', 'Sign out test account', 'Create test team', 'Join test team']) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      expect((await screen.findByRole('alert')).textContent).toContain('unsaved team or scouting changes');
    }
    expect(current.setActiveTeamId).not.toHaveBeenCalled(); expect(current.signOut).not.toHaveBeenCalled();
    expect(current.createTeam).not.toHaveBeenCalled(); expect(current.joinTeam).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Resolve pending scouting' }));
    fireEvent.click(screen.getByRole('button', { name: 'Switch test team' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out test account' }));
    expect(current.setActiveTeamId).toHaveBeenCalledWith('other-team'); expect(current.signOut).toHaveBeenCalledTimes(1);
  });

  it('offers the explicitly local demo only while signed out', async () => {
    const signedOut = { ...account(), user: null, profile: null, teams: [], activeTeamId: null };
    render(app(signedOut));
    fireEvent.click(screen.getByRole('button', { name: 'Scouting', exact: true })); await screen.findByText('Scouting demo');
    expect(mocks.createRepository).not.toHaveBeenCalled(); expect(latestScouting().repository).toBeNull();
    expect(latestScouting().authorId).toBeUndefined();
  });
});

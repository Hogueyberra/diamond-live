// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  listener: null,
  auth: { onAuthStateChange: vi.fn(), getSession: vi.fn(), signInWithOtp: vi.fn(), verifyOtp: vi.fn(), signOut: vi.fn() },
  repository: { getProfile: vi.fn(), listTeams: vi.fn(), saveProfile: vi.fn(), createTeam: vi.fn(), joinTeam: vi.fn(), createInvite: vi.fn(), listMembers: vi.fn(), removeMember: vi.fn(), listInvites: vi.fn(), revokeInvite: vi.fn(), loadWorkspace: vi.fn(), saveWorkspace: vi.fn() },
  unsubscribe: vi.fn(),
}));
vi.mock('./supabaseClient.js', () => ({ cloudConfigured: true, configError: '', supabase: { auth: mock.auth } }));
vi.mock('./cloudRepository.js', () => ({ createCloudRepository: () => mock.repository }));
import { useAccount } from './useAccount.js';
import { useSharedWorkspace } from './useSharedWorkspace.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const session = (id) => ({ user: { id, email: `${id}@example.com` }, access_token: `test-${id}` });
const team = (id) => ({ id, name: id, role: 'coach', league: 'HVLL', division: 'Minor B', season: '2026' });
const authEvent = async (next) => act(async () => { mock.listener(next ? 'SIGNED_IN' : 'SIGNED_OUT', next); });

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(mock.repository)) fn.mockReset().mockResolvedValue(undefined);
  for (const fn of Object.values(mock.auth)) fn.mockReset();
  mock.auth.onAuthStateChange.mockImplementation((listener) => { mock.listener = listener; return { data: { subscription: { unsubscribe: mock.unsubscribe } } }; });
  mock.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mock.auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
  mock.auth.verifyOtp.mockResolvedValue({ data: {}, error: null });
  mock.auth.signOut.mockResolvedValue({ error: null });
  mock.repository.getProfile.mockResolvedValue({ display_name: 'Coach' });
  mock.repository.listTeams.mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('account identity and asynchronous responses', () => {
  it('clears prior account data and ignores its late profile/team responses', async () => {
    const oldProfile = deferred(); const oldTeams = deferred();
    mock.auth.getSession.mockResolvedValue({ data: { session: session('account-a') } });
    mock.repository.getProfile.mockReturnValueOnce(oldProfile.promise).mockResolvedValue({ display_name: 'Coach B' });
    mock.repository.listTeams.mockReturnValueOnce(oldTeams.promise).mockResolvedValue([team('b-team')]);
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.user?.id).toBe('account-a'));
    await authEvent(session('account-b'));
    await waitFor(() => expect(result.current.profile?.display_name).toBe('Coach B'));
    await act(async () => { oldProfile.resolve({ display_name: 'Private A profile' }); oldTeams.resolve([team('private-a-team')]); });
    expect(result.current.user.id).toBe('account-b');
    expect(result.current.profile.display_name).toBe('Coach B');
    expect(result.current.teams.map((item) => item.id)).toEqual(['b-team']);
    expect(result.current.activeTeamId).toBe('b-team');
  });

  it('does not let the initial session snapshot replace a newer auth event', async () => {
    const initial = deferred(); mock.auth.getSession.mockReturnValue(initial.promise);
    const { result } = renderHook(() => useAccount());
    await authEvent(session('new-account'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { initial.resolve({ data: { session: session('old-account') } }); });
    expect(result.current.user.id).toBe('new-account');
    expect(result.current.error).toBe('');
  });

  it('does not report a stale initial-session error after a newer successful sign-in', async () => {
    const initial = deferred(); mock.auth.getSession.mockReturnValue(initial.promise);
    mock.repository.listTeams.mockResolvedValue([team('current-team')]);
    const { result } = renderHook(() => useAccount());
    await authEvent(session('current-account'));
    await waitFor(() => expect(result.current.activeTeamId).toBe('current-team'));
    await act(async () => { initial.reject(new Error('Old initialization failed')); });
    expect(result.current.user.id).toBe('current-account');
    expect(result.current.error).toBe('');
    expect(result.current.loading).toBe(false);
  });

  it('clears private account state on sign-out and refuses unavailable team selection', async () => {
    mock.auth.getSession.mockResolvedValue({ data: { session: session('account-a') } });
    mock.repository.listTeams.mockResolvedValue([team('a-team')]);
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.activeTeamId).toBe('a-team'));
    expect(() => result.current.setActiveTeamId('foreign-team')).toThrow('no longer available');
    await authEvent(null);
    expect(result.current.user).toBeNull(); expect(result.current.profile).toBeNull();
    expect(result.current.teams).toEqual([]); expect(result.current.activeTeamId).toBeNull();
    expect(() => result.current.createInvite('coach')).toThrow('Sign in');
  });

  it('passes email OTP credentials to authentication without using passwords', async () => {
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.requestCode(' coach@example.com '); await result.current.verifyCode(' coach@example.com ', ' 12345678 '); });
    expect(mock.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'coach@example.com', options: { shouldCreateUser: true } });
    expect(mock.auth.verifyOtp).toHaveBeenCalledWith({ email: 'coach@example.com', token: '12345678', type: 'email' });
  });

  it('retains a pending team draft when a role refresh changes coach to viewer', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    mock.auth.getSession.mockResolvedValue({ data: { session: session('account-a') } });
    mock.repository.listTeams.mockResolvedValue([team('a-team')]);
    mock.repository.loadWorkspace.mockResolvedValue({ revision: 1, updatedAt: '2026-09-29T18:00:00Z', data: {
      schemaVersion: 1, teams: [{ id: 'a-team', name: 'Angels', league: 'HVLL', division: 'Minor B', seasonId: 'season-1', season: '2026' }], events: [], observations: [], activities: [],
    } });
    const { result } = renderHook(() => {
      const account = useAccount();
      const activeTeam = account.teams.find((item) => item.id === account.activeTeamId);
      const shared = useSharedWorkspace(account.repository, activeTeam, account.user?.id);
      return { account, shared };
    });
    await waitFor(() => expect(result.current.shared.data?.teams[0].id).toBe('a-team'));
    act(() => result.current.shared.setData((current) => ({ ...current, observations: [{ id: 'draft', title: 'Keep this draft', note: 'Focus on throwing.', author: 'Coach', source: 'Coach observation', createdAt: '2026-09-29T18:00:00Z', status: 'open', teamId: 'a-team', seasonId: 'season-1' }] })));
    expect(result.current.shared.pending).toBe(true);
    mock.repository.listTeams.mockResolvedValue([{ ...team('a-team'), role: 'viewer' }]);
    await act(async () => { await result.current.account.reload(); });
    expect(result.current.shared.readOnly).toBe(true);
    expect(result.current.shared.pending).toBe(true);
    expect(result.current.shared.data.observations[0].id).toBe('draft');
    expect(mock.repository.saveWorkspace).not.toHaveBeenCalled();
  });
});

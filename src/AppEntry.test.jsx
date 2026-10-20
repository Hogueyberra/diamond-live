// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App.jsx';

const mocks = vi.hoisted(() => ({ account: null, local: null, shared: null, workspace: vi.fn(), clubhouse: vi.fn(), sharedHook: vi.fn(), guidelines: vi.fn(), scouting: vi.fn(), client: {} }));
vi.mock('./useAccount.js', () => ({ useAccount: () => mocks.account }));
vi.mock('./coachingStore.js', () => ({ useCoachingStore: () => mocks.local }));
vi.mock('./useSharedWorkspace.js', () => ({ useSharedWorkspace: (...args) => { mocks.sharedHook(...args); return mocks.shared; } }));
vi.mock('./supabaseClient.js', () => ({ supabase: mocks.client }));
vi.mock('./cloudGuidelines.js', () => ({ createCloudGuidelinesRepository: mocks.guidelines }));
vi.mock('./scoutingRepository.js', () => ({ createScoutingRepository: mocks.scouting }));
vi.mock('./prototype/Prototype.jsx', () => ({ default: (props) => { mocks.clubhouse(props); return <main><h1>New clubhouse</h1></main>; } }));
vi.mock('./CoachingWorkspace.jsx', () => ({ CoachingWorkspace: (props) => { mocks.workspace(props); return <main><h1>Private team records</h1></main>; } }));
const team = { id: 'private-team', name: 'Private Angels', role: 'coach' };
const guest = () => ({ configured: true, user: null, loading: false, teams: [], activeTeamId: null, profile: null, error: '' });
const signedIn = () => ({ ...guest(), user: { id: 'private-coach' }, profile: { display_name: 'Coach' }, teams: [team], activeTeamId: team.id });
function Location() { const location = useLocation(); return <><output aria-label="Current route">{location.pathname}</output><output aria-label="Query and fragment">{location.search}{location.hash}</output></>; }
const app = (path = '/') => <MemoryRouter initialEntries={[path]}><Location /><AppRoutes /></MemoryRouter>;
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  mocks.account = guest();
  mocks.local = { data: { source: 'local sample' }, setData: vi.fn() };
  mocks.shared = { mode: 'cloud', status: 'synced', data: { source: 'private team' }, setData: vi.fn(), pending: false };
  mocks.guidelines.mockReturnValue({ scopeKey: 'private-team' });
  mocks.scouting.mockReturnValue({ loadWorkspace: vi.fn(), saveWorkspace: vi.fn() });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('clubhouse entry', () => {
  it.each(['/', '/prototype', '/preview'])('opens the new demo at %s without loading or writing private team records', async (path) => {
    render(app(path));
    await screen.findByRole('heading', { name: 'New clubhouse' });
    expect(mocks.workspace).not.toHaveBeenCalled();
    expect(mocks.sharedHook).not.toHaveBeenCalled();
    expect(mocks.guidelines).not.toHaveBeenCalled();
    expect(mocks.shared.setData).not.toHaveBeenCalled();
    expect(mocks.local.setData).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current route').textContent).toBe(path === '/preview' ? '/' : path);
  });
  it('stays in the clubhouse when an account signs in and passes along the real access context', async () => {
    const view = render(app());
    await screen.findByRole('heading', { name: 'New clubhouse' });
    mocks.account = signedIn(); view.rerender(app());
    expect(mocks.clubhouse.mock.calls.at(-1)[0].account).toBe(mocks.account);
    expect(mocks.workspace).not.toHaveBeenCalled();
    expect(mocks.sharedHook).not.toHaveBeenCalled();
    expect(mocks.shared.setData).not.toHaveBeenCalled();
  });
  it('keeps existing shared records accessible only at their explicit route', () => {
    mocks.account = signedIn(); render(app('/workspace'));
    expect(screen.getByRole('heading', { name: 'Private team records' })).toBeTruthy();
    expect(mocks.workspace.mock.calls.at(-1)[0].store).toBe(mocks.shared);
    expect(mocks.guidelines).toHaveBeenCalledWith(expect.objectContaining({ teamId: team.id, userId: 'private-coach' }));
    expect(mocks.local.setData).not.toHaveBeenCalled();
    expect(mocks.shared.setData).not.toHaveBeenCalled();
  });
  it.each(['/diamond-live/', '/diamond-live/preview', '/preview'])('keeps bookmarked query and fragment state while opening the new home from %s', async (path) => {
    render(app(`${path}?view=players#practice`));
    await screen.findByRole('heading', { name: 'New clubhouse' });
    expect(screen.getByLabelText('Current route').textContent).toBe('/');
    expect(screen.getByLabelText('Query and fragment').textContent).toBe('?view=players#practice');
    expect(mocks.sharedHook).not.toHaveBeenCalled();
  });
});

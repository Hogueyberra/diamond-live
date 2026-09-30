// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App.jsx';

const mocks = vi.hoisted(() => ({ account: null, local: null, shared: null, workspace: vi.fn(), guidelines: vi.fn(), scouting: vi.fn(), client: {} }));
vi.mock('./useAccount.js', () => ({ useAccount: () => mocks.account }));
vi.mock('./coachingStore.js', () => ({ useCoachingStore: () => mocks.local }));
vi.mock('./useSharedWorkspace.js', () => ({ useSharedWorkspace: () => mocks.shared }));
vi.mock('./supabaseClient.js', () => ({ supabase: mocks.client }));
vi.mock('./cloudGuidelines.js', () => ({ createCloudGuidelinesRepository: mocks.guidelines }));
vi.mock('./scoutingRepository.js', () => ({ createScoutingRepository: mocks.scouting }));
vi.mock('./HomePage.jsx', () => ({ HomePage: ({ onSignIn, onExploreDemo }) => <main><h1>Public Diamond Live homepage</h1><button onClick={onSignIn}>Sign in</button><button onClick={onExploreDemo}>Explore the demo</button></main> }));
vi.mock('./CoachingWorkspace.jsx', () => ({ CoachingWorkspace: (props) => {
  mocks.workspace(props);
  return <main><h1>{props.store.mode === 'cloud' ? 'Private team workspace' : 'Local demo workspace'}</h1>{props.accountButton}{props.syncBar}</main>;
} }));

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
const team = { id: 'private-team', name: 'Private Angels', role: 'coach' };
function guest(overrides = {}) {
  return { configured: true, user: null, loading: false, teams: [], activeTeamId: null, profile: null, error: '',
    requestCode: vi.fn().mockResolvedValue(undefined), verifyCode: vi.fn().mockResolvedValue(undefined), ...overrides };
}
function signedIn(overrides = {}) {
  return guest({ user: { id: 'private-coach', email: 'coach@example.com' }, profile: { display_name: 'Coach' }, teams: [team], activeTeamId: team.id, ...overrides });
}
function Location() { return <output aria-label="Current route">{useLocation().pathname}</output>; }
const app = (path = '/') => <MemoryRouter initialEntries={[path]}><Location /><AppRoutes /></MemoryRouter>;

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  mocks.account = guest();
  mocks.local = { data: { source: 'local sample' }, setData: vi.fn() };
  mocks.shared = { mode: 'cloud', status: 'synced', data: { source: 'private team' }, setData: vi.fn(), pending: false };
  mocks.guidelines.mockReturnValue({ scopeKey: 'private-team' });
  mocks.scouting.mockReturnValue({ loadWorkspace: vi.fn(), saveWorkspace: vi.fn() });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); localStorage.clear(); vi.restoreAllMocks();
  for (const [name, descriptor] of [['showModal', originalShowModal], ['close', originalClose]]) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else delete HTMLDialogElement.prototype[name];
  }
});

describe('public homepage and private workspace entry', () => {
  it('shows guests the homepage without mounting a workspace or touching a cloud repository', () => {
    render(app());
    expect(screen.getByRole('heading', { name: 'Public Diamond Live homepage' })).toBeTruthy();
    expect(mocks.workspace).not.toHaveBeenCalled(); expect(mocks.guidelines).not.toHaveBeenCalled(); expect(mocks.scouting).not.toHaveBeenCalled();
    expect(mocks.local.setData).not.toHaveBeenCalled(); expect(mocks.shared.setData).not.toHaveBeenCalled();
    expect(mocks.account.requestCode).not.toHaveBeenCalled();
  });

  it('opens the existing email sign-in flow from the homepage CTA', async () => {
    render(app()); fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }));
    expect(screen.getByRole('dialog', { name: 'Sign in to Diamond Live' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'coach@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
    await screen.findByLabelText('Email sign-in code');
    expect(mocks.account.requestCode).toHaveBeenCalledWith('coach@example.com');
    expect(mocks.workspace).not.toHaveBeenCalled(); expect(mocks.shared.setData).not.toHaveBeenCalled();
  });

  it('only opens the local demo after an explicit visit, with Home and Sign in available', () => {
    render(app()); fireEvent.click(screen.getByRole('button', { name: 'Explore the demo' }));
    expect(screen.getByLabelText('Current route').textContent).toBe('/preview');
    expect(screen.getByRole('heading', { name: 'Local demo workspace' })).toBeTruthy();
    const props = mocks.workspace.mock.calls.at(-1)[0];
    expect(props.store).toBe(mocks.local); expect(props.guidelinesRepository).toBeNull(); expect(props.scoutingRepository).toBeNull(); expect(props.authorId).toBeUndefined();
    expect(mocks.guidelines).not.toHaveBeenCalled(); expect(mocks.scouting).not.toHaveBeenCalled(); expect(mocks.shared.setData).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign in', exact: true })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Home', exact: true }));
    expect(screen.getByLabelText('Current route').textContent).toBe('/');
    expect(screen.getByRole('heading', { name: 'Public Diamond Live homepage' })).toBeTruthy();
  });

  it.each(['/', '/preview'])('waits for account restoration at %s before showing marketing or demo data', (path) => {
    mocks.account = guest({ loading: true }); const { rerender } = render(app(path));
    expect(screen.getByText('Opening Diamond Live…').getAttribute('role')).toBe('status');
    expect(screen.queryByRole('heading')).toBeNull(); expect(mocks.workspace).not.toHaveBeenCalled();
    mocks.account = signedIn(); rerender(app(path));
    expect(screen.getByRole('heading', { name: 'Private team workspace' })).toBeTruthy();
    expect(screen.getByLabelText('Current route').textContent).toBe('/');
    expect(mocks.workspace.mock.calls.every(([props]) => props.store === mocks.shared)).toBe(true);
  });

  it('preserves the existing signed-in root workspace without mounting or uploading demo data', () => {
    mocks.account = signedIn(); render(app());
    expect(screen.getByRole('heading', { name: 'Private team workspace' })).toBeTruthy();
    const props = mocks.workspace.mock.calls.at(-1)[0];
    expect(props.store).toBe(mocks.shared); expect(props.authorId).toBe('private-coach');
    expect(mocks.guidelines).toHaveBeenCalledWith(expect.objectContaining({ teamId: 'private-team', userId: 'private-coach' }));
    expect(mocks.local.setData).not.toHaveBeenCalled(); expect(mocks.shared.setData).not.toHaveBeenCalled();
  });

  it('leaves the preview for the private root after sign-in, without copying demo data', () => {
    const { rerender } = render(app('/preview'));
    expect(screen.getByRole('heading', { name: 'Local demo workspace' })).toBeTruthy();
    mocks.workspace.mockClear(); mocks.account = signedIn(); rerender(app('/preview'));
    expect(screen.getByLabelText('Current route').textContent).toBe('/');
    expect(screen.getByRole('heading', { name: 'Private team workspace' })).toBeTruthy();
    expect(mocks.workspace.mock.calls.every(([props]) => props.store === mocks.shared)).toBe(true);
    expect(mocks.shared.setData).not.toHaveBeenCalled();
  });
});

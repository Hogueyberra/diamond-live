// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Prototype from './Prototype.jsx';
import { createEmptyScoutingData } from '../scouting.js';
import { createAssistantPractice } from '../assistantPractice.js';

const mocks = vi.hoisted(() => ({ shared: null, scouting: null, sharedHook: vi.fn(), scoutingHook: vi.fn(), scoutingRepository: vi.fn(), ask: vi.fn(), guidelines: vi.fn() }));
vi.mock('../useSharedWorkspace.js', () => ({ useSharedWorkspace: (...args) => { mocks.sharedHook(...args); return mocks.shared; } }));
vi.mock('../useScouting.js', () => ({ useScouting: (args) => { mocks.scoutingHook(args); return mocks.scouting; } }));
vi.mock('../supabaseClient.js', () => ({ supabase: {} }));
vi.mock('../scoutingRepository.js', () => ({ createScoutingRepository: mocks.scoutingRepository }));
vi.mock('../cloudGuidelines.js', () => ({ createCloudGuidelinesRepository: mocks.guidelines }));
vi.mock('../assistantClient.js', () => ({ askAssistant: mocks.ask }));
vi.mock('../practiceStaff.js', () => ({ listPracticeStaff: async () => [] }));
const team = { id: '11111111-1111-4111-8111-111111111111', seasonId: '22222222-2222-4222-8222-222222222222', name: 'Connected team', league: 'HVLL', division: 'Minor B', season: 'Fall 2026', role: 'owner' };
const user = { id: '33333333-3333-4333-8333-333333333333' };
const account = () => ({ user, teams: [team, { ...team, id: 'other-team', name: 'Other team' }], activeTeamId: team.id, profile: { display_name: 'Test Coach' }, repository: {}, loading: false, error: '', reload: vi.fn(), setActiveTeamId: vi.fn(), signOut: vi.fn() });
const player = { id: '44444444-4444-4444-8444-444444444444', name: 'Actual roster child', age: 8, number: '7', positions: '', notes: '', archived: false, draftStatus: 'available' };
const app = (value, path = '/') => <MemoryRouter initialEntries={[path]}><Prototype account={value} /></MemoryRouter>;
const methods = ['showModal', 'close'].map((name) => [name, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name)]);
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  mocks.shared = { mode: 'cloud', data: { schemaVersion: 1, teams: [{ ...team }], events: [], activities: [], observations: [] }, status: 'synced', revision: 7, pending: false, readOnly: false, save: vi.fn(async (update, revision) => { expect(revision).toBe(7); mocks.shared.data = update(mocks.shared.data); mocks.shared.revision = 8; return { revision: 8 }; }), retrySave: vi.fn(), loadLatest: vi.fn(), exportData: vi.fn() };
  mocks.scouting = { data: { ...createEmptyScoutingData(), players: [player] }, status: 'synced', revision: 3, pending: false, loading: false, readOnly: false, save: vi.fn(), refresh: vi.fn(), retrySave: vi.fn() };
  mocks.scoutingRepository.mockReturnValue({ loadWorkspace: vi.fn(), saveWorkspace: vi.fn() });
  mocks.guidelines.mockReturnValue({ list: async () => [], scopeKey: team.id });
  mocks.ask.mockImplementation(async (input) => ({ plan: createAssistantPractice(input.practice), method: 'guided-practice', elapsedMs: 5 }));
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  for (const [name, descriptor] of methods) { if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor); else delete HTMLDialogElement.prototype[name]; }
});
it('loads the signed-in team roster through the coach-only repository and never substitutes sample players', () => {
  const value = account(); render(app(value, '/?view=players'));
  expect(screen.getByText('Actual roster child')).toBeTruthy();
  expect(screen.queryByText(/Mason Brooks/)).toBeNull();
  expect(mocks.sharedHook).toHaveBeenCalledWith(value.repository, team, user.id);
  expect(mocks.scoutingHook).toHaveBeenCalledWith(expect.objectContaining({ demo: false, authorId: user.id, scopeKey: team.id, repository: expect.any(Object) }));
  expect(mocks.scouting.save).not.toHaveBeenCalled();
  expect(mocks.shared.save).not.toHaveBeenCalled();
});
it.each(['loading', 'error', 'empty'])('shows real roster %s state without falling back to the demo', (state) => {
  mocks.scouting = { ...mocks.scouting, data: state === 'empty' ? createEmptyScoutingData() : null, loading: state === 'loading', error: state === 'error' ? 'Roster service unavailable' : '' };
  render(app(account(), '/?view=players'));
  expect(screen.queryByText(/Mason Brooks/)).toBeNull();
  if (state === 'error') expect(screen.getByRole('alert')).toBeTruthy();
  if (state === 'empty') expect(screen.getByRole('button', { name: 'Import roster' })).toBeTruthy();
  if (state === 'loading') expect(screen.getByText('Opening your roster…', { selector: 'p' })).toBeTruthy();
});
it('does not load private scouting or expose the assistant to viewers, including direct player links', () => {
  const value = account(); value.teams = [{ ...team, role: 'viewer' }];
  render(app(value, '/?view=players'));
  expect(mocks.scoutingRepository).not.toHaveBeenCalled();
  expect(mocks.scoutingHook).toHaveBeenCalledWith(expect.objectContaining({ repository: null, demo: false, authorId: null, scopeKey: null }));
  expect(screen.queryByText('Actual roster child')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Coach’s assistant' })).toBeNull();
  expect(screen.getByText(/Player records are available/)).toBeTruthy();
});
it('keeps sample previews explicit for signed-in accounts', () => {
  render(<MemoryRouter><Prototype account={account()} demoPreview /></MemoryRouter>);
  expect(screen.getByText('Demo clubhouse')).toBeTruthy();
  expect(mocks.sharedHook).not.toHaveBeenCalled();
  expect(mocks.scoutingHook).not.toHaveBeenCalled();
});
it('blocks team changes while player changes are unsynced', () => {
  mocks.scouting.pending = true;
  const value = account(); render(app(value));
  fireEvent.change(screen.getByLabelText('Active team'), { target: { value: 'other-team' } });
  expect(value.setActiveTeamId).not.toHaveBeenCalled();
  expect(screen.getByText(/Finish or discard your open form/)).toBeTruthy();
});
it('requires owner review before saving a generated draft to the actual team calendar', async () => {
  render(app(account()));
  fireEvent.click(screen.getByRole('button', { name: 'Plan with the assistant' }));
  fireEvent.click(screen.getByRole('button', { name: 'Build practice plan' }));
  await screen.findByRole('button', { name: 'Review and save to team calendar' });
  expect(mocks.shared.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Review and save to team calendar' }));
  expect(mocks.shared.save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Practice location'), { target: { value: 'Home field' } });
  fireEvent.click(screen.getByRole('button', { name: 'Approve and save draft' }));
  await waitFor(() => expect(mocks.shared.save).toHaveBeenCalledOnce());
  await screen.findByText(/Practice saved as a draft/);
  expect(mocks.shared.data.events[0]).toMatchObject({ teamId: team.id, seasonId: team.seasonId, planStatus: 'draft', location: 'Home field' });
  expect(mocks.shared.data.activities).toHaveLength(3);
  expect(mocks.shared.data.events[0].notes).toContain('At home with a parent');
});
it('lets coaches generate plans while reserving shared plan approval for the owner', async () => {
  const value = account(); value.teams = [{ ...team, role: 'coach' }]; render(app(value));
  fireEvent.click(screen.getByRole('button', { name: 'Plan with the assistant' }));
  fireEvent.click(screen.getByRole('button', { name: 'Build practice plan' }));
  await screen.findByRole('button', { name: 'Copy parent instructions' });
  expect(screen.queryByRole('button', { name: 'Review and save to team calendar' })).toBeNull();
  expect(mocks.shared.save).not.toHaveBeenCalled();
});
it('closes private answers and changes repository scope immediately when switching teams', async () => {
  const value = account(); const view = render(app(value));
  fireEvent.click(screen.getByRole('button', { name: 'Plan with the assistant' }));
  fireEvent.click(screen.getByRole('button', { name: 'Build practice plan' }));
  await screen.findByRole('button', { name: 'Copy parent instructions' });
  const other = { ...team, id: 'other-team', name: 'Other team' };
  mocks.shared.data = { ...mocks.shared.data, teams: [other] };
  mocks.scouting.data = createEmptyScoutingData();
  view.rerender(app({ ...value, activeTeamId: other.id }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(mocks.scoutingHook.mock.calls.at(-1)[0].scopeKey).toBe(other.id);
  expect(screen.getByRole('heading', { name: '0 active players' })).toBeTruthy();
});

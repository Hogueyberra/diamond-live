// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CoachingWorkspace } from './CoachingWorkspace.jsx';
import { useSharedWorkspace } from './useSharedWorkspace.js';
import { createEmptyScoutingData, DEMO_SCOUTING_AUTHOR_ID } from './scouting.js';

vi.mock('./supabaseClient.js', () => ({ supabase: null, cloudConfigured: false, configError: null }));
vi.mock('./practiceStaff.js', () => ({ listPracticeStaff: vi.fn(async () => [{ userId: '00000000-0000-4000-8000-000000000101', displayName: 'Test Coach', role: 'owner' }]) }));

const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  for (const [name, descriptor] of [['showModal', originalShowModal], ['close', originalClose]]) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor); else delete HTMLDialogElement.prototype[name];
  }
});

const team = { id: '00000000-0000-4000-8000-000000000010', name: 'Pilot Angels', league: 'HVLL', division: 'Minor B', seasonId: 'spring-2027', season: 'Spring 2027' };
function fakeStore(data, loadName, saveName, scoped = false) {
  let record = { data, revision: 1, updatedAt: '2026-09-30T08:00:00Z' }; const mutations = new Set();
  return {
    [loadName]: vi.fn(async () => structuredClone(record)),
    [saveName]: vi.fn(async (...args) => {
      const [revision, next, mutation] = scoped ? args.slice(1) : args;
      if (mutations.has(mutation)) return structuredClone(record);
      if (revision !== record.revision) throw Object.assign(new Error('Another coach saved first.'), { code: 'CONFLICT' });
      record = { data: structuredClone(next), revision: revision + 1, updatedAt: '2026-09-30T08:01:00Z' }; mutations.add(mutation); return structuredClone(record);
    }),
    inspect: () => structuredClone(record),
  };
}
function repositories() {
  return {
    workspace: fakeStore({ schemaVersion: 1, teams: [team], events: [], observations: [], activities: [] }, 'loadWorkspace', 'saveWorkspace', true),
    scouting: fakeStore(createEmptyScoutingData(), 'load', 'save'),
  };
}
function Harness({ repositories: repos, viewer = false }) {
  const membership = { ...team, role: viewer ? 'viewer' : 'owner' };
  const store = useSharedWorkspace(repos.workspace, membership, DEMO_SCOUTING_AUTHOR_ID);
  if (!store.data) return <p>Opening pilot team…</p>;
  return <MemoryRouter><Routes><Route path="/" element={<CoachingWorkspace store={store} scoutingRepository={repos.scouting} canScout={!viewer} teamRole={membership.role} authorId={DEMO_SCOUTING_AUTHOR_ID} authorName="Test Coach" />} /><Route path="/demo" element={<p>Scoring demo route</p>} /></Routes></MemoryRouter>;
}

it('guides a new coach through roster import, the same player’s scouting profile, and schedule import', async () => {
  const repos = repositories(); render(<Harness repositories={repos} />);
  const setup = await screen.findByRole('region', { name: 'Team setup' });
  expect(within(setup).getByText('0/4 ready')).toBeTruthy();
  fireEvent.click(within(setup).getByRole('button', { name: /Add \/ import players/ }));
  expect(screen.getByRole('heading', { name: 'Start with your players.' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Import roster' }));
  fireEvent.change(screen.getByLabelText('Player names or roster data'), { target: { value: 'Name,Number,Age\nJordan Pilot,17,9' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review import' }));
  expect(repos.scouting.save).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Import 1 players' })); });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  const importedId = repos.scouting.inspect().data.players[0].id;
  fireEvent.click(screen.getByRole('button', { name: /Assess skills/ }));
  const scouting = await screen.findByRole('region', { name: 'Scouting and player development' }, { timeout: 3000 });
  expect(await within(scouting).findByRole('heading', { name: 'Jordan Pilot' }, { timeout: 3000 })).toBeTruthy();
  expect(within(scouting).getByText('#17 · Age 9')).toBeTruthy();
  // A shared store is supplied to Scouting; switching sections must not seed or reload a second roster.
  expect(repos.scouting.load).toHaveBeenCalledOnce();
  expect(repos.scouting.inspect().data.players).toEqual([expect.objectContaining({ id: importedId, name: 'Jordan Pilot' })]);
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Coaching workspace' })).getByRole('button', { name: 'Schedule' }));
  fireEvent.click(screen.getByRole('button', { name: 'Import schedule' }));
  fireEvent.change(screen.getByLabelText('Schedule data'), { target: { value: 'Type,Title,Date,Start Time,End Time,Location\npractice,Pilot team practice,2027-03-02,16:30,17:30,Main Field' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review import' }));
  expect(repos.workspace.saveWorkspace).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Import 1 events' })); });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(repos.workspace.inspect().data.events).toEqual([expect.objectContaining({ teamId: team.id, seasonId: team.seasonId, type: 'practice', title: 'Pilot team practice', date: '2027-03-02', startTime: '16:30', endTime: '17:30', timeZone: 'America/Los_Angeles' })]);
  expect(screen.getByRole('button', { name: 'View Pilot team practice' })).toBeTruthy();
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Coaching workspace' })).getByRole('button', { name: 'Overview' }));
  expect(within(screen.getByRole('region', { name: 'Team setup' })).getByText('2/4 ready')).toBeTruthy();
  expect(repos.scouting.inspect().data.players[0].id).toBe(importedId);
});

it('keeps roster and assessments out of the viewer interface and never loads private scouting data', async () => {
  const repos = repositories(); render(<Harness repositories={repos} viewer />);
  const nav = await screen.findByRole('navigation', { name: 'Coaching workspace' });
  expect(within(nav).queryByRole('button', { name: 'Players' })).toBeNull();
  expect(within(nav).queryByRole('button', { name: 'Scouting' })).toBeNull();
  expect(screen.queryByRole('region', { name: 'Team setup' })).toBeNull();
  expect(screen.queryByRole('button', { name: /Add \/ import players/ })).toBeNull();
  fireEvent.click(within(nav).getByRole('button', { name: 'Schedule' }));
  expect(screen.getByRole('button', { name: 'Import schedule' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Add event' }).disabled).toBe(true);
  expect(repos.scouting.load).not.toHaveBeenCalled();
  expect(repos.scouting.save).not.toHaveBeenCalled();
  expect(repos.workspace.saveWorkspace).not.toHaveBeenCalled();
});

it('blocks the scoring-demo route after a failed schedule import closes and retains the unsynced event', async () => {
  const repos = repositories();
  repos.workspace.saveWorkspace.mockRejectedValueOnce(new Error('Schedule connection unavailable.'));
  render(<Harness repositories={repos} />);
  const nav = await screen.findByRole('navigation', { name: 'Coaching workspace' });
  fireEvent.click(within(nav).getByRole('button', { name: 'Schedule' }));
  fireEvent.click(screen.getByRole('button', { name: 'Import schedule' }));
  fireEvent.change(screen.getByLabelText('Schedule data'), { target: { value: 'Type,Title,Date,Start Time,End Time,Location\npractice,Unsynced practice,2027-03-02,16:30,17:30,Main Field' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review import' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Import 1 events' })); });
  await within(screen.getByRole('dialog')).findByRole('button', { name: 'Retry saved draft' });
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: 'View Unsynced practice' })).toBeTruthy();
  expect(repos.workspace.inspect().data.events).toEqual([]);
  fireEvent.click(screen.getByRole('link', { name: 'Open Hawks scoring demo' }));
  expect(screen.queryByText('Scoring demo route')).toBeNull();
  expect(screen.getByText(/Finish open forms and resolve unsaved roster/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'View Unsynced practice' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Retry saving' })).toBeTruthy();
  expect(repos.workspace.saveWorkspace).toHaveBeenCalledOnce();
});

it('blocks the scoring-demo route after a failed roster import closes without caching private draft data', async () => {
  const privateCacheWrites = vi.spyOn(Storage.prototype, 'setItem');
  const repos = repositories();
  repos.scouting.save.mockRejectedValueOnce(new Error('Roster connection unavailable.'));
  render(<Harness repositories={repos} />);
  const setup = await screen.findByRole('region', { name: 'Team setup' });
  fireEvent.click(within(setup).getByRole('button', { name: /Add \/ import players/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Import roster' }));
  fireEvent.change(screen.getByLabelText('Player names or roster data'), { target: { value: 'Private Draft Player' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review import' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Import 1 players' })); });
  await within(screen.getByRole('dialog')).findByRole('button', { name: 'Retry saved draft' });
  fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('link', { name: 'Open Hawks scoring demo' }));
  expect(screen.queryByText('Scoring demo route')).toBeNull();
  expect(screen.getByText(/Finish open forms and resolve unsaved roster/)).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Private Draft Player' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Retry save' })).toBeTruthy();
  expect(repos.scouting.inspect().data.players).toEqual([]);
  expect(repos.scouting.save).toHaveBeenCalledOnce();
  expect(privateCacheWrites).not.toHaveBeenCalled();
});

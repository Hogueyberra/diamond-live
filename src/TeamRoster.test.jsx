// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamRoster, TeamSetup } from './TeamRoster.jsx';
import { useScouting } from './useScouting.js';
import { createEmptyScoutingData, DEMO_SCOUTING_AUTHOR_ID } from './scouting.js';

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

const team = { id: '00000000-0000-4000-8000-000000000010', name: 'Test Angels' };
const player = { id: '00000000-0000-4000-8000-000000000001', name: 'Alex Example', number: '12', age: 9, positions: 'Infield', notes: '', archived: false, draftStatus: 'available' };
function repositoryFixture(players = []) {
  let record = { data: { ...createEmptyScoutingData(), players }, revision: 1, updatedAt: '2026-09-30T08:00:00Z' };
  const mutations = new Set();
  return {
    load: vi.fn(async () => structuredClone(record)),
    save: vi.fn(async (revision, data, mutationId) => {
      if (mutations.has(mutationId)) return structuredClone(record);
      if (record.revision !== revision) throw Object.assign(new Error('Scouting changed on another device.'), { code: 'CONFLICT' });
      record = { data: structuredClone(data), revision: record.revision + 1, updatedAt: '2026-09-30T08:01:00Z' };
      mutations.add(mutationId); return structuredClone(record);
    }),
    inspect: () => structuredClone(record),
  };
}
function Harness({ repository, onEvaluate = () => {}, onPendingChange }) {
  const store = useScouting({ repository, scopeKey: team.id, authorId: DEMO_SCOUTING_AUTHOR_ID });
  return <TeamRoster team={team} store={store} onEvaluate={onEvaluate} onPendingChange={onPendingChange} />;
}
async function openImport(repository, text) {
  render(<Harness repository={repository} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Import roster' }));
  fireEvent.change(screen.getByLabelText('Player names or roster data'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Review import' }));
}

describe('team roster integration', () => {
  it('imports only reviewed new players through the shared scouting store and persists valid UUIDs', async () => {
    const repository = repositoryFixture([player]);
    await openImport(repository, 'Alex Example\nJordan Example');
    expect(repository.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 players' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(repository.save).toHaveBeenCalledOnce();
    const saved = repository.inspect().data.players;
    expect(saved.map((record) => record.name)).toEqual(['Alex Example', 'Jordan Example']);
    expect(saved[0]).toEqual(player);
    expect(saved[1].id).toMatch(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/);
    expect(screen.getByRole('heading', { name: 'Jordan Example' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Import roster' }));
    fireEvent.change(screen.getByLabelText('Player names or roster data'), { target: { value: 'Jordan Example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review import' }));
    expect(screen.getByText('1 duplicates skipped')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Import 0 players' }).disabled).toBe(true);
  });
  it('leaves the roster unchanged when an import preview is discarded', async () => {
    const repository = repositoryFixture();
    await openImport(repository, 'Jordan Example');
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard import' }));
    expect(repository.save).not.toHaveBeenCalled(); expect(repository.inspect().data.players).toEqual([]);
    expect(screen.getByRole('heading', { name: 'Bring the Test Angels into Diamond Live.' })).toBeTruthy();
  });
  it('adds a player, edits in place, and opens the selected player assessment', async () => {
    const repository = repositoryFixture(); const onEvaluate = vi.fn();
    render(<Harness repository={repository} onEvaluate={onEvaluate} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add player' }));
    fireEvent.change(screen.getByLabelText('Player name'), { target: { value: 'Casey Example' } });
    fireEvent.change(screen.getByLabelText('Jersey / evaluation number (optional)'), { target: { value: '04' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save player' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const id = repository.inspect().data.players[0].id;
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Positions (optional)'), { target: { value: 'Outfield' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save player' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(repository.inspect().data.players).toEqual([expect.objectContaining({ id, name: 'Casey Example', number: '04', age: null, positions: 'Outfield' })]);
    fireEvent.click(screen.getByRole('button', { name: /Assess skills/ }));
    expect(onEvaluate).toHaveBeenCalledWith(id);
  });
  it('prevents a duplicate manual player save and preserves the editable form', async () => {
    const repository = repositoryFixture([player]); render(<Harness repository={repository} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add player' }));
    fireEvent.change(screen.getByLabelText('Player name'), { target: { value: ' alex example ' } });
    fireEvent.change(screen.getByLabelText('Jersey / evaluation number (optional)'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save player' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(repository.save).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Player name').value).toBe(' alex example ');
  });
  it('recovers an import whose server acknowledgment was lost without duplicating players or mutations', async () => {
    const repository = repositoryFixture();
    const acknowledge = repository.save.getMockImplementation();
    repository.save.mockImplementationOnce(async (...args) => {
      await acknowledge(...args);
      throw new Error('Connection dropped before the save was acknowledged.');
    });
    await openImport(repository, 'Jordan Example');
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 players' }));
    const dialog = screen.getByRole('dialog');
    const retry = await within(dialog).findByRole('button', { name: 'Retry saved draft' });
    expect(repository.inspect().data.players).toHaveLength(1);
    const originalPlayerId = repository.inspect().data.players[0].id;
    expect(within(dialog).getByRole('button', { name: 'Import 0 players' }).disabled).toBe(true);
    fireEvent.click(retry);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(repository.save.mock.calls[1][2]).toBe(repository.save.mock.calls[0][2]);
    expect(repository.save.mock.calls[1][1]).toEqual(repository.save.mock.calls[0][1]);
    expect(repository.inspect().data.players).toEqual([expect.objectContaining({ id: originalPlayerId, name: 'Jordan Example' })]);
    expect(screen.getByRole('heading', { name: 'Jordan Example' })).toBeTruthy();
  });
  it('allows a failed import preview to close while keeping its pending draft available for retry', async () => {
    const repository = repositoryFixture(); repository.save.mockRejectedValueOnce(new Error('Temporarily unavailable.'));
    await openImport(repository, 'Jordan Example');
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 players' }));
    await within(screen.getByRole('dialog')).findByRole('button', { name: 'Retry saved draft' });
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.getByText(/may be in an unsynced team draft/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(repository.inspect().data.players).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Retry save' }));
    await waitFor(() => expect(repository.inspect().data.players).toHaveLength(1));
    expect(repository.save.mock.calls[1][2]).toBe(repository.save.mock.calls[0][2]);
  });
});

it('counts only assessed active players in team setup and makes all setup actions usable', () => {
  const handlers = { onPlayers: vi.fn(), onSchedule: vi.fn(), onAssess: vi.fn(), onPlan: vi.fn() };
  render(<TeamSetup players={[player, { ...player, id: 'archived', archived: true }]} events={[]} evaluations={[{ playerId: player.id, ratings: { if_glove: null } }, { playerId: 'archived', ratings: { if_glove: 5 } }]} activities={[]} {...handlers} />);
  expect(screen.getByText('1/4 ready')).toBeTruthy();
  const setup = within(screen.getByRole('region', { name: 'Team setup' }));
  fireEvent.click(setup.getByRole('button', { name: /Manage players/ }));
  fireEvent.click(setup.getByRole('button', { name: /Add \/ import schedule/ }));
  fireEvent.click(setup.getByRole('button', { name: /Open assessments/ }));
  fireEvent.click(setup.getByRole('button', { name: /Plan a practice/ }));
  for (const callback of Object.values(handlers)) expect(callback).toHaveBeenCalledOnce();
});

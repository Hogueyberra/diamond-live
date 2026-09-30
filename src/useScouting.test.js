import { describe, expect, it, vi } from 'vitest';
import { createDemoScoutingRepository, createScoutingSync } from './useScouting.js';
import { createEmptyScoutingData, DEMO_SCOUTING_AUTHOR_ID, getScoutingStorageKey } from './scouting.js';

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const addPlayer = (n) => (data) => ({ ...data, players: [...data.players, { id: uid(n), name: `Player ${n}`, number: String(n), age: 8, positions: '', notes: '', archived: false, draftStatus: 'available' }] });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function server() {
  let record = { data: createEmptyScoutingData(), revision: 0, updatedAt: null }; let mutationId = null;
  return {
    load: vi.fn(async () => structuredClone(record)),
    save: vi.fn(async (revision, data, mutation) => {
      if (mutation === mutationId) return structuredClone(record);
      if (revision !== record.revision) throw Object.assign(new Error('Conflict'), { code: 'CONFLICT' });
      record = { data: structuredClone(data), revision: record.revision + 1, updatedAt: '2026-09-29T18:00:00.000Z' }; mutationId = mutation; return structuredClone(record);
    }),
  };
}
const controller = (repository, options = {}) => createScoutingSync({ repository, authorId: DEMO_SCOUTING_AUTHOR_ID, ...options });

describe('scouting synchronization', () => {
  it('rejects a stale form revision inside the controller before publishing any mutation', async () => {
    const repository = server(); const first = controller(repository); const second = controller(repository);
    await first.start(); await second.start();
    const formRevision = first.getState().revision;
    await second.save(addPlayer(1)); await first.refresh();
    repository.save.mockClear();
    await expect(first.save(addPlayer(2), formRevision)).rejects.toMatchObject({ code: 'SCOUTING_STALE_FORM' });
    expect(repository.save).not.toHaveBeenCalled();
    expect(first.getState()).toMatchObject({ revision: 1, pending: false });
    expect(first.getState().data.players.map((player) => player.id)).toEqual([uid(1)]);
  });
  it('starts cloud storage empty and resolves save only after acknowledgment, then syncs another device', async () => {
    const repository = server(); const first = controller(repository); const second = controller(repository); await first.start(); await second.start();
    expect(first.getState().data.players).toEqual([]);
    const gate = deferred(); const write = repository.save.getMockImplementation(); repository.save.mockImplementationOnce(async (...args) => { await gate.promise; return write(...args); });
    let acknowledged = false; const saving = first.save(addPlayer(1)).then(() => { acknowledged = true; });
    expect(first.getState()).toMatchObject({ status: 'saving', pending: true }); expect(acknowledged).toBe(false);
    await expect(first.save(addPlayer(2))).rejects.toMatchObject({ code: 'SCOUTING_PENDING' });
    gate.resolve(); await saving; await second.refresh();
    expect(acknowledged).toBe(true); expect(first.getState()).toMatchObject({ pending: false, status: 'synced', revision: 1 }); expect(second.getState().data.players[0].id).toBe(uid(1));
  });
  it('retains an offline draft without claiming it was saved and permits the same mutation retry', async () => {
    let online = false; const repository = server(); const sync = controller(repository, { online: () => online }); await sync.start();
    await expect(sync.save(addPlayer(1))).rejects.toMatchObject({ code: 'SCOUTING_OFFLINE' });
    expect(sync.getState()).toMatchObject({ status: 'offline', pending: true }); expect(repository.save).not.toHaveBeenCalled();
    online = true; await sync.retrySave(); expect(sync.getState()).toMatchObject({ status: 'synced', revision: 1, pending: false });
  });
  it('keeps the exact mutation id after a committed response is lost, preventing duplicate submissions', async () => {
    const repository = server(); const write = repository.save.getMockImplementation(); repository.save.mockImplementationOnce(async (...args) => { await write(...args); throw new Error('Connection lost'); });
    const sync = controller(repository); await sync.start(); await expect(sync.save(addPlayer(1))).rejects.toThrow('Connection lost');
    await sync.refresh(); await expect(sync.save(addPlayer(1))).rejects.toMatchObject({ code: 'SCOUTING_PENDING' });
    await sync.retrySave(); expect(repository.save.mock.calls[0][2]).toBe(repository.save.mock.calls[1][2]);
    expect(sync.getState()).toMatchObject({ revision: 1, pending: false }); expect(sync.getState().data.players).toHaveLength(1);
  });
  it('keeps conflicts in memory until an explicit reload and never overwrites the winning device', async () => {
    const repository = server(); const first = controller(repository); const second = controller(repository); await first.start(); await second.start();
    await first.save(addPlayer(1)); await expect(second.save(addPlayer(2))).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(second.getState()).toMatchObject({ status: 'conflict', pending: true }); expect(second.getState().data.players[0].id).toBe(uid(2));
    await second.refresh(); await expect(second.retrySave()).rejects.toMatchObject({ code: 'CONFLICT' }); expect(repository.save).toHaveBeenCalledTimes(2);
    await second.loadLatest(); expect(second.getState().data.players[0].id).toBe(uid(1)); expect(second.getState().pending).toBe(false);
  });
  it('preserves the draft if explicit reload fails', async () => {
    const repository = server(); const sync = controller(repository, { online: () => false }); await sync.start(); await expect(sync.save(addPlayer(1))).rejects.toThrow();
    repository.load.mockRejectedValueOnce(new Error('Offline')); await expect(sync.loadLatest()).rejects.toThrow('Offline');
    expect(sync.getState().pending).toBe(true); expect(sync.getState().data.players[0].id).toBe(uid(1));
  });
  it('ignores stale responses and erases in-memory data after the account or team scope is disposed', async () => {
    const repository = server(); const gate = deferred(); repository.load.mockReturnValueOnce(gate.promise); const changes = vi.fn(); const sync = controller(repository, { onChange: changes });
    const loading = sync.start(); sync.dispose(); gate.resolve({ data: createEmptyScoutingData(), revision: 0, updatedAt: null }); await loading;
    expect(changes).not.toHaveBeenCalled(); expect(sync.getState().data).toBeNull(); await expect(sync.save(addPlayer(1))).rejects.toMatchObject({ code: 'SCOUTING_DISPOSED' });
  });
  it('rejects a save acknowledgment for an unmounted scope without updating the next screen', async () => {
    const repository = server(); const gate = deferred(); const sync = controller(repository); await sync.start(); repository.save.mockReturnValueOnce(gate.promise);
    const saving = sync.save(addPlayer(1)); sync.dispose(); gate.resolve({ data: addPlayer(1)(createEmptyScoutingData()), revision: 1, updatedAt: '2026-09-29T18:00:00Z' });
    await expect(saving).rejects.toMatchObject({ code: 'SCOUTING_DISPOSED' }); expect(sync.getState().data).toBeNull();
  });
  it('never lets an older refresh replace a draft or a newly acknowledged revision', async () => {
    const repository = server(); const sync = controller(repository); await sync.start(); const gate = deferred(); repository.load.mockReturnValueOnce(gate.promise);
    const refreshing = sync.refresh(); await sync.save(addPlayer(1)); gate.resolve({ data: createEmptyScoutingData(), revision: 0, updatedAt: null }); await refreshing;
    expect(sync.getState().data.players).toHaveLength(1); expect(sync.getState().revision).toBe(1);
  });
  it('fails closed on malformed responses and erases displayed private data when server access is revoked', async () => {
    const repository = server(); const sync = controller(repository); repository.load.mockResolvedValueOnce({ data: {}, revision: 0, updatedAt: null }); await sync.start();
    expect(sync.getState()).toMatchObject({ data: null, status: 'load-error' }); await sync.refresh(); await sync.save(addPlayer(1));
    repository.load.mockRejectedValueOnce(Object.assign(new Error('Permission denied'), { code: '42501' })); await sync.refresh();
    expect(sync.getState()).toMatchObject({ data: null, pending: false, status: 'access-denied' });
  });
});

describe('isolated browser demo persistence', () => {
  function storage() { const values = new Map(); return { getItem: vi.fn((key) => values.get(key) ?? null), setItem: vi.fn((key, value) => values.set(key, value)) }; }
  it('keeps synthetic teams in separate versioned keys and checks revision conflicts', async () => {
    const local = storage(); const first = createDemoScoutingRepository({ scopeKey: 'angels', storage: local }); const other = createDemoScoutingRepository({ scopeKey: 'other', storage: local });
    const record = await first.load(); record.data.players[0].notes = 'Demo only'; await first.save(0, record.data, uid(999));
    expect(local.setItem.mock.calls[0][0]).toBe(getScoutingStorageKey('angels')); expect((await other.load()).data.players[0].notes).not.toBe('Demo only');
    await expect(first.save(0, record.data, uid(998))).rejects.toMatchObject({ code: 'CONFLICT' }); expect((await first.save(0, record.data, uid(999))).revision).toBe(1);
  });
  it('leaves malformed demo storage untouched instead of silently replacing it with samples', async () => {
    const local = storage(); local.setItem(getScoutingStorageKey('bad'), '{broken'); local.setItem.mockClear();
    const repository = createDemoScoutingRepository({ scopeKey: 'bad', storage: local }); await expect(repository.load()).rejects.toThrow(/left untouched/);
    await expect(repository.save(0, createEmptyScoutingData(), uid(999))).rejects.toThrow(/left untouched/); expect(local.setItem).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createWorkspaceSync } from './workspaceSync.js';

const data = () => ({ schemaVersion: 1, teams: [{ id: 'team-1', name: 'Angels', division: 'Minor B', league: 'HVLL', seasonId: 'season-1', season: 'Fall 2026' }], events: [], observations: [], activities: [] });
const note = (id) => ({ id, teamId: 'team-1', seasonId: 'season-1', title: id, note: 'Practice a controlled throw.', author: 'Coach', createdAt: '2026-09-29T18:00:00Z', source: 'Coach observation', status: 'open' });
const addNote = (id) => (current) => ({ ...current, observations: [...current.observations, note(id)] });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function server() {
  let record = { data: data(), revision: 0, updatedAt: '2026-09-29T18:00:00Z' };
  let mutation = null;
  return {
    loadWorkspace: vi.fn(async () => structuredClone(record)),
    saveWorkspace: vi.fn(async (_id, revision, next, id) => {
      if (mutation === id) return structuredClone(record);
      if (record.revision !== revision) throw Object.assign(new Error('conflict'), { code: 'CONFLICT' });
      record = { data: structuredClone(next), revision: record.revision + 1, updatedAt: '2026-09-29T18:01:00Z' }; mutation = id;
      return structuredClone(record);
    }),
  };
}
const controller = (repository, options = {}) => createWorkspaceSync({ repository, teamId: 'team-1', canWrite: true, uuid: () => crypto.randomUUID(), ...options });

describe('shared team synchronization', () => {
  it('loads a team without seeding demo events, then delivers edits to another device', async () => {
    const repository = server(); const phone = controller(repository); const laptop = controller(repository);
    await phone.start(); await laptop.start();
    expect(phone.getState().data.events).toEqual([]);
    phone.setData(addNote('throwing')); await tick(); await laptop.refresh();
    expect(laptop.getState().data.observations[0].title).toBe('throwing');
    expect(phone.getState()).toMatchObject({ status: 'synced', pending: false, revision: 1 });
  });
  it('serializes edits made while a save is in flight', async () => {
    const repository = server(); const gate = deferred();
    const save = repository.saveWorkspace.getMockImplementation();
    repository.saveWorkspace.mockImplementationOnce(async (...args) => { await gate.promise; return save(...args); });
    const sync = controller(repository); await sync.start();
    sync.setData(addNote('first')); sync.setData(addNote('second'));
    expect(repository.saveWorkspace).toHaveBeenCalledTimes(1);
    gate.resolve(); await tick();
    expect(repository.saveWorkspace).toHaveBeenCalledTimes(2);
    expect(sync.getState()).toMatchObject({ pending: false, revision: 2, status: 'synced' });
    expect((await repository.loadWorkspace()).data.observations).toHaveLength(2);
  });
  it('keeps an offline draft and sends it after reconnect without claiming it was synced', async () => {
    let online = false; const repository = server(); const sync = controller(repository, { online: () => online });
    await sync.start(); sync.setData(addNote('offline'));
    expect(sync.getState()).toMatchObject({ pending: true, status: 'offline' });
    expect(repository.saveWorkspace).not.toHaveBeenCalled();
    online = true; await sync.retry();
    expect(sync.getState()).toMatchObject({ pending: false, status: 'synced' });
  });
  it('does not overwrite another device and keeps the conflicting draft until explicit reload', async () => {
    const repository = server(); const phone = controller(repository); const laptop = controller(repository);
    await phone.start(); await laptop.start(); phone.setData(addNote('phone')); await tick();
    laptop.setData(addNote('laptop')); await tick();
    expect(laptop.getState()).toMatchObject({ status: 'conflict', pending: true });
    expect(laptop.getState().data.observations[0].id).toBe('laptop');
    await laptop.refresh(); await laptop.retry();
    expect(repository.saveWorkspace).toHaveBeenCalledTimes(2);
    expect((await repository.loadWorkspace()).data.observations[0].id).toBe('phone');
    await laptop.loadLatest();
    expect(laptop.getState()).toMatchObject({ status: 'synced', pending: false });
    expect(laptop.getState().data.observations[0].id).toBe('phone');
  });
  it('uses the original mutation id when a committed save response is lost', async () => {
    const repository = server(); const save = repository.saveWorkspace.getMockImplementation();
    repository.saveWorkspace.mockImplementationOnce(async (...args) => { await save(...args); throw new Error('Connection lost'); });
    const sync = controller(repository); await sync.start(); sync.setData(addNote('once')); await tick();
    expect(sync.getState()).toMatchObject({ status: 'error', pending: true });
    await sync.retry();
    expect(repository.saveWorkspace.mock.calls[0][3]).toBe(repository.saveWorkspace.mock.calls[1][3]);
    expect(sync.getState()).toMatchObject({ revision: 1, pending: false });
  });
  it('preserves a draft when conflict reload fails', async () => {
    const repository = server(); const sync = controller(repository, { online: () => false });
    await sync.start(); sync.setData(addNote('kept'));
    repository.loadWorkspace.mockRejectedValueOnce(new Error('Offline'));
    await expect(sync.loadLatest()).rejects.toThrow('Offline');
    expect(sync.getState().data.observations[0].id).toBe('kept');
    expect(sync.getState().pending).toBe(true);
  });
  it('ignores stale account responses after disposal and drops private memory', async () => {
    const repository = server(); const gate = deferred(); const changes = vi.fn();
    repository.loadWorkspace.mockReturnValueOnce(gate.promise);
    const sync = controller(repository, { onChange: changes }); const loading = sync.start(); sync.dispose();
    gate.resolve({ data: data(), revision: 0 }); await loading;
    expect(changes).not.toHaveBeenCalled(); expect(sync.getState().data).toBeNull();
  });
  it('does not allow a viewer to edit or send a mutation', async () => {
    const repository = server(); const sync = controller(repository, { canWrite: false });
    await sync.start(); expect(sync.setData(addNote('forbidden'))).toBe(false);
    expect(repository.saveWorkspace).not.toHaveBeenCalled();
  });
  it('keeps an unsynced draft when access changes to read-only and stops writes', async () => {
    let online = false;
    const repository = server(); const sync = controller(repository, { online: () => online });
    await sync.start(); sync.setData(addNote('kept-for-export')); sync.setCanWrite(false);
    online = true; await sync.retry();
    expect(repository.saveWorkspace).not.toHaveBeenCalled();
    expect(sync.getState().data.observations[0].id).toBe('kept-for-export');
    expect(sync.getState().pending).toBe(true);
    expect(sync.getState().error).toMatch(/read-only/);
    await sync.loadLatest(); expect(sync.getState().pending).toBe(false);
  });
  it('rejects malformed and foreign-team server records instead of showing a saved empty team', async () => {
    const repository = server(); const foreign = data(); foreign.teams[0].id = 'other';
    repository.loadWorkspace.mockResolvedValueOnce({ data: foreign, revision: 0 });
    const sync = controller(repository); await sync.start();
    expect(sync.getState()).toMatchObject({ data: null, status: 'load-error' });
  });
  it('does not let a refresh in flight replace a newly edited local draft', async () => {
    const repository = server(); const sync = controller(repository, { online: () => false }); await sync.start();
    const gate = deferred(); repository.loadWorkspace.mockReturnValueOnce(gate.promise);
    const refresh = sync.refresh(); sync.setData(addNote('retain'));
    gate.resolve({ data: data(), revision: 0 }); await refresh;
    expect(sync.getState().data.observations[0].id).toBe('retain');
    expect(sync.getState().pending).toBe(true);
  });
  it('does not let an old refresh roll back an acknowledged save', async () => {
    const repository = server(); const sync = controller(repository); await sync.start();
    const gate = deferred(); repository.loadWorkspace.mockReturnValueOnce(gate.promise);
    const refresh = sync.refresh(); sync.setData(addNote('already-saved')); await tick();
    expect(sync.getState().revision).toBe(1);
    gate.resolve({ data: data(), revision: 0 }); await refresh;
    expect(sync.getState().data.observations[0].id).toBe('already-saved');
    expect(sync.getState()).toMatchObject({ pending: false, revision: 1, status: 'synced' });
  });
});

describe('awaited team saves', () => {
  it('resolves only after the server acknowledges the saved revision', async () => {
    const repository = server(); const gate = deferred(); const acknowledge = repository.saveWorkspace.getMockImplementation();
    repository.saveWorkspace.mockImplementationOnce(async (...args) => { await gate.promise; return acknowledge(...args); });
    const sync = controller(repository); await sync.start();
    const settled = vi.fn(); const saving = sync.save(addNote('approved'), 0).then((record) => { settled(); return record; });
    await tick();
    expect(settled).not.toHaveBeenCalled();
    expect(sync.getState()).toMatchObject({ pending: true, status: 'saving', revision: 0 });
    gate.resolve(); const record = await saving;
    expect(settled).toHaveBeenCalledOnce();
    expect(record).toMatchObject({ pending: false, status: 'synced', revision: 1 });
    expect((await repository.loadWorkspace()).data.observations[0].id).toBe('approved');
  });
  it('rejects a save response that has not advanced the submitted revision and retains the draft', async () => {
    const repository = server(); const sync = controller(repository); await sync.start();
    repository.saveWorkspace.mockResolvedValueOnce({ data: data(), revision: 0, updatedAt: '2026-09-29T18:00:00Z' });
    await expect(sync.save(addNote('unacknowledged'), 0)).rejects.toThrow(/acknowledged|confirmed|revision/i);
    expect(sync.getState().pending).toBe(true);
    expect(sync.getState().data.observations[0].id).toBe('unacknowledged');
  });
  it('blocks stale form revisions before invoking the updater or writing', async () => {
    const repository = server(); const sync = controller(repository); const updater = vi.fn(addNote('stale'));
    await sync.start(); await sync.save(addNote('first'), 0);
    await expect(sync.save(updater, 0)).rejects.toThrow(/changed while/);
    expect(updater).not.toHaveBeenCalled(); expect(repository.saveWorkspace).toHaveBeenCalledOnce();
    expect(sync.getState().data.observations.map((item) => item.id)).toEqual(['first']);
  });
  it('refuses another awaited update while a draft is pending', async () => {
    const repository = server(); const gate = deferred(); const acknowledge = repository.saveWorkspace.getMockImplementation();
    repository.saveWorkspace.mockImplementationOnce(async (...args) => { await gate.promise; return acknowledge(...args); });
    const sync = controller(repository); await sync.start();
    const saving = sync.save(addNote('first')); const updater = vi.fn(addNote('second'));
    await expect(sync.save(updater)).rejects.toThrow(/Resolve the current team save/);
    expect(updater).not.toHaveBeenCalled(); expect(repository.saveWorkspace).toHaveBeenCalledOnce();
    gate.resolve(); await saving;
    expect(sync.getState().data.observations.map((item) => item.id)).toEqual(['first']);
  });
  it('rejects a lost acknowledgment then retries the same draft and mutation only once', async () => {
    const repository = server(); const acknowledge = repository.saveWorkspace.getMockImplementation();
    repository.saveWorkspace.mockImplementationOnce(async (...args) => { await acknowledge(...args); throw new Error('Acknowledgment lost'); });
    const sync = controller(repository); await sync.start();
    await expect(sync.save(addNote('only-once'), 0)).rejects.toThrow('Acknowledgment lost');
    expect(sync.getState()).toMatchObject({ pending: true, status: 'error', revision: 0 });
    await sync.retry();
    expect(repository.saveWorkspace.mock.calls[1]).toEqual(repository.saveWorkspace.mock.calls[0]);
    expect(sync.getState()).toMatchObject({ pending: false, status: 'synced', revision: 1 });
    expect((await repository.loadWorkspace()).data.observations.map((item) => item.id)).toEqual(['only-once']);
  });
  it('rejects offline saves but keeps the draft ready for reconnect and retry', async () => {
    let online = false; const repository = server(); const sync = controller(repository, { online: () => online });
    await sync.start();
    await expect(sync.save(addNote('offline-await'), 0)).rejects.toThrow(/Offline/);
    expect(sync.getState()).toMatchObject({ pending: true, status: 'offline' });
    expect(sync.getState().data.observations[0].id).toBe('offline-await');
    expect(repository.saveWorkspace).not.toHaveBeenCalled();
    online = true; await sync.retry();
    expect(sync.getState()).toMatchObject({ pending: false, status: 'synced', revision: 1 });
  });
  it('adopts the authoritative snapshot returned after an idempotent retry', async () => {
    const repository = server(); const acknowledge = repository.saveWorkspace.getMockImplementation();
    repository.saveWorkspace.mockImplementationOnce(async (...args) => { await acknowledge(...args); throw new Error('Acknowledgment lost'); });
    const sync = controller(repository); await sync.start();
    await expect(sync.save(addNote('own-edit'), 0)).rejects.toThrow('Acknowledgment lost');
    const authoritative = { data: { ...data(), observations: [note('own-edit'), note('other-device')] }, revision: 2, updatedAt: '2026-09-29T18:02:00Z' };
    repository.saveWorkspace.mockResolvedValueOnce(authoritative);
    await sync.retry();
    expect(sync.getState()).toMatchObject({ pending: false, status: 'synced', revision: 2, data: authoritative.data });
  });
});

// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyScoutingData, DEMO_SCOUTING_AUTHOR_ID } from './scouting.js';
import { useScouting } from './useScouting.js';

const uuid = '00000000-0000-4000-8000-000000000001';
const player = { id: uuid, name: 'Private player', number: '1', age: 8, positions: '', notes: '', archived: false, draftStatus: 'available' };
const record = (withPlayer = false) => ({ data: { ...createEmptyScoutingData(), players: withPlayer ? [player] : [] }, revision: 0, updatedAt: null });
const deferred = () => { let resolve; const promise = new Promise((yes) => { resolve = yes; }); return { promise, resolve }; };
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('scouting hook account and team isolation', () => {
  it('does not read or write browser storage for cloud data and hides the previous team immediately on a scope change', async () => {
    const readStorage = vi.spyOn(Storage.prototype, 'getItem'); const writeStorage = vi.spyOn(Storage.prototype, 'setItem');
    const first = { load: vi.fn(async () => record(true)), save: vi.fn() }; const gate = deferred(); const second = { load: vi.fn(() => gate.promise), save: vi.fn() };
    const { result, rerender } = renderHook((props) => useScouting({ ...props, authorId: DEMO_SCOUTING_AUTHOR_ID }), { initialProps: { repository: first, scopeKey: 'team-one', demo: false } });
    await waitFor(() => expect(result.current.data?.players).toHaveLength(1));
    rerender({ repository: second, scopeKey: 'team-two', demo: false }); expect(result.current.data).toBeNull(); expect(result.current.loading).toBe(true);
    await act(async () => { gate.resolve(record()); }); expect(result.current.data.players).toHaveLength(0);
    expect(readStorage).not.toHaveBeenCalled(); expect(writeStorage).not.toHaveBeenCalled();
  });
  it('refreshes when the browser regains focus but never replaces a pending draft and warns before closing', async () => {
    const repository = { load: vi.fn(async () => record()), save: vi.fn(async () => { throw new Error('Connection lost'); }) };
    const { result } = renderHook(() => useScouting({ repository, scopeKey: 'team-one', authorId: DEMO_SCOUTING_AUTHOR_ID }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { window.dispatchEvent(new Event('focus')); }); expect(repository.load).toHaveBeenCalledTimes(2);
    await act(async () => { await expect(result.current.save((data) => ({ ...data, players: [player] }))).rejects.toThrow('Connection lost'); });
    expect(result.current.pending).toBe(true); expect(result.current.readOnly).toBe(true);
    await act(async () => { window.dispatchEvent(new Event('focus')); }); expect(repository.load).toHaveBeenCalledTimes(2); expect(result.current.data.players).toHaveLength(1);
    const close = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(close); expect(close.defaultPrevented).toBe(true);
  });
  it('drops a loaded coach workspace when the caller removes the repository and does not accept edits', async () => {
    const repository = { load: vi.fn(async () => record(true)), save: vi.fn() };
    const { result, rerender } = renderHook((props) => useScouting(props), { initialProps: { repository, scopeKey: 'team-one', authorId: DEMO_SCOUTING_AUTHOR_ID } });
    await waitFor(() => expect(result.current.data?.players).toHaveLength(1));
    rerender({ repository: null, scopeKey: null, authorId: DEMO_SCOUTING_AUTHOR_ID });
    expect(result.current.data).toBeNull(); expect(result.current.readOnly).toBe(true);
    await expect(result.current.save((data) => data)).rejects.toThrow(/Choose a scouting workspace/); expect(repository.save).not.toHaveBeenCalled();
  });
});

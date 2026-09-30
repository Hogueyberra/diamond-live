import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createDemoScoutingData, getScoutingStorageKey, validateScoutingData, validateScoutingUpdate } from './scouting.js';

const copy = (value) => JSON.parse(JSON.stringify(value));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const failure = (message, code) => Object.assign(new Error(message), { code });
const initialState = () => ({ data: null, revision: null, updatedAt: null, status: 'loading', error: '', pending: false });
function validateRecord(record) {
  if (!record || !Number.isSafeInteger(record.revision) || record.revision < 0 || (record.updatedAt !== null && (typeof record.updatedAt !== 'string' || !Number.isFinite(Date.parse(record.updatedAt))))) throw new Error('The scouting response could not be verified.');
  return { data: validateScoutingData(record.data), revision: record.revision, updatedAt: record.updatedAt };
}

/** Browser storage is reserved for the explicitly labeled synthetic demo. */
export function createDemoScoutingRepository({ scopeKey, storage, now = () => new Date().toISOString() }) {
  if (typeof scopeKey !== 'string' || !scopeKey.trim()) throw new Error('A demo team is required.');
  const key = getScoutingStorageKey(scopeKey);
  function read() {
    let raw;
    try { raw = (storage ?? globalThis.localStorage).getItem(key); } catch { throw new Error('Browser storage is unavailable. The demo could not be loaded.'); }
    if (raw === null) return { data: createDemoScoutingData(), revision: 0, updatedAt: null, mutationId: null };
    try {
      const stored = JSON.parse(raw);
      if (stored.version !== 1 || (stored.mutationId !== null && typeof stored.mutationId !== 'string')) throw new Error('version');
      return { ...validateRecord(stored), mutationId: stored.mutationId };
    } catch { throw new Error('Saved scouting demo data is invalid. It has been left untouched; export or recover it before resetting this demo.'); }
  }
  return {
    async load() { return validateRecord(read()); },
    async save(expectedRevision, data, mutationId) {
      const current = read();
      if (current.mutationId === mutationId) return validateRecord(current);
      if (current.revision !== expectedRevision) throw failure('Scouting changed in another tab.', 'CONFLICT');
      const record = { version: 1, data: validateScoutingData(data), revision: current.revision + 1, updatedAt: now(), mutationId };
      try { (storage ?? globalThis.localStorage).setItem(key, JSON.stringify(record)); } catch { throw new Error('Browser storage could not save the demo. Your changes are still in this tab.'); }
      return validateRecord(record);
    },
  };
}

/** A scoped in-memory controller. No private records or session tokens enter browser storage. */
export function createScoutingSync({ repository, authorId, onChange, online = () => true, uuid = () => crypto.randomUUID() }) {
  let state = initialState(); let alive = true; let refreshing = false; let busy = false; let operation = null;
  const emit = (patch) => { if (!alive) return; state = { ...state, ...patch }; onChange?.(state); };
  const assertAlive = () => { if (!alive) throw failure('This scouting workspace has changed. Open the current team to continue.', 'SCOUTING_DISPOSED'); };
  const denyAccess = (error) => {
    if (!['42501', 'FORBIDDEN', 'UNAUTHORIZED'].includes(error.code)) return false;
    operation = null;
    emit({ data: null, revision: null, updatedAt: null, pending: false, status: 'access-denied', error: 'Coach access is required to view this team’s scouting records. Refresh your team access or sign in again.' });
    return true;
  };
  async function refresh() {
    if (!alive || busy || refreshing || state.pending) return;
    refreshing = true;
    try {
      const record = validateRecord(await repository.load());
      if (!alive || state.pending || (state.revision !== null && record.revision < state.revision)) return;
      emit({ ...record, status: 'synced', error: '' });
    } catch (error) {
      if (!denyAccess(error) && !state.pending) emit({ status: state.data ? 'error' : 'load-error', error: error.message || 'Scouting could not be loaded.' });
    } finally { refreshing = false; }
  }
  async function flush() {
    assertAlive();
    if (busy) throw failure('A scouting save is already in progress.', 'SCOUTING_PENDING');
    if (!state.pending || !operation) return { data: state.data, revision: state.revision, updatedAt: state.updatedAt };
    if (state.status === 'conflict') throw failure(state.error, 'CONFLICT');
    if (!online()) {
      const error = failure('Offline. Your scouting draft is kept in this tab. Reconnect and retry the save.', 'SCOUTING_OFFLINE');
      emit({ status: 'offline', error: error.message }); throw error;
    }
    busy = true; emit({ status: 'saving', error: '' });
    const saving = operation;
    try {
      const record = validateRecord(await repository.save(saving.revision, saving.data, saving.id));
      assertAlive();
      // An idempotent response may include later server changes. Accept the
      // authoritative snapshot only after the mutation has been acknowledged.
      if (record.revision <= saving.revision) throw new Error('The scouting save was not acknowledged by the server. Retry the save.');
      operation = null;
      emit({ ...record, status: 'synced', error: '', pending: false });
      return record;
    } catch (error) {
      if (!alive) throw error;
      if (denyAccess(error)) throw error;
      const conflict = error.code === 'CONFLICT' || error.code === 'DL_CONFLICT' || /revision conflict|workspace_conflict|changed on another device/i.test(error.message ?? '');
      const message = conflict ? 'Scouting changed on another device. Your draft is still here. Export it before loading the latest version.' : (error.message || 'Scouting has not been saved. Keep this tab open and retry.');
      emit({ status: conflict ? 'conflict' : online() ? 'error' : 'offline', error: message });
      if (conflict) throw failure(message, 'CONFLICT');
      throw error;
    } finally { busy = false; }
  }
  async function save(updater, expectedRevision) {
    assertAlive();
    if (!state.data || state.revision === null) throw failure('Wait for scouting to finish loading.', 'SCOUTING_NOT_LOADED');
    if (state.pending || busy) throw failure('Your previous scouting draft is still pending. Retry it or explicitly load the latest version first.', 'SCOUTING_PENDING');
    if (expectedRevision !== undefined && expectedRevision !== state.revision) throw failure('Another coach updated scouting while your form was open. Keep any notes you need, then close and reopen the form to review the latest saved version.', 'SCOUTING_STALE_FORM');
    const candidate = validateScoutingUpdate(state.data, typeof updater === 'function' ? updater(copy(state.data)) : updater, authorId);
    if (same(candidate, state.data)) return { data: state.data, revision: state.revision, updatedAt: state.updatedAt };
    operation = { data: candidate, revision: state.revision, id: uuid() };
    emit({ data: candidate, pending: true, error: '' });
    return flush();
  }
  async function loadLatest() {
    assertAlive();
    if (busy || refreshing) throw failure('Wait for the current scouting request to finish.', 'SCOUTING_PENDING');
    busy = true;
    try {
      const record = validateRecord(await repository.load());
      assertAlive(); operation = null;
      emit({ ...record, status: 'synced', pending: false, error: '' }); return record;
    } catch (error) {
      if (!denyAccess(error)) emit({ error: error.message || 'The latest scouting version could not be loaded.' }); throw error;
    } finally { busy = false; }
  }
  return { start: refresh, refresh, save, retrySave: flush, loadLatest, getState: () => state,
    dispose() { alive = false; operation = null; state = { ...initialState(), data: null, status: 'idle' }; } };
}

export function downloadScoutingData(data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'diamond-live-private-scouting-backup.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function useScouting({ repository, scopeKey, demo = false, authorId }) {
  const controller = useRef(null);
  const [state, setState] = useState(initialState);
  const [loadedScope, setLoadedScope] = useState(null);
  const scope = `${demo ? 'demo' : 'cloud'}:${scopeKey ?? ''}:${authorId ?? ''}`;
  const source = useMemo(() => repository || (demo && scopeKey ? createDemoScoutingRepository({ scopeKey }) : null), [repository, scopeKey, demo]);
  useEffect(() => {
    if (!source || !scopeKey || !authorId) { setState({ ...initialState(), status: 'idle' }); setLoadedScope(scope); controller.current = null; return; }
    const sync = createScoutingSync({ repository: source, authorId, online: () => demo || navigator.onLine !== false, onChange: (next) => { setState(next); setLoadedScope(scope); } });
    controller.current = sync; setState(sync.getState()); setLoadedScope(scope); void sync.start();
    const refresh = () => { if (document.visibilityState !== 'hidden') void sync.refresh(); };
    const reconnect = () => { if (sync.getState().pending && sync.getState().status === 'offline') void sync.retrySave().catch(() => {}); else refresh(); };
    const beforeUnload = (event) => { if (sync.getState().pending) { event.preventDefault(); event.returnValue = ''; } };
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh); window.addEventListener('online', reconnect); window.addEventListener('beforeunload', beforeUnload); document.addEventListener('visibilitychange', refresh);
    return () => { sync.dispose(); if (controller.current === sync) controller.current = null; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', reconnect); window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('visibilitychange', refresh); };
  }, [source, scope, scopeKey, authorId, demo]);
  const refresh = useCallback(() => controller.current?.refresh(), []);
  const save = useCallback((updater, expectedRevision) => controller.current ? controller.current.save(updater, expectedRevision) : Promise.reject(new Error('Choose a scouting workspace first.')), []);
  const retrySave = useCallback(() => controller.current ? controller.current.retrySave() : Promise.reject(new Error('Choose a scouting workspace first.')), []);
  const loadLatest = useCallback(() => controller.current ? controller.current.loadLatest() : Promise.reject(new Error('Choose a scouting workspace first.')), []);
  const visible = loadedScope === scope ? state : initialState();
  const exportData = useCallback(() => { if (loadedScope === scope && state.data) downloadScoutingData(state.data); }, [loadedScope, scope, state.data]);
  return { ...visible, loading: visible.status === 'loading', readOnly: visible.pending || !visible.data || visible.status === 'conflict', refresh, save, retrySave, loadLatest, exportData, mode: demo ? 'demo' : 'cloud' };
}

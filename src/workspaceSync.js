import { validateCoachingData } from './coachingStore.js';

const copy = (value) => JSON.parse(JSON.stringify(value));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

/** One mounted account + team. Private team records are never cached in the demo store. */
export function createWorkspaceSync({ repository, teamId, canWrite, onChange, online = () => true, uuid = () => crypto.randomUUID() }) {
  let state = { data: null, revision: null, status: 'loading', error: '', pending: false, updatedAt: null };
  let alive = true;
  let allowed = canWrite;
  let busy = false;
  let refreshing = false;
  let operation = null;
  let confirmed = null;
  const emit = (patch) => {
    if (!alive) return;
    state = { ...state, ...patch };
    onChange?.(state);
  };
  const read = (record) => {
    const data = validateCoachingData(record.data);
    if (data.teams.length !== 1 || data.teams[0].id !== teamId || !Number.isInteger(record.revision) || record.revision < 0) throw new Error('The shared workspace response could not be verified.');
    return { ...record, data };
  };
  async function refresh() {
    if (!alive || busy || refreshing || state.pending) return;
    refreshing = true;
    try {
      const record = read(await repository.loadWorkspace(teamId));
      if (!alive || state.pending || (state.revision !== null && record.revision < state.revision)) return;
      confirmed = record.data;
      emit({ data: record.data, revision: record.revision, updatedAt: record.updatedAt, status: 'synced', error: '' });
    } catch (error) {
      if (!state.pending) emit({ status: state.data ? 'error' : 'load-error', error: error.message || 'The team workspace could not be loaded.' });
    } finally { refreshing = false; }
  }
  async function flush() {
    if (!alive || !allowed || busy || !state.pending || state.status === 'conflict') return;
    if (!online()) { emit({ status: 'offline', error: 'Offline. Changes are kept in this tab until the connection returns.' }); return; }
    busy = true;
    emit({ status: 'saving', error: '' });
    try {
      while (alive && allowed && state.pending) {
        // Keep the same mutation through unknown outcomes. A response lost after
        // a successful commit must never create a second revision or overwrite.
        operation ??= { data: copy(state.data), revision: state.revision, id: uuid() };
        const record = read(await repository.saveWorkspace(teamId, operation.revision, operation.data, operation.id));
        if (!alive) return;
        confirmed = record.data;
        const pending = !same(state.data, operation.data);
        operation = null;
        emit({ revision: record.revision, updatedAt: record.updatedAt, pending, status: pending ? 'saving' : 'synced', error: '' });
      }
    } catch (error) {
      const conflict = error.code === 'CONFLICT' || error.code === 'DL_CONFLICT' || /revision conflict|workspace_conflict|changed on another device/i.test(error.message ?? '');
      if (conflict) operation = null;
      emit({ status: conflict ? 'conflict' : online() ? 'error' : 'offline', error: conflict ? 'This team was changed on another device. Your draft is still here. Download it before loading the latest version.' : (error.message || 'Changes have not reached the server. Keep this tab open and retry.') });
    } finally {
      busy = false;
      if (!allowed && state.pending) emit({ status: 'error', error: 'Your access is now read-only. Your unsynced draft is still here; download it before loading the latest team version.' });
    }
  }
  function setData(update) {
    if (!alive || !allowed || !state.data || ['loading', 'load-error', 'conflict'].includes(state.status)) return false;
    const candidate = validateCoachingData(typeof update === 'function' ? update(copy(state.data)) : update);
    if (candidate.teams.length !== 1 || !same(candidate.teams[0], state.data.teams[0])) throw new Error('Team details must be changed through team settings.');
    if (same(candidate, state.data)) return true;
    emit({ data: candidate, pending: true });
    void flush();
    return true;
  }
  async function loadLatest() {
    if (busy) throw new Error('Wait for the current save to finish.');
    // Caller must get explicit confirmation; preserve draft if reload fails.
    busy = true;
    try {
      const record = read(await repository.loadWorkspace(teamId));
      if (!alive) return;
      operation = null; confirmed = record.data;
      emit({ data: record.data, revision: record.revision, updatedAt: record.updatedAt, status: 'synced', error: '', pending: false });
    } finally { busy = false; }
  }
  function setCanWrite(next) {
    allowed = Boolean(next);
    if (!allowed && state.pending) emit({ status: 'error', error: 'Your access is now read-only. Your unsynced draft is still here; download it before loading the latest team version.' });
  }
  return { start: refresh, refresh, setData, setCanWrite, retry: () => state.pending ? flush() : refresh(), loadLatest,
    getState: () => state, dispose: () => { alive = false; confirmed = null; operation = null; state = { ...state, data: null }; } };
}

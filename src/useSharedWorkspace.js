import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorkspaceSync } from './workspaceSync.js';

export function downloadWorkspace(data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'diamond-live-team-backup.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function useSharedWorkspace(repository, team, userId) {
  const [state, setState] = useState({ data: null, status: 'loading', pending: false });
  const controller = useRef(null);
  const scope = `${userId ?? ''}:${team?.id ?? ''}`;
  const [loadedScope, setLoadedScope] = useState('');
  useEffect(() => {
    if (!repository || !team || !userId) { setState({ data: null, pending: false, status: 'idle' }); setLoadedScope(''); return; }
    const current = createWorkspaceSync({ repository, teamId: team.id, canWrite: team.role !== 'viewer', online: () => navigator.onLine, onChange: (next) => { setState(next); setLoadedScope(scope); } });
    controller.current = current;
    setState(current.getState()); setLoadedScope(scope);
    void current.start();
    const refresh = () => { if (document.visibilityState !== 'hidden') void current.retry(); };
    const beforeUnload = (event) => { if (current.getState().pending) { event.preventDefault(); event.returnValue = ''; } };
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh); window.addEventListener('beforeunload', beforeUnload);
    return () => { current.dispose(); controller.current = null; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('beforeunload', beforeUnload); };
  }, [repository, scope]);
  useEffect(() => { controller.current?.setCanWrite(team?.role !== 'viewer'); }, [scope, team?.role]);
  const setData = useCallback((update) => controller.current?.setData(update), []);
  const retrySave = useCallback(() => controller.current?.retry(), []);
  const loadLatest = useCallback(() => controller.current?.loadLatest(), []);
  const exportData = useCallback(() => { if (state.data) downloadWorkspace(state.data); }, [state.data]);
  const visible = loadedScope === scope ? state : { data: null, status: 'loading', pending: false };
  return { ...visible, mode: 'cloud', setData, retrySave, exportData, loadLatest,
    readOnly: team?.role === 'viewer' || visible.status === 'conflict',
    loadError: visible.status === 'load-error' ? visible.error : null,
    saveError: ['error', 'offline', 'conflict'].includes(visible.status) ? visible.error : null };
}

import { useEffect, useState } from 'react';
import { Button } from '../WorkspaceUI.jsx';

/** Recovery stays inside the active dialog, including uncertain commit outcomes. */
export default function TeamSaveRecovery({ store, onRecovered }) {
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (retrying && !store.pending && store.status === 'synced') { setRetrying(false); onRecovered(); } }, [retrying, store.pending, store.status, onRecovered]);
  if (!store.pending || store.status === 'saving') return null;
  return <div className="tc-notice" role="alert"><p>{error || store.saveError || 'This draft has not synced. Keep it open or download a copy before replacing it.'}</p><div className="tc-actions"><Button disabled={store.status === 'conflict'} onClick={() => { setRetrying(true); store.retrySave(); }}>Retry saved draft</Button><Button onClick={store.exportData}>Download draft</Button><Button onClick={async () => { if (!window.confirm('Replace the unsynced draft with the latest saved team version? Download a copy first if you need it.')) return; try { await store.loadLatest(); onRecovered(); } catch (reason) { setError(reason.message); } }}>Replace draft with latest</Button></div></div>;
}

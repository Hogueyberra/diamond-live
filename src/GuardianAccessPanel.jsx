import { useEffect, useRef, useState } from 'react';
import { Button, Field, Modal } from './WorkspaceUI.jsx';
import './account.css';

export function GuardianAccessPanel({ repository, team, players, onClose, onPendingChange }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [playerId, setPlayerId] = useState('');
  const [email, setEmail] = useState('');
  const [invite, setInvite] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  const lock = useRef(false);
  const generation = useRef(0);
  const activePlayers = players.filter((item) => !item.archived);
  const label = (id) => players.find((item) => item.id === id)?.name ?? 'Archived or unavailable player';
  async function refresh() {
    const request = ++generation.current; setLoading(true); setError('');
    try { const next = await repository.access(team.id); if (mounted.current && request === generation.current) setData(next); }
    catch (reason) { if (mounted.current && request === generation.current) { setError(reason.message); setData(null); if (reason.code === '42501') setInvite(null); } }
    finally { if (mounted.current && request === generation.current) setLoading(false); }
  }
  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; ++generation.current; }; }, [repository, team.id]);
  useEffect(() => { onPendingChange?.(busy); return () => onPendingChange?.(false); }, [busy, onPendingChange]);
  async function run(operation, success) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setMessage('');
    try { const result = await operation(); if (mounted.current) await success?.(result); }
    catch (reason) { if (mounted.current) { setError(reason.message); if (reason.code === '42501') { setData(null); setInvite(null); } } }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  return <Modal title={`${team.name} · Family access`} onClose={() => { if (!lock.current) onClose(); }}><div className="ac-panel">
    <p>Choose a player and the guardian’s email. This gives that adult access to the player’s name, goals, and approved home instructions. They can share reflections with the coaches. Family access works without a coaching team membership.</p>
    <form className="cw-form" onSubmit={(event) => { event.preventDefault(); void run(() => repository.invite(team.id, playerId, email), async (next) => { setInvite({ ...next, playerName: label(playerId), email: email.trim() }); setMessage('Copy this code and share it directly with the invited adult.'); setEmail(''); await refresh(); }); }}>
      <fieldset disabled={busy || loading || !data} style={{ border: 0, padding: 0, display: 'grid', gap: 16, minWidth: 0 }}><Field label="Player to link"><select className="cl-select" required value={playerId} onChange={(event) => setPlayerId(event.target.value)}><option value="">Choose a player</option>{activePlayers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Guardian email"><input type="email" className="cl-input" required maxLength={254} value={email} autoComplete="off" onChange={(event) => setEmail(event.target.value)} /></Field><Button type="submit" variant="primary">{busy ? 'Creating…' : 'Create family invitation'}</Button></fieldset>
    </form>
    {error && <p role="alert" className="cw-alert">{error}</p>}{message && <p role="status" className="cw-success">{message}</p>}
    {invite && <aside className="ac-new-invite" aria-label="New family invitation"><strong>{invite.playerName} · {invite.email}</strong><p>Sign in at My Practice with this email, then enter:</p><strong className="ac-invite-code">{invite.code}</strong><p>One use · Expires {new Date(invite.expiresAt).toLocaleString()}</p><p>Copy now. The code won’t be shown after closing this panel. No invitation email is sent automatically.</p><Button disabled={busy} onClick={() => { void run(async () => { if (!navigator.clipboard?.writeText) throw new Error('Select the code to copy it manually.'); await navigator.clipboard.writeText(invite.code); }, () => setMessage('Family code copied.')); }}>Copy family code</Button></aside>}
    {loading && <p role="status">Loading family access…</p>}
    {!loading && data && <>{[['links', 'Linked guardians', 'link'], ['invites', 'Open family invitations', 'invite']].map(([collection, title, kind]) => <section className="ac-access-list" key={collection}><h3>{title} · {data[collection].length}</h3>{data[collection].length ? <ul>{data[collection].map((item) => <li key={item.id}><div><strong>{label(item.playerId)}</strong><p>{item.guardianEmail}</p>{item.expiresAt && <p>Expires {new Date(item.expiresAt).toLocaleDateString()}</p>}</div>{confirmation?.id === item.id ? <div className="ac-confirm"><p>{kind === 'link' ? 'Remove this guardian’s access? Their old invitation and other open codes for this player will also stop working.' : 'Revoke this family invitation?'}</p><div className="ac-actions"><Button disabled={busy} onClick={() => { void run(() => repository.revoke(team.id, item.id, kind), async () => { setConfirmation(null); setInvite(null); setMessage('Family access removed.'); await refresh(); }); }}>Confirm removal</Button><Button disabled={busy} onClick={() => setConfirmation(null)}>Keep access</Button></div></div> : <Button disabled={busy} aria-label={`Remove ${kind} for ${item.guardianEmail} and ${label(item.playerId)}`} onClick={() => setConfirmation({ id: item.id, kind })}>{kind === 'link' ? 'Remove access' : 'Revoke code'}</Button>}</li>)}</ul> : <p>{collection === 'links' ? 'No linked guardians yet.' : 'No open family invitations.'}</p>}</section>)}</>}
    <Button disabled={busy || loading} onClick={() => { void refresh(); }}>Refresh family access</Button>
  </div></Modal>;
}

import { useEffect, useRef, useState } from 'react';
import { Button, Field, Modal } from './WorkspaceUI.jsx';
import './account.css';

const DIVISIONS = ['Tee Ball', 'Rookie Ball', 'Farm', 'Minor C', 'Minor B', 'Minor A', 'Majors'];
const emptyTeam = () => ({ name: '', league: '', division: 'Minor B', season: '' });
const memberId = (member) => member.userId ?? member.user_id;
const memberName = (member) => member.displayName?.trim() || member.display_name?.trim() || member.email || 'Unnamed member';
const expiresAt = (invite) => invite.expiresAt ?? invite.expires_at;
const formatExpiry = (value) => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Expiry unavailable';
};

export function AccountPanel({ account, onClose }) {
  const [tab, setTab] = useState('profile');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [codeRequested, setCodeRequested] = useState(false);
  const [displayName, setDisplayName] = useState(account.profile?.display_name ?? '');
  const [nameDirty, setNameDirty] = useState(false);
  const [teamAction, setTeamAction] = useState('');
  const [teamDraft, setTeamDraft] = useState(emptyTeam);
  const [joinCode, setJoinCode] = useState('');
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [accessVersion, setAccessVersion] = useState(0);
  const [inviteRole, setInviteRole] = useState('coach');
  const [newInvite, setNewInvite] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const pendingRef = useRef(false);
  const mounted = useRef(true);
  const teams = account.teams ?? [];
  const activeTeam = teams.find((team) => team.id === account.activeTeamId);
  const owner = activeTeam?.role === 'owner';
  const busy = Boolean(pending || account.loading);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    setDisplayName(account.profile?.display_name ?? '');
    setNameDirty(false); setTab('profile'); setError(''); setMessage('');
    setNewInvite(null); setConfirmation(null);
  }, [account.user?.id]);
  useEffect(() => { if (!nameDirty) setDisplayName(account.profile?.display_name ?? ''); }, [account.profile?.display_name, nameDirty]);
  useEffect(() => {
    setNewInvite(null); setConfirmation(null); setMembers([]); setInvites([]); setAccessError('');
    if (!owner && tab === 'access') setTab('teams');
  }, [account.activeTeamId, owner]);
  useEffect(() => {
    if (tab !== 'access' || !owner || !account.user) return;
    let current = true;
    setAccessLoading(true); setAccessError('');
    Promise.all([account.listMembers(), account.listInvites()]).then(([nextMembers, nextInvites]) => {
      if (current) { setMembers(nextMembers ?? []); setInvites(nextInvites ?? []); }
    }).catch((reason) => { if (current) setAccessError(reason.message || 'Team access could not be loaded.'); })
      .finally(() => { if (current) setAccessLoading(false); });
    return () => { current = false; };
  }, [tab, owner, account.activeTeamId, account.user?.id, accessVersion]);

  async function run(key, operation, success) {
    if (pendingRef.current || account.loading) return;
    pendingRef.current = true; setPending(key); setError(''); setMessage('');
    try {
      const result = await operation();
      if (mounted.current) await success?.(result);
    } catch (reason) {
      if (mounted.current) setError(reason?.message || 'That request could not be completed. Please try again.');
    } finally {
      pendingRef.current = false;
      if (mounted.current) setPending('');
    }
  }

  const close = () => { if (!pendingRef.current) onClose(); };
  const changeTab = (next) => { setTab(next); setError(''); setMessage(''); setConfirmation(null); };
  const refreshAccess = () => setAccessVersion((value) => value + 1);
  const requestCode = (event) => {
    event.preventDefault();
    const value = email.trim();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setError('Enter a valid email address.'); return; }
    run('request', () => account.requestCode(value), () => {
      setEmail(value); setCodeRequested(true); setToken(''); setMessage(`A sign-in code has been requested for ${value}. Check your inbox and spam folder.`);
    });
  };
  const verifyCode = (event) => {
    event.preventDefault();
    if (!/^\d{6,10}$/.test(token)) { setError('Enter the 6–10 digit code from your email.'); return; }
    run('verify', () => account.verifyCode(email.trim(), token), () => setMessage('Signed in. Your profile and teams are loading.'));
  };
  const saveProfile = (event) => {
    event.preventDefault();
    if (!displayName.trim()) { setError('Add the name your team will see.'); return; }
    run('profile', () => account.saveProfile(displayName.trim()), () => { setNameDirty(false); setMessage('Profile saved.'); });
  };
  const createTeam = (event) => {
    event.preventDefault();
    const values = Object.fromEntries(Object.entries(teamDraft).map(([key, value]) => [key, value.trim()]));
    if (Object.values(values).some((value) => !value)) { setError('Add a team name, league, division, and season.'); return; }
    run('create-team', () => account.createTeam(values), () => {
      setMessage(`${values.name} is ready. You are the team owner.`); setTeamDraft(emptyTeam()); setTeamAction('');
    });
  };
  const joinTeam = (event) => {
    event.preventDefault();
    if (!joinCode.trim()) { setError('Enter the invitation code from your team owner.'); return; }
    run('join-team', () => account.joinTeam(joinCode.trim()), () => { setJoinCode(''); setTeamAction(''); setMessage('You joined the team.'); });
  };
  const createInvite = (event) => {
    event.preventDefault();
    run('invite', () => account.createInvite(inviteRole), (result) => {
      if (!result?.code) throw new Error('The invitation was created, but its code was not returned. Refresh the invitation list before creating another.');
      setNewInvite({ ...result, role: inviteRole }); refreshAccess(); setMessage('Invitation created. Share this code directly with one person.');
    });
  };
  const removeAccess = () => {
    const item = confirmation;
    run('remove', () => item.kind === 'member' ? account.removeMember(item.id) : account.revokeInvite(item.id), () => {
      setConfirmation(null); setNewInvite(null); refreshAccess();
      setMessage(item.kind === 'member' ? `${item.label} no longer has access to this team.` : 'Invitation revoked.');
    });
  };

  return <div className="coaching-workspace account-host"><Modal title={account.user ? 'Your account' : 'Sign in to Diamond Live'} onClose={close}><div className="ac-panel">
    {error && <p className="cw-alert" role="alert">{error}</p>}
    {message && <p className="cw-success" role="status">{message}</p>}
    {account.loading && account.user && <p className="ac-loading" role="status">Updating your account…</p>}
    {!account.configured ? <section className="ac-setup"><span className="ac-eyebrow">Shared team workspace</span><h3>Account setup in progress</h3><p>Sign-in is not available yet. You can continue using the demo on this device.</p>{account.configError && <p className="cw-alert" role="alert">{String(account.configError.message ?? account.configError)}</p>}<Button onClick={close}>Back to the workspace</Button></section>
      : account.loading && !account.user ? <p className="ac-loading" role="status">Checking your account…</p>
      : !account.user ? <section className="ac-signin"><p>Use your email to sign in or create an account. We’ll send you a one-time code.</p>{!codeRequested ? <form className="cw-form" onSubmit={requestCode}><Field label="Email address"><input className="cl-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required disabled={busy} autoFocus /></Field><Button variant="primary" type="submit" disabled={busy}>{pending === 'request' ? 'Sending code…' : 'Email me a code'}</Button></form>
        : <><div className="ac-email-destination"><strong>{email}</strong><button className="cw-text-button" disabled={busy} onClick={() => { setCodeRequested(false); setToken(''); setError(''); setMessage(''); }}>Use another email</button></div><form className="cw-form" onSubmit={verifyCode}><Field label="Email sign-in code"><input className="cl-input ac-code-input" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 10))} required disabled={busy} autoFocus /></Field><p className="cw-footnote">Enter the 6–10 digit code from the email. A code can only be used once.</p><Button type="submit" variant="primary" disabled={busy}>{pending === 'verify' ? 'Signing in…' : 'Verify & sign in'}</Button></form><form onSubmit={requestCode}><Button type="submit" disabled={busy}>{pending === 'request' ? 'Sending code…' : 'Send a new code'}</Button></form></>}</section>
        : <>
          <nav className="cl-tabs ac-tabs" aria-label="Account sections">{[['profile', 'Profile'], ['teams', 'Teams'], ...(owner ? [['access', 'Team access']] : [])].map(([value, label]) => <button key={value} className={`cl-tab${tab === value ? ' is-active' : ''}`} aria-pressed={tab === value} disabled={busy} onClick={() => changeTab(value)}>{label}</button>)}</nav>
          {tab === 'profile' && <section aria-label="Profile settings" className="ac-section"><form className="cw-form" onSubmit={saveProfile}><Field label="Your name"><input className="cl-input" value={displayName} onChange={(event) => { setDisplayName(event.target.value); setNameDirty(true); }} maxLength={100} autoComplete="name" required disabled={busy} /></Field><Field label="Account email"><input className="cl-input" type="email" value={account.user.email ?? ''} readOnly /></Field><p className="cw-footnote">Your name is visible to members of your teams.</p><Button variant="primary" type="submit" disabled={busy}>{pending === 'profile' ? 'Saving profile…' : 'Save profile'}</Button></form><div className="ac-signout"><p>Signing out ends this browser’s session.</p><Button disabled={busy} onClick={() => run('signout', () => account.signOut(), () => onClose())}>{pending === 'signout' ? 'Signing out…' : 'Sign out'}</Button></div></section>}
          {tab === 'teams' && <section aria-label="Your teams" className="ac-section">
            {teams.length ? <><Field label="Active team"><select className="cl-select" value={account.activeTeamId ?? ''} disabled={busy} onChange={(event) => { const id = event.target.value; run('switch', () => account.setActiveTeamId(id), () => setMessage('Active team changed.')); }}><option value="" disabled>Choose a team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name} · {team.season}</option>)}</select></Field>{activeTeam && <div className="ac-team-summary"><span className="ac-role">{activeTeam.role}</span><strong>{activeTeam.name}</strong><p>{[activeTeam.league, activeTeam.division, activeTeam.season].filter(Boolean).join(' · ')}</p><p>{activeTeam.role === 'viewer' ? 'You can read this team’s shared schedules, coaching records, and guidelines.' : 'Team members share schedules, coaching records, and guidelines across devices.'}</p></div>}</> : <div className="ac-empty"><h3>Your first team starts here.</h3><p>Create your team, or use an invitation code from its owner.</p></div>}
            <div className="ac-actions"><Button disabled={busy} onClick={() => { setTeamAction('create'); setError(''); }} aria-pressed={teamAction === 'create'}>Create a team</Button><Button disabled={busy} onClick={() => { setTeamAction('join'); setError(''); }} aria-pressed={teamAction === 'join'}>Join with a code</Button></div>
            {teamAction === 'create' && <form className="cw-form ac-subsection" onSubmit={createTeam}><h3>Create your team</h3><Field label="Team name"><input className="cl-input" value={teamDraft.name} onChange={(event) => setTeamDraft({ ...teamDraft, name: event.target.value })} maxLength={100} required disabled={busy} placeholder="Angels" /></Field><Field label="League"><input className="cl-input" value={teamDraft.league} onChange={(event) => setTeamDraft({ ...teamDraft, league: event.target.value })} maxLength={120} required disabled={busy} placeholder="Huntington Valley Little League" /></Field><div className="cw-form-pair"><Field label="Team division"><select className="cl-select" value={teamDraft.division} onChange={(event) => setTeamDraft({ ...teamDraft, division: event.target.value })} disabled={busy}>{DIVISIONS.map((division) => <option key={division}>{division}</option>)}</select></Field><Field label="Season"><input className="cl-input" value={teamDraft.season} onChange={(event) => setTeamDraft({ ...teamDraft, season: event.target.value })} maxLength={80} required disabled={busy} placeholder="Spring 2027" /></Field></div><p className="cw-footnote">You’ll own this team and choose who can access it.</p><Button variant="primary" type="submit" disabled={busy}>{pending === 'create-team' ? 'Creating team…' : 'Create shared team'}</Button></form>}
            {teamAction === 'join' && <form className="cw-form ac-subsection" onSubmit={joinTeam}><h3>Join your team</h3><Field label="Team invitation code"><input className="cl-input ac-code-input" value={joinCode} onChange={(event) => setJoinCode(event.target.value)} maxLength={128} autoComplete="off" spellCheck={false} required disabled={busy} /></Field><p className="cw-footnote">Ask your team owner for an invitation. Each code expires and works once.</p><Button variant="primary" type="submit" disabled={busy}>{pending === 'join-team' ? 'Joining team…' : 'Join team'}</Button></form>}
          </section>}
          {tab === 'access' && owner && <section aria-label="Team access settings" className="ac-section"><div><h3>{activeTeam.name} · Team access</h3><p className="ac-muted">Owners manage access. Coaches can edit shared records. Viewers can read all shared schedules, coaching records, and guidelines.</p></div>
            <form className="cw-form ac-invite-form" onSubmit={createInvite}><Field label="Invitation access"><select className="cl-select" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} disabled={busy}><option value="coach">Coach · view and edit</option><option value="viewer">Viewer · read only</option></select></Field><Button variant="primary" type="submit" disabled={busy || accessLoading || Boolean(accessError)}>{pending === 'invite' ? 'Creating invitation…' : 'Create invitation code'}</Button></form>
            {newInvite && <aside className="ac-new-invite" aria-label="New invitation code"><span className="ac-eyebrow">Share directly · {newInvite.role}</span><strong className="ac-invite-code">{newInvite.code}</strong><p>One use · Expires {formatExpiry(expiresAt(newInvite))}</p><p>Copy this code now. It won’t be shown again after you close this account panel.</p><Button disabled={busy} onClick={() => run('copy', async () => { if (!navigator.clipboard?.writeText) throw new Error('Select the code above to copy it manually.'); await navigator.clipboard.writeText(newInvite.code); }, () => setMessage('Invitation code copied.'))}>Copy code</Button></aside>}
            {accessLoading && <p role="status">Loading team access…</p>}{accessError && <div className="cw-alert" role="alert">{accessError}<Button onClick={refreshAccess} disabled={busy}>Retry loading access</Button></div>}
            {!accessLoading && !accessError && <><div className="ac-access-list"><h3>Members <span>{members.length}</span></h3>{members.length ? <ul>{members.map((member) => { const id = memberId(member); const label = memberName(member); return <li key={id}><div><strong>{label}{id === account.user.id ? ' (you)' : ''}</strong><span className="ac-role">{member.role}</span></div>{member.role !== 'owner' && id !== account.user.id && (confirmation?.kind === 'member' && confirmation.id === id ? <div className="ac-confirm" role="group" aria-label={`Confirm removing ${label}`}><p>Remove {label}’s access to this team?</p><div className="ac-actions"><Button disabled={busy} onClick={removeAccess}>{pending === 'remove' ? 'Removing…' : 'Confirm removal'}</Button><Button disabled={busy} onClick={() => setConfirmation(null)}>Keep member</Button></div></div> : <Button disabled={busy} aria-label={`Remove access for ${label}`} onClick={() => setConfirmation({ kind: 'member', id, label })}>Remove access</Button>)}</li>; })}</ul> : <p>No members were returned. Refresh to check the team.</p>}</div>
              <div className="ac-access-list"><h3>Open invitations <span>{invites.length}</span></h3>{invites.length ? <ul>{invites.map((invite) => <li key={invite.id}><div><strong>{invite.role === 'viewer' ? 'Viewer invitation' : 'Coach invitation'}</strong><p>Expires {formatExpiry(expiresAt(invite))}</p></div>{confirmation?.kind === 'invite' && confirmation.id === invite.id ? <div className="ac-confirm" role="group" aria-label="Confirm revoking invitation"><p>Revoke this invitation? Its code will stop working.</p><div className="ac-actions"><Button disabled={busy} onClick={removeAccess}>{pending === 'remove' ? 'Revoking…' : 'Confirm revoke'}</Button><Button disabled={busy} onClick={() => setConfirmation(null)}>Keep invitation</Button></div></div> : <Button disabled={busy} aria-label={`Revoke ${invite.role} invitation expiring ${formatExpiry(expiresAt(invite))}`} onClick={() => setConfirmation({ kind: 'invite', id: invite.id })}>Revoke</Button>}</li>)}</ul> : <p>No open invitations.</p>}</div><Button onClick={refreshAccess} disabled={busy}>Refresh team access</Button></>}
          </section>}
        </>}
  </div></Modal></div>;
}

export default AccountPanel;

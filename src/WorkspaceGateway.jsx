import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { UserCircle, CloudCheck, ArrowsClockwise } from '@phosphor-icons/react';
import { CoachingWorkspace } from './CoachingWorkspace.jsx';
import { AccountPanel } from './AccountPanel.jsx';
import { HomePage } from './HomePage.jsx';
import { Button, Modal } from './WorkspaceUI.jsx';
import { createCloudGuidelinesRepository } from './cloudGuidelines.js';
import { createScoutingRepository } from './scoutingRepository.js';
import { supabase } from './supabaseClient.js';
import './account.css';

export function WorkspaceGateway({ localStore, account, shared, demoPreview = false }) {
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const [reloadError, setReloadError] = useState('');
  const [reloading, setReloading] = useState(false);
  const [scoutingPending, setScoutingPending] = useState(false);
  const [navigationError, setNavigationError] = useState('');
  const team = account.teams.find((item) => item.id === account.activeTeamId);
  const repository = useMemo(() => team && account.user ? createCloudGuidelinesRepository({ client: supabase, teamId: team.id, userId: account.user.id, canWrite: team.role !== 'viewer', label: team.name }) : null, [team?.id, team?.role, team?.name, account.user?.id]);
  const canScout = !account.user || ['owner', 'coach'].includes(team?.role);
  const scoutingRepository = useMemo(() => {
    if (!account.user || !team || !canScout) return null;
    const repo = createScoutingRepository(supabase);
    return { load: () => repo.loadWorkspace(team.id), save: (revision, data, id) => repo.saveWorkspace(team.id, revision, data, id) };
  }, [account.user?.id, team?.id, canScout]);
  const preventLoss = () => { if (shared.pending || scoutingPending) throw new Error('You have unsaved team or scouting changes. Finish or discard any open scouting form, and resolve pending saves before leaving this workspace or changing accounts.'); };
  const safeAccount = { ...account,
    verifyCode: (...args) => { preventLoss(); return account.verifyCode(...args); },
    setActiveTeamId: (id) => { preventLoss(); account.setActiveTeamId(id); },
    createTeam: (details) => { preventLoss(); return account.createTeam(details); },
    joinTeam: (code) => { preventLoss(); return account.joinTeam(code); },
    signOut: () => { preventLoss(); return account.signOut(); },
  };
  const openAccount = () => setAccountOpen(true);
  const openDemo = () => { navigate('/preview'); window.scrollTo(0, 0); };
  const returnHome = (event) => {
    event?.preventDefault();
    try { preventLoss(); setNavigationError(''); navigate('/'); window.scrollTo(0, 0); }
    catch (error) { setNavigationError(error.message); }
  };
  const accountButton = <Button className="cw-account-button" onClick={openAccount}><UserCircle size={20} />{account.user ? (account.profile?.display_name || 'My account') : 'Sign in'}</Button>;
  const status = shared.status === 'synced' ? 'Synced with your team' : shared.status === 'saving' ? 'Saving to your team…' : shared.status === 'offline' ? 'Offline · changes in this tab' : shared.status === 'conflict' ? 'Changes need review' : shared.pending ? 'Changes not synced' : 'Checking team connection';
  const syncBar = <>{navigationError && <p role="alert" className="cw-alert">{navigationError}</p>}{!account.user && demoPreview && <div className="cw-cloud-status"><span>Explore the demo · Sample team data stays on this device.</span><Button onClick={returnHome}>Home</Button></div>}{account.user && <div className="cw-cloud-status"><span role="status"><CloudCheck size={18} />{account.error ? 'Account refresh failed · retry when connected' : status}{team?.role === 'viewer' ? ' · Read-only access' : ''}</span><Button onClick={() => { shared.retrySave(); account.reload().catch(() => {}); }} disabled={shared.status === 'saving'}><ArrowsClockwise size={16} />Refresh</Button>{shared.pending && shared.status !== 'saving' && <Button onClick={() => { setReloadError(''); setConfirmReload(true); }}>Review unsynced changes</Button>}</div>}</>;
  if (!account.user && account.loading) return <div className="coaching-workspace"><header className="cw-gateway-header"><strong>Diamond Live</strong></header><main className="cw-gateway-main"><p role="status">Opening Diamond Live…</p></main></div>;
  if (account.user && demoPreview) return <Navigate to="/" replace />;
  return <>
    {!account.user && !demoPreview ? <HomePage onSignIn={openAccount} onExploreDemo={openDemo} /> : account.user && (account.loading || !team || !shared.data) ? <div className="coaching-workspace"><header className="cw-gateway-header"><strong>Diamond Live</strong>{accountButton}</header><main className="cw-gateway-main"><span className="cl-badge">Your team workspace</span><h1>{account.loading ? 'Opening your account…' : account.error ? 'We couldn’t open your account.' : !team ? 'Bring your team together.' : shared.loadError ? 'Your team couldn’t be loaded.' : 'Opening your team…'}</h1>{account.error || shared.loadError ? <><p role="alert">{account.error || shared.loadError}</p><Button onClick={() => { account.reload().catch(() => {}); shared.retrySave(); }}>Try again</Button></> : !account.loading && !team ? <><p>Create a team or join with a code from your coach. Your schedule, notes, practice plans, and guideline documents will be shared with its members.</p><Button variant="primary" onClick={openAccount}>Set up your team</Button><p className="cw-footnote">Your local demo stays on this device. Its sample events and private imports are not copied automatically.</p></> : <p role="status">Loading your private workspace.</p>}</main></div> : <CoachingWorkspace key={account.user ? `${account.user.id}:${team?.id}` : 'local-demo'} store={account.user ? shared : localStore} accountButton={accountButton} syncBar={syncBar} guidelinesRepository={repository} authorName={account.profile?.display_name || 'Coach'} authorId={account.user?.id} scoutingRepository={scoutingRepository} canScout={canScout} onScoutingPendingChange={setScoutingPending} onHome={!account.user && demoPreview ? returnHome : undefined} />}
    {accountOpen && <AccountPanel key={account.user?.id ?? 'signed-out'} account={safeAccount} onClose={() => setAccountOpen(false)} />}
    {confirmReload && <div className="coaching-workspace account-host"><Modal title="Review your unsynced changes" onClose={() => { if (!reloading) setConfirmReload(false); }}><p>{shared.status === 'conflict' ? 'Another device saved changes first. ' : 'Your latest changes have not been confirmed by the server. '}Download your draft to keep a copy. Loading the latest team version will replace the unsynced changes in this tab.</p>{reloadError && <p role="alert" className="cw-alert">{reloadError}</p>}<div className="gl-actions"><Button onClick={shared.exportData}>Download my draft</Button><Button disabled={reloading} onClick={async () => { setReloading(true); try { await shared.loadLatest(); setConfirmReload(false); } catch (error) { setReloadError(error.message); } finally { setReloading(false); } }}>Replace my draft with latest</Button><Button disabled={reloading} onClick={() => setConfirmReload(false)}>Keep reviewing</Button></div></Modal></div>}
  </>;
}

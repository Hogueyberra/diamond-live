import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { Flag, X } from '@phosphor-icons/react';
import { CoachAssistant } from '../CoachAssistant.jsx';
import { createCloudGuidelinesRepository } from '../cloudGuidelines.js';
import { supabase } from '../supabaseClient.js';
import { assistantDemoPlayers, demoAssessmentSummary } from './assistantAssessments.js';
import './clubhouse-assistant.css';

export default function ClubhouseAssistant({ account, assessments, onClose, onAccount }) {
  const dialog = useRef(null);
  const team = account?.teams?.find((item) => item.id === account.activeTeamId);
  const allowed = Boolean(account?.user && !account.loading && !account.error && ['owner', 'coach'].includes(team?.role));
  const repository = useMemo(() => allowed ? createCloudGuidelinesRepository({ client: supabase, teamId: team.id, userId: account.user.id, canWrite: true, label: team.name }) : null, [allowed, team?.id, team?.name, account?.user?.id]);
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element.showModal();
    element.querySelector('h2').focus();
    return () => { element.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className="pr-assistant pr-live-assistant" aria-labelledby="pr-live-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className="pr-assistant-heading"><span className="pr-assistant-icon"><Flag size={21} /></span><div><h2 id="pr-live-title" tabIndex={-1}>Coach’s assistant</h2><p>League rules · Practice ideas · At-home training</p></div><button className="pr-icon-button" aria-label="Close assistant" onClick={onClose}><X size={20} /></button></header>
    <div className="pr-live-body">
      {allowed ? <CoachAssistant key={`${account.user.id}:${team.id}`} team={team} isCloud repository={repository} initialMode="general" demoPractice practicePlayers={assistantDemoPlayers} summarizePractice={(playerId) => demoAssessmentSummary(assessments?.records, playerId)} />
        : <section className="pr-assistant-access">
          <h3>{account?.loading ? 'Opening your coach account…' : !account?.user ? 'Sign in for a little coaching help.' : account.error ? 'Your account needs to reconnect.' : !team ? 'Connect your coach account.' : 'Coach access is needed.'}</h3>
          <p>{!account?.user ? 'Explore the clubhouse freely. Sign in with an owner or coach account to ask the assistant for league rules and practice ideas.' : account?.error ? 'Reconnect your account before asking the assistant.' : !team ? 'Create or join a team to use the assistant. Practice requests here use the demo’s sample assessments.' : 'Ask your team owner for coach access. The clubhouse demo and its rulebook remain available.'}</p>
          {!account?.loading && (!account?.user ? <Link className="pr-access-button" to="/sign-in">Sign in to Diamond Live</Link> : <button className="pr-access-button" onClick={onAccount}>Open account settings</button>)}
        </section>}
    </div>
  </dialog>;
}

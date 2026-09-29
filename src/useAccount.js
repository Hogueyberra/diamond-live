import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cloudConfigured, configError, supabase } from './supabaseClient.js';
import { createCloudRepository } from './cloudRepository.js';

export function useAccount() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(cloudConfigured);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [teams, setTeams] = useState([]);
  const [activeTeamId, selectTeam] = useState(null);
  const identity = useRef(null);
  const loadSerial = useRef(0);
  const repository = useMemo(() => supabase ? createCloudRepository(supabase) : null, []);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    let authEvent = false;
    const update = (next) => {
      if (!live) return;
      const nextId = next?.user?.id ?? null;
      if (identity.current !== nextId) {
        setProfile(null); setTeams([]); selectTeam(null); setError('');
        setLoading(Boolean(nextId));
      }
      identity.current = nextId; setSession(next);
      if (!nextId) setLoading(false);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => { authEvent = true; update(next); });
    supabase.auth.getSession().then(({ data, error: failure }) => {
      if (!live || authEvent) return;
      if (failure) { setError('Your sign-in could not be restored. Please sign in again.'); setLoading(false); }
      else update(data.session);
    }).catch(() => { if (live && !authEvent) { setError('The account service could not be reached.'); setLoading(false); } });
    return () => { live = false; subscription.unsubscribe(); };
  }, []);
  const userId = session?.user?.id;
  const reload = useCallback(async () => {
    if (!repository || !userId) return;
    const serial = ++loadSerial.current;
    const [nextProfile, nextTeams] = await Promise.all([repository.getProfile(), repository.listTeams()]);
    if (identity.current !== userId || serial !== loadSerial.current) return;
    setProfile(nextProfile); setTeams(nextTeams);
    selectTeam((current) => nextTeams.some((team) => team.id === current) ? current : nextTeams[0]?.id ?? null);
    setError('');
  }, [repository, userId]);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    setLoading(true);
    reload().catch((failure) => { if (live) setError(failure.message || 'Your account could not be loaded.'); }).finally(() => { if (live) setLoading(false); });
    const refresh = () => { if (document.visibilityState !== 'hidden') reload().catch((failure) => { if (live) setError(failure.message); }); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { live = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [userId, reload]);
  const requireAccount = () => { if (!supabase || !userId) throw new Error('Sign in to your account first.'); };
  const throwError = (result) => { if (result.error) throw result.error; return result.data; };
  return {
    configured: cloudConfigured, configError, repository, user: session?.user ?? null, loading, error, profile, teams, activeTeamId,
    setActiveTeamId: (id) => { if (!teams.some((team) => team.id === id)) throw new Error('This team is no longer available to your account.'); selectTeam(id); },
    reload,
    requestCode: async (email) => {
      if (!supabase) throw new Error('Account setup is not complete yet.');
      throwError(await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } }));
    },
    verifyCode: async (email, token) => {
      if (!supabase) throw new Error('Account setup is not complete yet.');
      throwError(await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' }));
    },
    saveProfile: async (name) => { requireAccount(); await repository.saveProfile(name); await reload(); },
    createTeam: async (details) => { requireAccount(); const team = await repository.createTeam(details); await reload(); if (identity.current === userId) selectTeam(team.id); return team; },
    joinTeam: async (code) => { requireAccount(); const team = await repository.joinTeam(code.trim()); await reload(); if (identity.current === userId) selectTeam(team.id); return team; },
    signOut: async () => { if (supabase) throwError(await supabase.auth.signOut({ scope: 'local' })); },
    createInvite: (role) => { requireAccount(); return repository.createInvite(activeTeamId, role); },
    listMembers: () => { requireAccount(); return repository.listMembers(activeTeamId); },
    removeMember: (id) => { requireAccount(); return repository.removeMember(activeTeamId, id); },
    listInvites: () => { requireAccount(); return repository.listInvites(activeTeamId); },
    revokeInvite: (id) => { requireAccount(); return repository.revokeInvite(activeTeamId, id); },
  };
}

import { useEffect, useMemo, useState } from 'react';
import { Button } from '../WorkspaceUI.jsx';
import { ScoutingWorkspace } from '../ScoutingWorkspace.jsx';
import { DevelopmentWorkspace } from '../DevelopmentWorkspace.jsx';
import { createDevelopmentRepository } from '../developmentRepository.js';
import { createFamilyRepository } from '../familyRepository.js';
import { useDevelopment } from '../useDevelopment.js';
import { supabase } from '../supabaseClient.js';

export default function TeamDevelopment({ team, scouting, scoutingRepository, authorId, authorName, activities, events, playerRequest, request, onPendingChange, onAssistant, onReviewDrill }) {
  const [tab, setTab] = useState('assessments');
  const [visitedPlans, setVisitedPlans] = useState(false);
  const [assessmentDirty, setAssessmentDirty] = useState(false);
  const [planDirty, setPlanDirty] = useState(false);
  const [planRequest, setPlanRequest] = useState(null);
  const [notice, setNotice] = useState('');
  const repository = useMemo(() => {
    const repo = createDevelopmentRepository(supabase);
    return { load: () => repo.loadWorkspace(team.id), save: (revision, data, id) => repo.saveWorkspace(team.id, revision, data, id) };
  }, [team.id, authorId]);
  const family = useMemo(() => createFamilyRepository(supabase), [team.id, authorId]);
  const development = useDevelopment({ repository: visitedPlans ? repository : null, scopeKey: visitedPlans ? team.id : null, demo: false, authorId });
  const pending = assessmentDirty || planDirty || scouting.pending || development.pending;
  useEffect(() => { onPendingChange(pending); return () => onPendingChange(false); }, [pending, onPendingChange]);
  useEffect(() => { if (request) { setPlanRequest(request); setTab('plans'); setVisitedPlans(true); } }, [request]);
  useEffect(() => { if (playerRequest) setTab('assessments'); }, [playerRequest]);
  const select = (next) => { if (pending) { setNotice('Finish or discard your open form and resolve pending saves first.'); return false; } setNotice(''); setTab(next); if (next === 'plans') setVisitedPlans(true); return true; };
  const createPlan = (playerId) => { if (select('plans')) setPlanRequest({ key: crypto.randomUUID(), playerId }); };
  return <section aria-label="Team development"><div className="tc-section-tabs" role="group" aria-label="Development section"><Button aria-pressed={tab === 'assessments'} onClick={() => select('assessments')}>Skill assessments</Button><Button aria-pressed={tab === 'plans'} onClick={() => select('plans')}>Development plans</Button></div>{notice && <p role="status" className="tc-notice">{notice}</p>}<div hidden={tab !== 'assessments'}><ScoutingWorkspace team={team} repository={scoutingRepository} store={scouting} authorId={authorId} authorName={authorName} playerRequest={playerRequest} onPendingChange={setAssessmentDirty} onPlanPractice={(id) => onAssistant('practice', id)} onCreateDevelopmentPlan={createPlan} /></div>{visitedPlans && <div hidden={tab !== 'plans'}><DevelopmentWorkspace store={development} team={team} players={scouting.data?.players ?? []} rosterLoading={scouting.loading || Boolean(scouting.error) || scouting.pending} activities={activities} events={events} authorId={authorId} request={planRequest} onPendingChange={setPlanDirty} onPlanPractice={(playerId, snapshot) => onReviewDrill({ ...snapshot, id: snapshot.drillId, coachingCue: snapshot.cue, measure: snapshot.successCheck, ages: [snapshot.minAge, snapshot.maxAge] }, playerId)} isManager={team.role === 'owner'} familyRepository={family} /></div>}</section>;
}

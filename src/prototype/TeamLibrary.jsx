import { useState } from 'react';
import { Button } from '../WorkspaceUI.jsx';
import { DrillLibrary } from '../DrillLibrary.jsx';
import { GuidelinesLibrary } from '../GuidelinesLibrary.jsx';

export default function TeamLibrary({ team, repository, canCoach, disabled, onReviewDrill, onAssignHome }) {
  const [section, setSection] = useState('rules');
  return <section><div className="tc-section-tabs" role="group" aria-label="Library section"><Button aria-pressed={section === 'rules'} onClick={() => setSection('rules')}>League documents</Button><Button aria-pressed={section === 'drills'} onClick={() => setSection('drills')}>Practice and home drills</Button></div><div hidden={section !== 'rules'}><GuidelinesLibrary division={team.division} repository={repository} /></div>{section === 'drills' && <DrillLibrary canReviewRanking={canCoach} disabled={disabled} onSelect={team.role === 'owner' ? onReviewDrill : undefined} onAssignHome={canCoach ? (drill) => onAssignHome(drill.id) : undefined} />}</section>;
}

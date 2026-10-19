import { useEffect, useRef, useState } from 'react';
import { Button } from './WorkspaceUI.jsx';
import { askAssistant } from './assistantClient.js';
import { assessmentSummary, practiceText } from './assistantPractice.js';
import './coachAssistant.css';

const divisions = ['Majors', 'Minor A', 'Minor B', 'Minor C', 'Farm', 'Rookie Ball', 'Tee Ball'];
const prompts = ['Can a Minor B pitcher pitch a fourth inning after only 25 pitches?', 'When can we use a courtesy runner?', 'What happens if we only have eight players?'];
const methods = { 'verified-rule': 'Source-checked rule', 'source-passages': 'Source passages', 'quoted-rule': 'Answer from the source', 'general-chat': 'AI coaching draft', 'guided-practice': 'Guided practice · coach review', clarification: 'More context needed' };

function SourceCard({ source, repository }) {
  const [url, setUrl] = useState(source.url);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (!source.sharedDocumentId || !url) return; const timer = setTimeout(() => setUrl(null), 55_000); return () => clearTimeout(timer); }, [url, source.sharedDocumentId]);
  async function openShared() {
    setBusy(true); setError('');
    try {
      const documents = await repository.list();
      const doc = documents.find((d) => d.id === source.sharedDocumentId);
      if (!doc) throw new Error('This document is no longer available.');
      const href = await repository.getOriginalUrl(doc);
      if (active.current) setUrl(`${href}#page=${source.page}`);
    } catch (e) { if (active.current) setError(e.message); }
    finally { if (active.current) setBusy(false); }
  }
  return <details className="ca-source" open><summary>{source.title} · {source.section} · {source.pages?.length > 1 ? `Pages ${source.pages.join(', ')}` : `Page ${source.page}`}</summary>{source.ocr && <p className="ca-note">Scanned document · Automatically transcribed text may contain errors or omissions. Check the original page before relying on it.</p>}<blockquote>{source.quote}</blockquote>{url ? <a href={url} target="_blank" rel="noreferrer">Read the original page ↗</a> : source.sharedDocumentId && repository ? <Button disabled={busy} onClick={openShared}>{busy ? 'Preparing document…' : 'Get original document'}</Button> : null}{error && <p role="alert">{error}</p>}</details>;
}

function Plan({ plan, coachNote }) {
  const [copied, setCopied] = useState('');
  return <div className="ca-plan"><p>{plan.basis}</p>{coachNote && <p className="ca-note"><strong>AI coaching note:</strong> {coachNote}</p>}{['team', 'home'].map((kind) => { const p = plan[kind]; return <section className="ca-session" key={kind}><h3>{p.title} <span>{p.minutes} minutes</span></h3><p><strong>Equipment:</strong> {p.equipment}</p><p>{p.setup}</p><ol>{p.blocks.map((b, i) => <li key={`${b.id}-${i}`}><strong>{b.start}–{b.end} min · {b.title}</strong><p>{b.steps}</p><p className="ca-cue">“{b.cue}”</p><a href={b.sourceUrl} target="_blank" rel="noreferrer">Related fundamentals ↗</a></li>)}</ol><p><strong>Look for:</strong> {p.success}</p><p className="ca-note">{p.safety}</p><Button onClick={async () => { try { await navigator.clipboard.writeText(practiceText(plan, kind)); setCopied(`${p.title} copied. Review before sharing.`); } catch { setCopied('Copy is unavailable in this browser. Select the instructions above to copy them.'); } }}>Copy {kind === 'home' ? 'parent instructions' : 'team plan'}</Button></section>; })}<p role="status">{copied}</p></div>;
}

export function CoachAssistant({ team, scoutingData, isCloud, repository }) {
  const [mode, setMode] = useState('rules');
  const [division, setDivision] = useState(divisions.includes(team.division) ? team.division : 'Minor B');
  const [year, setYear] = useState('2026');
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [practice, setPractice] = useState({ age: 8, players: 8, coaches: 2, teamMinutes: 15, homeMinutes: 10 });
  const [playerId, setPlayerId] = useState('');
  const controller = useRef(null); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  const summary = assessmentSummary(scoutingData, playerId);
  const players = scoutingData?.players?.filter((p) => !p.archived) ?? [];
  async function submit(e) {
    e?.preventDefault(); if (busy || (mode !== 'practice' && !question.trim())) return;
    const asked = mode === 'practice' ? 'Create a team practice and a parent version.' : question.trim();
    controller.current = new AbortController(); setBusy(true); setError('');
    try {
      const result = await askAssistant({ teamId: team.id, mode, division, year, question: asked, practice: { ...practice, summary, individual: Boolean(playerId) } }, { isCloud, signal: controller.current.signal });
      if (alive.current) { setHistory((h) => [...h.slice(-9), { question: asked, ...result }]); setQuestion(''); }
    } catch (reason) { if (alive.current && reason.name !== 'AbortError') setError(reason.message); }
    finally { if (alive.current) setBusy(false); }
  }
  return <section className="ca-root" aria-labelledby="assistant-title"><div className="cw-page-heading"><h1 className="cl-h1" id="assistant-title">A little help for your next play.</h1><p>Ask about your league’s rules, plan useful reps, or work through a coaching question.</p></div>
    <div className="ca-modes" role="group" aria-label="Assistant mode">{[['rules', 'League rules'], ['practice', 'Practice plan'], ['general', 'Coaching chat']].map(([id, label]) => <Button key={id} aria-pressed={mode === id} disabled={busy} onClick={() => { setMode(id); setError(''); }}>{label}</Button>)}</div>
    <form className="cl-card ca-compose" onSubmit={submit}>
      {mode === 'rules' && <><p className="ca-note">HVLL documents and your shared team library. Select the division and season for this question. Earlier documents may differ; missing rules need league confirmation.</p><div className="ca-fields"><label>Division<select className="cl-input" value={division} disabled={busy} onChange={(e) => setDivision(e.target.value)}>{divisions.map((d) => <option key={d}>{d}</option>)}</select></label><label>Season<select className="cl-input" value={year} disabled={busy} onChange={(e) => setYear(e.target.value)}><option>2026</option><option>2024</option></select></label></div><div className="ca-examples">{prompts.map((p) => <button type="button" key={p} disabled={busy} onClick={() => setQuestion(p)}>{p}</button>)}</div></>}
      {mode === 'practice' ? <><p className="ca-note">Use recorded skill assessments to select simple activities. Plans use tennis balls and clear grass, with a parent version ready for your review. No names or rankings are sent to the assistant.</p><label>Practice focus<select className="cl-input" value={playerId} disabled={busy} onChange={(e) => setPlayerId(e.target.value)}><option value="">Team priorities</option>{players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><p>{summary.length ? `${summary.length} assessed skills available for this focus.` : 'No assessments yet. A beginner fielding plan will be provided.'}</p><div className="ca-fields">{[['age', 'Age', 5, 12], ['players', 'Children at team practice', 1, 24], ['coaches', 'Coaches', 1, 8], ['teamMinutes', 'Team minutes', 10, 90], ['homeMinutes', 'Home minutes', 5, 30]].map(([key, label, min, max]) => <label key={key}>{label}<input className="cl-input" type="number" min={min} max={max} required value={practice[key]} disabled={busy} onChange={(e) => setPractice({ ...practice, [key]: Number(e.target.value) })} /></label>)}</div></> : <label>{mode === 'rules' ? 'Your rules question' : 'Your coaching question'}<textarea className="cl-input" rows={3} maxLength={2000} required value={question} disabled={busy} placeholder={mode === 'rules' ? 'For example: When can we use a courtesy runner?' : 'For example: How can I keep waiting players engaged?'} onChange={(e) => setQuestion(e.target.value)} /></label>}
      <div className="ca-actions"><Button variant="primary" type="submit" disabled={busy}>{busy ? 'Preparing your answer…' : mode === 'practice' ? 'Build practice plan' : 'Ask assistant'}</Button>{busy && <Button onClick={() => controller.current?.abort()}>Cancel</Button>}{history.length > 0 && <Button disabled={busy} onClick={() => setHistory([])}>Clear conversation</Button>}</div>
      {busy && <p role="status">Checking your request. Detailed explanations may take a few seconds.</p>}{error && <p role="alert" className="cw-alert">{error}</p>}
    </form>
    <div className="ca-history" aria-label="Assistant answers">{[...history].reverse().map((entry, index) => <article key={history.length - index} className="cl-card ca-answer"><h2>{entry.question}</h2><p className="ca-method">{methods[entry.method]} · {(entry.elapsedMs / 1000).toFixed(1)}s</p>{entry.plan ? <Plan plan={entry.plan} coachNote={entry.coachNote} /> : <p className="ca-prose">{entry.answer}</p>}{entry.sources?.map((source) => <SourceCard key={source.id} source={source} repository={repository} />)}</article>)}</div>
    <p className="ca-note">Each question is checked independently. Include the situation in follow-ups. Review explanations against the cited rules and approve practice instructions before sharing with families.</p>
  </section>;
}

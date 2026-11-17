import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { ArrowLeft, CheckCircle, Diamond, UserCircle } from '@phosphor-icons/react';
import { AccountPanel } from './AccountPanel.jsx';
import { Button, Field } from './WorkspaceUI.jsx';
import { createFamilyRepository } from './familyRepository.js';
import { createFamilyDemoRepository } from './familyDemo.js';
import { FAMILY_OUTCOMES, familyPlanKey } from './familyPractice.js';
import { useFamilyPractice } from './useFamilyPractice.js';
import { supabase } from './supabaseClient.js';
import './coaching.css';
import './familyPractice.css';

const dateText = (value) => value ? new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }) : '';
const helperText = (helper) => helper === 'solo' ? 'You can play on your own. An adult checks the space and readiness first.' : helper === 'partner' ? 'Play with a partner. An adult checks the space and readiness first.' : 'Play with an adult supervising.';

export function MyPracticeGateway({ account, demo = false, repository: suppliedRepository }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const repository = useMemo(() => suppliedRepository ?? (demo ? createFamilyDemoRepository() : account.user && supabase?.rpc ? createFamilyRepository(supabase) : null), [suppliedRepository, demo, account.user?.id]);
  const preventLoss = () => { if (pending) throw new Error('Finish or discard your open reflection, or clear the invitation code, before leaving My Practice or signing out.'); };
  const leave = (event) => { event?.preventDefault(); try { preventLoss(); navigate(demo ? '/preview' : '/'); } catch (reason) { setError(reason.message); } };
  const safeAccount = { ...account, signOut: () => { preventLoss(); return account.signOut(); }, verifyCode: (...args) => { preventLoss(); return account.verifyCode(...args); }, setActiveTeamId: (...args) => { preventLoss(); return account.setActiveTeamId(...args); } };
  useEffect(() => { if (!pending) setError(''); }, [pending]);
  if (demo && account.user) return <Navigate to="/my-practice" replace />;
  return <div className="coaching-workspace fp-workspace">
    <header className="fp-header"><Link to={demo ? '/preview' : '/'} className="cw-brand" onClick={leave}><Diamond size={23} weight="bold" />Diamond Live</Link><div><Button onClick={leave}><ArrowLeft size={16} />{demo ? 'Coaching demo' : 'Home'}</Button>{!demo && <Button onClick={() => setAccountOpen(true)}><UserCircle size={20} />{account.user ? 'My account' : 'Sign in'}</Button>}</div></header>
    {error && <p className="cw-alert" role="alert">{error}</p>}
    {demo && <p className="fp-demo" role="status">Sample family preview · Alex is a fictional player. Reflections stay in this tab and are cleared when you leave.</p>}
    {!demo && !account.user ? <main className="fp-main"><span className="cl-badge">For players & families</span><h1 className="cl-h1">A little practice. A lot of play.</h1><p>Sign in with the adult email your team owner invited. Then enter your family invitation code to open your child’s home challenges.</p><Button variant="primary" onClick={() => setAccountOpen(true)}>Sign in to My Practice</Button>{account.loading && <p role="status">Checking your account…</p>}</main>
      : !repository ? <main className="fp-main"><h1>My Practice</h1><p role="alert">Family practice storage is not configured.</p></main>
        : <MyPractice key={demo ? 'family-demo' : account.user.id} repository={repository} demo={demo} onPendingChange={setPending} />}
    {accountOpen && <AccountPanel key={account.user?.id ?? 'signed-out'} account={safeAccount} onClose={() => setAccountOpen(false)} />}
  </div>;
}

export function MyPractice({ repository, demo = false, onPendingChange }) {
  const store = useFamilyPractice(repository);
  const [childId, setChildId] = useState('');
  const [childView, setChildView] = useState(false);
  const [code, setCode] = useState('');
  const [form, setForm] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const mounted = useRef(true);
  const children = store.data?.children ?? [];
  const child = children.find((item) => item.linkId === childId) ?? children[0];
  const plans = (store.data?.plans ?? []).filter((item) => item.teamId === child?.teamId && item.playerId === child?.playerId).sort((a,b) => Number(a.status === 'closed') - Number(b.status === 'closed'));
  const formPlan = store.data?.plans.find((item) => familyPlanKey(item) === form?.key);
  const changed = form && formPlan && (form.needsReview || formPlan.version !== form.version || formPlan.status !== 'active');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onPendingChange?.(Boolean(form || busy || code)); return () => onPendingChange?.(false); }, [form, busy, code, onPendingChange]);
  useEffect(() => {
    if (!form && !busy && !code) return;
    const unload = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', unload); return () => window.removeEventListener('beforeunload', unload);
  }, [form, busy, code]);
  useEffect(() => {
    if (form && !formPlan && !store.loading) { setForm(null); setAttempt(null); setError('That home plan is no longer available. Your open reflection was cleared.'); }
  }, [form, formPlan, store.loading]);
  async function run(operation, success) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try { const result = await operation(); if (mounted.current) await success?.(result); }
    catch (reason) { if (mounted.current) { setError(reason.message); if (reason.code === '42501') { store.clear(); setForm(null); setAttempt(null); } if (reason.code === '40001') { setAttempt(null); setForm((current) => current ? { ...current, needsReview: true } : null); void store.refresh().catch(() => {}); } } }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  const begin = (plan, outcome) => { if (form && form.key !== familyPlanKey(plan)) { setError('Finish or discard your open reflection first.'); return; } setError(''); setMessage(''); setForm((previous) => previous ?? { key: familyPlanKey(plan), id: crypto.randomUUID(), teamId: plan.teamId, planId: plan.id, version: plan.version, outcome, reflection: '', fun: null }); if (form) setForm((previous) => ({ ...previous, outcome })); };
  const discard = () => { if (!lock.current) { setForm(null); setAttempt(null); setError(''); setMessage('Open reflection discarded. If a previous request reached the server, it will appear after refreshing.'); } };
  const save = (event) => {
    event.preventDefault();
    if (!formPlan || (changed && !attempt)) return;
    const draft = attempt ?? { id: form.id, teamId: form.teamId, planId: form.planId, version: form.version, outcome: form.outcome, reflection: form.reflection.trim(), fun: form.fun };
    setAttempt(draft);
    void run(() => repository.save(draft), async () => { setForm(null); setAttempt(null); setMessage(demo ? 'Sample reflection saved in this tab.' : 'Reflection shared with your coach. Thanks for checking in!'); await store.refresh().catch(() => {}); });
  };
  return <main className="fp-main" id="my-practice-main">
    <div className="fp-heading"><div><span className="cl-badge">My Practice</span><h1 className="cl-h1">{childView ? 'Ready for a little play?' : 'Small steps, at your pace.'}</h1><p>A short challenge, an easier choice, and a chance to tell your coach how it felt.</p></div><div className="fp-actions"><Button disabled={busy || Boolean(form || code)} onClick={() => { void store.refresh().catch(() => {}); }}>Refresh challenges</Button><Button aria-pressed={childView} onClick={() => setChildView(!childView)}>{childView ? 'Family view' : 'Player view'}</Button></div></div>
    <p className="fp-boundary">{childView ? 'Use this with your grown-up. It’s okay to make it easier, choose another game, or skip today.' : 'An adult opens this view for their child. Choose what fits today; home practice is optional and never changes a player’s rating.'}</p>
    {(error || store.error) && <p className="cw-alert" role="alert">{error || store.error}</p>}{message && <p className="cw-success" role="status"><CheckCircle size={20} />{message}</p>}
    {store.loading && <p role="status">Opening your family’s challenges…</p>}
    {children.length > 0 && <div className="fp-child"><Field label="Player"><select className="cl-select" value={child?.linkId ?? ''} disabled={busy || Boolean(form)} onChange={(event) => { setChildId(event.target.value); setError(''); }}>{children.map((item) => <option value={item.linkId} key={item.linkId}>{item.playerName} · {item.teamName}</option>)}</select></Field><span>Linked by your team owner</span></div>}
    {!store.loading && store.data && !children.length && <section className="cl-card fp-empty"><h2>Your family starts here.</h2><p>Ask your team owner for a family invitation addressed to the adult email you used to sign in. You can join My Practice without joining the team’s coaching workspace.</p></section>}
    {child && !plans.length && <section className="cl-card fp-empty"><h2>No home challenge yet.</h2><p>Your coach will choose a goal and home activity when it fits {child.playerName}. There’s nothing to catch up on.</p></section>}
    <div className="fp-plan-list">{plans.map((plan) => {
      const open = form?.key === familyPlanKey(plan);
      const reflections = (store.data?.reflections ?? []).filter((item) => item.teamId === plan.teamId && item.planId === plan.id);
      return <article className="cl-card fp-plan" key={familyPlanKey(plan)}>
        <div className="fp-plan-top"><span className="cl-badge">{plan.status === 'active' ? 'Your challenge' : 'Finished plan'} · v{plan.version}</span>{plan.followUpDate && <span>Optional check-in · {dateText(plan.followUpDate)}</span>}</div>
        <h2>{plan.goal}</h2><HomeChallenge snapshot={plan.home} />
        {plan.alternateHome && <details className="fp-alternate"><summary>Try another activity · {plan.alternateHome.title}</summary><HomeChallenge snapshot={plan.alternateHome} /></details>}
        {plan.status === 'active' ? <section className="fp-reflect" aria-label={`Reflection for ${plan.goal}`}><h3>How did it go?</h3><p>A quick check-in helps your coach choose what’s next. No score, streak, or missed-day penalty.</p><div className="fp-outcomes">{FAMILY_OUTCOMES.map(([value, label]) => <Button key={value} disabled={busy || Boolean(attempt) || Boolean(form && !open) || Boolean(changed && open)} aria-pressed={open && form.outcome === value} onClick={() => begin(plan, value)}>{label}</Button>)}</div>
          {open && <form onSubmit={save} className="cw-form"><fieldset disabled={busy || Boolean(attempt) || Boolean(changed)}><Field label="Tell your coach · optional"><textarea className="cl-textarea" maxLength={1000} value={form.reflection} onChange={(event) => setForm({ ...form, reflection: event.target.value })} placeholder="What was fun? What felt tricky?" /></Field><Field label="How fun was it? · optional"><select className="cl-select" value={form.fun ?? ''} onChange={(event) => setForm({ ...form, fun: event.target.value ? Number(event.target.value) : null })}><option value="">Skip this</option><option value="3">Really fun</option><option value="2">It was okay</option><option value="1">Try something different</option></select></Field></fieldset>
            {changed && <div className="cw-alert"><p>The coach changed this plan. Your reflection is still here. Review the current instructions above.</p>{formPlan.status === 'active' && <><Button disabled={busy || Boolean(attempt) || Boolean(form.needsReview && formPlan.version === form.version)} onClick={() => { setForm({ ...form, id: crypto.randomUUID(), version: formPlan.version, needsReview: false }); setError(''); }}>Use current instructions</Button>{form.needsReview && formPlan.version === form.version && <Button disabled={busy} onClick={() => { void store.refresh().catch(() => {}); }}>Refresh current instructions</Button>}</>}</div>}
            {attempt && !busy && <p>Your last request could not be confirmed. Retry sends the same reflection once.</p>}
            <div className="fp-actions"><Button type="submit" variant="primary" disabled={busy || Boolean(changed && !attempt)}>{busy ? 'Sharing…' : attempt ? 'Retry sharing' : demo ? 'Save sample reflection' : 'Share with coach'}</Button><Button disabled={busy} onClick={discard}>Discard reflection</Button></div>
          </form>}</section> : <p className="fp-boundary">Your coach closed this plan. Earlier reflections stay below.</p>}
        {open && plan.status === 'closed' && <Button disabled={busy} onClick={discard}>Discard open reflection</Button>}
        {reflections.length > 0 && <details className="fp-history"><summary>Your reflections · {reflections.length}</summary>{reflections.map((item) => <div key={item.id}><strong>{FAMILY_OUTCOMES.find(([key]) => key === item.outcome)?.[1]}</strong><p>{new Date(item.createdAt).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })} · Plan v{item.version}{item.fun ? ` · ${['', 'Try something different', 'It was okay', 'Really fun'][item.fun]}` : ''}</p>{item.reflection && <p>{item.reflection}</p>}</div>)}</details>}
      </article>;
    })}</div>
    {!demo && <details className="fp-invite" open={!children.length}><summary>Link another child with a family code</summary><form className="cw-form" onSubmit={(event) => { event.preventDefault(); void run(() => repository.claim(code.trim()), async () => { setCode(''); setMessage('Family invitation accepted.'); await store.refresh().catch(() => {}); }); }}><p>The code works only with the verified adult email the owner invited. It expires after seven days and can be used once.</p><Field label="Family invitation code"><input className="cl-input ac-code-input" autoComplete="off" spellCheck={false} value={code} maxLength={64} required disabled={busy || Boolean(form)} onChange={(event) => setCode(event.target.value)} /></Field><div className="fp-actions"><Button variant="primary" type="submit" disabled={busy || Boolean(form)}>{busy ? 'Linking…' : 'Accept family invitation'}</Button>{code && <Button disabled={busy} onClick={() => setCode('')}>Clear code</Button>}</div></form></details>}
    <footer className="fp-footer">{demo ? 'Sample family · no real account or child records' : 'Your family’s home challenges · only shared with your team’s coaches'}</footer>
  </main>;
}

function HomeChallenge({ snapshot }) {
  return <section className="fp-challenge"><div className="fp-drill-heading"><h3>{snapshot.title}</h3><span>Up to {snapshot.minutes} min · Ages {snapshot.minAge}–{snapshot.maxAge}</span></div><p>{snapshot.objective}</p><p className="fp-helper">{helperText(snapshot.helper)} Finish sooner whenever needed.</p><div className="fp-setup"><div><h4>You’ll need</h4><p>{snapshot.equipment || 'No equipment'}</p></div><div><h4>Make a little space</h4><p>{snapshot.setup}</p></div></div><ol className="fp-steps">{snapshot.steps.map((step, index) => <li key={index}>{step}</li>)}</ol><div className="fp-cue"><span>One thing to remember</span><strong>{snapshot.cue || snapshot.successCheck}</strong></div><div className="fp-options"><div><h4>Make it easier</h4><p>{snapshot.easier}</p></div><div><h4>A fun challenge</h4><p>{snapshot.challenge}</p></div></div><details className="fp-readiness" open><summary>Before you start</summary><p>{snapshot.safetyNote}</p><p><strong>Look for:</strong> {snapshot.successCheck}</p></details>{snapshot.sourceGuide && <p className="fp-source">Adapted from {snapshot.sourceGuide} · {snapshot.sourceActivity}</p>}{snapshot.sourceUrl && <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">Skill reference ↗</a>}</section>;
}

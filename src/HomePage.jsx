import { useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Baseball, BookOpen, CalendarDots, ChartLineUp, CheckCircle, Diamond, Heart, LockKey, MagnifyingGlass, Target, UsersThree } from '@phosphor-icons/react';
import './homepage.css';

const FEATURES = [
  { id: 'schedule', icon: CalendarDots, label: 'Plan your week', title: 'A little preparation. A better day on the field.', text: 'Keep games and practices together. Give your team one place to find the time, location, and plan.' },
  { id: 'coaching', icon: Target, label: 'Give every practice a purpose', title: 'Turn “let’s work on that” into a plan.', text: 'Capture a coaching observation, choose a practice activity, and record what improved. Make your next session count.' },
  { id: 'rules', icon: BookOpen, label: 'Find the rule you need', title: 'The right reference, right when you need it.', text: 'Search division rules and team documents. Open the original passage and page reference, so you can coach with clarity.' },
  { id: 'development', icon: ChartLineUp, label: 'See each player’s progress', title: 'A clearer picture. A useful next step.', text: 'Assess ten baseball skills, organize your draft board, and set focused development goals. Keep evaluations between coaches.' },
];

function SchedulePreview() {
  return <div className="hp-preview-content">
    <div className="hp-preview-heading"><div><span>Team schedule</span><h3>A good week starts here.</h3></div><CalendarDots size={28} /></div>
    <div className="hp-preview-agenda"><div className="hp-preview-date"><span>WED</span><strong>30</strong></div><div><span className="hp-preview-tag">Practice</span><h4>Infield fundamentals</h4><p>4:30 PM · Community field</p></div><ArrowUpRight size={22} /></div>
    <div className="hp-preview-agenda"><div className="hp-preview-date"><span>SAT</span><strong>03</strong></div><div><span className="hp-preview-tag hp-tag-lavender">Game</span><h4>Angels vs. Tigers</h4><p>10:00 AM · Community field</p></div><ArrowUpRight size={22} /></div>
    <div className="hp-preview-note"><CheckCircle size={21} /><span>One shared schedule. Ready on your phone or laptop.</span></div>
  </div>;
}

function CoachingPreview() {
  return <div className="hp-preview-content">
    <div className="hp-preview-heading"><div><span>Coaching to practice</span><h3>Notice it. Work on it.</h3></div><Target size={28} /></div>
    <div className="hp-observation"><span>Coach observation</span><h4>Build a ready glove</h4><p>Get the glove down early and receive the ball in front.</p></div>
    <div className="hp-plan-connector"><ArrowDown size={22} /> Coach reviews & plans</div>
    <div className="hp-practice"><div><span>Practice activity</span><strong>Ready-position reps</strong></div><span>10 min</span><p>Look for: a balanced starting position before each ground ball.</p></div>
  </div>;
}

function RulesPreview() {
  return <div className="hp-preview-content">
    <div className="hp-preview-heading"><div><span>Rules library</span><h3>Bring the source with you.</h3></div><BookOpen size={28} /></div>
    <div className="hp-search-example"><MagnifyingGlass size={21} /><span>playing time</span><span>Example search</span></div>
    <div className="hp-rule-example"><span className="hp-preview-tag hp-tag-lavender">Minor B</span><h4>Playing time rotation</h4><p>Find the original rule, its conditions, and the page it came from.</p><div><BookOpen size={17} /><span>2026 HVLL bylaws · p. 26</span></div></div>
    <div className="hp-preview-note"><CheckCircle size={21} /><span>Search by topic. Filter by division. Check the source.</span></div>
  </div>;
}

function DevelopmentPreview() {
  return <div className="hp-preview-content">
    <div className="hp-preview-heading"><div><span>Player development</span><h3>Small steps. Visible progress.</h3></div><ChartLineUp size={28} /></div>
    <div className="hp-player-example"><span className="hp-player-avatar">A</span><div><strong>Alex · Sample player</strong><span>Infield · Glove fielding</span></div><LockKey size={20} aria-label="Coach-only evaluation" /></div>
    <div className="hp-progress-example" aria-label="Illustrative skill progress: baseline 4 out of 10, check-in 6 out of 10"><div><span>Baseline</span><strong>4.0<small>/10</small></strong><i style={{ '--progress': '40%' }} /></div><ArrowRight size={25} /><div><span>Coach check-in</span><strong>6.0<small>/10</small></strong><i style={{ '--progress': '60%' }} /></div></div>
    <div className="hp-preview-note"><Target size={21} /><span>A focused goal. Purposeful reps. A coach’s reassessment.</span></div>
    <p className="hp-preview-fineprint">Illustrative scores. Practice logs track effort; coaches reassess skill improvement.</p>
  </div>;
}

const PREVIEWS = { schedule: SchedulePreview, coaching: CoachingPreview, rules: RulesPreview, development: DevelopmentPreview };
const FAQS = [
  ['Who is Diamond Live for?', 'Diamond Live is being built for youth baseball coaches who want to organize their team and give every player a clear next step. Our first pilot is rooted in Little League coaching.'],
  ['Do I need to download an app?', 'No download is needed. Open Diamond Live in your phone or computer’s browser. Sign in with an email code to create or join a team and access your shared workspace across devices.'],
  ['Who can see player evaluations?', 'Only the team’s owner and coaches can view scouting evaluations, draft rankings, and individual development goals. Player and family progress views are planned for a later release.'],
  ['Can we stream games or get video insights?', 'Game streaming, highlights, and coaching insights from video are planned. Today, Diamond Live supports shared schedules, coach-created practice plans, searchable rules, and coach-led player assessments.'],
];

export function HomePage({ onSignIn, onExploreDemo }) {
  const [feature, setFeature] = useState(0);
  const tabs = useRef([]);
  const current = FEATURES[feature];
  const Preview = PREVIEWS[current.id];
  const tabKey = (event, index) => {
    const next = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? (index + 1) % FEATURES.length : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? (index + FEATURES.length - 1) % FEATURES.length : event.key === 'Home' ? 0 : event.key === 'End' ? FEATURES.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); setFeature(next); tabs.current[next]?.focus();
  };
  return <div className="hp-page" id="home-top">
    <a className="hp-skip" href="#home-main">Skip to content</a>
    <header className="hp-header hp-container">
      <a className="hp-brand" href="#home-top" aria-label="Diamond Live home"><Diamond size={28} weight="bold" /><span>Diamond Live</span></a>
      <nav aria-label="Homepage"><a href="#tools">The tools</a><a href="#how-it-works">How it works</a><a href="#our-purpose">Our purpose</a></nav>
      <div className="hp-header-actions"><button className="hp-login" onClick={onSignIn}>Sign in</button><button className="hp-button hp-button-primary" onClick={onSignIn}>Start your team<ArrowUpRight size={18} /></button></div>
    </header>
    <main id="home-main" tabIndex={-1}>
      <section className="hp-hero hp-container" aria-labelledby="home-title">
        <div className="hp-hero-copy"><h1 id="home-title">Great seasons.<br /><span>Lifelong<br className="hp-desktop-break" /> athletes.</span></h1><p>Plan the week. Coach with purpose. Help every player build the skills—and the confidence—to keep coming back.</p><div className="hp-hero-actions"><button className="hp-button hp-button-primary" onClick={onSignIn}>Start your team<ArrowUpRight size={21} /></button><button className="hp-demo-button" onClick={onExploreDemo}>Explore the demo<ArrowRight size={21} /></button></div><div className="hp-hero-footnote"><Baseball size={19} /><span>Made for youth baseball. Ready in your browser.</span></div></div>
        <div className="hp-hero-visual"><img src={`${import.meta.env.BASE_URL}images/coaching-moment.jpg`} width="1536" height="1024" fetchPriority="high" alt="A coach encourages two young baseball players during practice." /><div className="hp-photo-caption"><span className="hp-caption-icon"><Heart size={26} weight="bold" /></span><p>Every player.<br /><strong>A reason to keep playing.</strong></p></div><span className="hp-photo-corner" aria-hidden="true"><Diamond size={42} weight="bold" /></span></div>
      </section>
      <div className="hp-promise-strip hp-container"><span><CalendarDots size={22} />A prepared team</span><span><Target size={22} />A purposeful practice</span><span><ChartLineUp size={22} />A player moving forward</span></div>

      <section id="tools" className="hp-tools hp-container" aria-labelledby="tools-title">
        <div className="hp-section-heading"><h2 id="tools-title">Your coaching week.<br />All in one place.</h2><p>Spend your energy on the kids. Keep the schedule, the plan, and the next step together in Diamond Live.</p></div>
        <div className="hp-tools-layout"><div className="hp-tool-navigation"><div role="tablist" aria-label="Explore Diamond Live features" aria-orientation="vertical">{FEATURES.map((item, index) => <button key={item.id} id={`feature-${item.id}`} role="tab" type="button" aria-selected={index === feature} aria-controls={`preview-${item.id}`} tabIndex={index === feature ? 0 : -1} ref={(element) => { tabs.current[index] = element; }} onClick={() => setFeature(index)} onKeyDown={(event) => tabKey(event, index)}><item.icon size={23} /><span>{item.label}</span><ArrowUpRight size={20} /></button>)}</div><div className="hp-tool-description"><h3>{current.title}</h3><p>{current.text}</p><button className="hp-text-button" onClick={onExploreDemo}>Try it in the demo<ArrowRight size={20} /></button></div></div>
          <div className="hp-product-preview" role="tabpanel" id={`preview-${current.id}`} aria-labelledby={`feature-${current.id}`} tabIndex={0}><div className="hp-preview-top"><span><Diamond size={18} />Diamond Live</span><span>Interactive preview · Sample data</span></div><Preview /></div>
        </div>
      </section>

      <section id="how-it-works" className="hp-how hp-container" aria-labelledby="how-title"><div className="hp-section-heading"><h2 id="how-title">Easy to start.<br />Built for the season.</h2><p>From your first sign-in to your next practice, you’re in control.</p></div><ol className="hp-steps"><li><span className="hp-step-number">01</span><h3>Make it your team.</h3><p>Sign in with an email code. Create your team or join with an invitation from your team owner.</p><UsersThree size={31} /></li><li><span className="hp-step-number">02</span><h3>Give the week a plan.</h3><p>Add games and practices, keep your rules close, and turn observations into focused activities.</p><CalendarDots size={31} /></li><li><span className="hp-step-number">03</span><h3>Keep progress moving.</h3><p>Assess skills, choose a goal, and revisit it after practice. See what’s improving and what comes next.</p><ChartLineUp size={31} /></li></ol></section>

      <section id="our-purpose" className="hp-purpose hp-container" aria-labelledby="purpose-title"><div className="hp-purpose-panel"><div className="hp-purpose-copy"><h2 id="purpose-title">Help them love<br />the next practice.</h2><p>Our mission is to help create lifelong athletes. That starts with coaches who see potential, make space to learn, and celebrate the small wins.</p><p>A clearer goal. A little more confidence. Another reason to show up.</p><a href="#tools" className="hp-purpose-link">See how we support coaches<ArrowUpRight size={22} /></a></div><div className="hp-purpose-values"><div><Heart size={29} /><h3>Keep the joy.</h3><p>Make learning feel worth coming back for.</p></div><div><Target size={29} /><h3>Give growth a direction.</h3><p>A specific skill and a next step for every player.</p></div><div><UsersThree size={29} /><h3>See the whole athlete.</h3><p>Use scores to guide encouragement and practice.</p></div></div></div></section>

      <section className="hp-faq hp-container" aria-labelledby="faq-title"><div><h2 id="faq-title">A few things<br />to know.</h2><p>Built with coaches.<br />Growing with the game.</p></div><div className="hp-faq-list">{FAQS.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>

      <section className="hp-final hp-container" aria-labelledby="start-title"><div><h2 id="start-title">Your next great<br />practice starts here.</h2><p>Bring your team together. Give every player a next step.</p></div><div className="hp-final-actions"><button className="hp-button hp-button-primary" onClick={onSignIn}>Start your team<ArrowUpRight size={21} /></button><button className="hp-demo-button" onClick={onExploreDemo}>Explore before signing in<ArrowRight size={20} /></button></div></section>
    </main>
    <footer className="hp-footer hp-container"><div><a className="hp-brand" href="#home-top"><Diamond size={25} weight="bold" /><span>Diamond Live</span></a><p>Great seasons. Lifelong athletes.</p></div><nav aria-label="Footer"><a href="#tools">The tools</a><a href="#our-purpose">Our purpose</a><button onClick={onExploreDemo}>Explore the demo</button><button onClick={onSignIn}>Sign in</button></nav><span className="hp-copyright">© {new Date().getFullYear()} Diamond Live</span></footer>
  </div>;
}

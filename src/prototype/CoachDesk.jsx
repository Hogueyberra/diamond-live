import { useRef, useState } from "react";
import {
  ArrowUpRight,
  Baseball,
  BookOpen,
  CalendarBlank,
  Check,
  CheckCircle,
  ClipboardText,
  Clock,
  Flag,
  Lightbulb,
  MagnifyingGlass,
  Notebook,
  Sparkle,
  Target,
  Users,
  X,
} from "@phosphor-icons/react";
import "./coach-desk.css";

const initialReviews = [
  {
    id: 1,
    player: "Mason Brooks",
    initials: "MB",
    type: "DEVELOPMENT",
    title: "Turn an observation into his next rep.",
    description:
      "Mason’s contact point drifts behind his front foot. Give him a clear cue for his next reps.",
    evidence: "Coach Jordan · Batting observation · Oct 14",
    finding:
      "The sample observation records contact drifting behind the front foot. A simple tee progression gives Mason a repeatable setup and a clear target in front of the plate.",
    drill: "Contact-point tee progression",
    duration: "8 min · Hitting station",
    outcome: "Add one focused hitting block to a sample practice draft.",
    color: "clay",
  },
  {
    id: 2,
    player: "Fielding group",
    initials: "FG",
    type: "PRACTICE PLAN",
    title: "Make the next throw a good one.",
    description:
      "Ground-ball footwork is a development focus. A short station can give the group purposeful reps.",
    evidence: "Sample development plan · Oct 14",
    finding:
      "The sample development plan focuses on setting the feet before the throw. Group practice can reinforce fielding, gathering, and aiming at a clear target.",
    drill: "Field, gather, aim",
    duration: "12 min · Infield",
    outcome: "Add a shared footwork station to a sample practice draft.",
    color: "blue",
  },
  {
    id: 3,
    player: "Saturday practice",
    initials: "SP",
    type: "COACH COVERAGE",
    title: "Put a coach at every station.",
    description: "The infield block is ready. It still needs someone to lead it.",
    evidence: "Practice draft · Sat, Oct 17 · 9:00 AM",
    finding:
      "The sample practice has three stations and two assigned coaches. Coach Jordan is listed as available during the infield rotation.",
    drill: "Assign Coach Jordan to infield fundamentals",
    duration: "20 min · Infield",
    outcome: "Mark the sample infield station as covered.",
    color: "green",
  },
];
const stations = [
  {
    name: "Development",
    route: "development",
    icon: Target,
    area: "Batting cage",
    detail: "Observe. Plan. Improve.",
  },
  {
    name: "Players",
    route: "players",
    icon: Users,
    area: "Team dugout",
    detail: "Know your whole roster.",
  },
  {
    name: "Library",
    route: "library",
    icon: Notebook,
    area: "Equipment wall",
    detail: "The right drill, ready.",
  },
  {
    name: "Calendar",
    route: "calendar",
    icon: CalendarBlank,
    area: "Planning desk",
    detail: "Make every practice count.",
  },
];

export default function CoachDesk({
  onNavigate = () => {},
  onOpenAssistant = () => {},
  onOpenRules = () => {},
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const [selected, setSelected] = useState(null);
  const [activity, setActivity] = useState([
    {
      title: "Saturday’s practice draft is ready",
      detail: "3 stations · 60 minutes · Coach Jordan",
      time: "8:42 AM",
      icon: ClipboardText,
    },
    {
      title: "Two new player observations",
      detail: "Mason Brooks and Noah Martinez · Hitting & fielding",
      time: "8:30 AM",
      icon: MagnifyingGlass,
    },
    {
      title: "Fall development check-in added",
      detail: "Roster assessment · October 22",
      time: "Yesterday",
      icon: CalendarBlank,
    },
  ]);
  const [announcement, setAnnouncement] = useState("");
  const dialog = useRef(null);
  const openReview = (review) => {
    setSelected(review);
    dialog.current.showModal();
  };
  const resolve = (review, approved) => {
    setReviews((current) => current.filter((item) => item.id !== review.id));
    setActivity((current) => [
      {
        title: approved ? review.drill : `Suggestion dismissed: ${review.player}`,
        detail: approved
          ? "Approved by you · Updated in this prototype"
          : "Reviewed by you · No changes made",
        time: "Just now",
        icon: approved ? CheckCircle : Flag,
      },
      ...current,
    ]);
    setAnnouncement(
      approved
        ? `${review.drill} approved in the prototype.`
        : `Suggestion for ${review.player} dismissed.`,
    );
    if (dialog.current.open) dialog.current.close();
  };
  return (
    <div className="pd-desk">
      <div className="pd-desk-heading">
        <div>
          <div className="pd-eyebrow">FRIDAY, OCTOBER 16</div>
          <h1>A good day to get better.</h1>
          <p>Your team, your next practice, and a few things worth a look.</p>
        </div>
        <div className="pd-readiness">
          <ClipboardText size={29} weight="duotone" />
          <div>
            <strong>
              Next practice <span>In planning</span>
            </strong>
            <small>Sample team · Coach Jordan</small>
          </div>
        </div>
      </div>
      <div className="pd-desk-grid">
        <section className="pd-field-card" aria-labelledby="pd-clubhouse-title">
          <div className="pd-stage-heading">
            <div>
              <span className="pd-eyebrow">YOUR COACHING WORKSPACE</span>
              <h2 id="pd-clubhouse-title">Welcome to the clubhouse.</h2>
            </div>
            <span className="pd-live-tag">
              <span />
              Fall ball · 2026
            </span>
          </div>
          <div
            className="pd-clubhouse-art pd-interactive-map"
            role="group"
            aria-label="Explore the clubhouse"
          >
            <img
              src={`${import.meta.env.BASE_URL}prototype/clubhouse.png`}
              alt="Illustrated baseball clubhouse with a diamond, training stations, batting cages, and a team dugout."
            />
            {stations.map(({ name, route, icon: Icon, area }) => (
              <button
                key={route}
                className={`pd-map-zone pd-map-${route}`}
                aria-label={`${area}: open ${name}`}
                onClick={() => onNavigate(route)}
              >
                <span className="pd-map-pin">
                  <Icon size={17} weight="bold" />
                  <span>
                    <strong>{name}</strong>
                    <small>{area}</small>
                  </span>
                  <ArrowUpRight size={12} />
                </span>
              </button>
            ))}
            <button
              className="pd-map-umpire"
              aria-label="Umpire behind home plate: Consult the Rules"
              onClick={onOpenRules}
            >
              <img
                className="pd-umpire-figure"
                src={`${import.meta.env.BASE_URL}prototype/umpire.png`}
                alt=""
                aria-hidden="true"
                draggable="false"
              />
              <span className="pd-umpire-label">
                <BookOpen size={15} />
                <strong>Consult the Rules</strong>
                <ArrowUpRight size={12} />
              </span>
            </button>
            <div className="pd-art-note">
              <Baseball size={17} weight="fill" />
              Pick a place. Get to work.
            </div>
          </div>
          <div className="pd-stations">
            {stations.map(({ name, route, icon: Icon, detail }) => (
              <button key={route} onClick={() => onNavigate(route)}>
                <span className={`pd-station-icon pd-${route}`}>
                  <Icon size={22} />
                </span>
                <span>
                  <strong>{name}</strong>
                  <small>{detail}</small>
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
          <div className="pd-next-practice">
            <div className="pd-date-tile">
              <span>OCT</span>
              <strong>17</strong>
            </div>
            <div className="pd-next-copy">
              <span className="pd-eyebrow">NEXT UP</span>
              <h3>Saturday team practice</h3>
              <p>
                9:00–10:00 AM <span>·</span> Riverside Field
              </p>
            </div>
            <button className="pd-text-button" onClick={() => onNavigate("calendar")}>
              View practice <ArrowUpRight size={16} />
            </button>
          </div>
        </section>
        <div className="pd-priority-column">
          <section className="pd-review-panel" aria-labelledby="pd-review-title">
            <div className="pd-panel-heading">
              <span className="pd-panel-icon">
                <Flag size={20} />
              </span>
              <div>
                <h2 id="pd-review-title">
                  A coach’s eye needed <span>{reviews.length}</span>
                </h2>
                <p>You make the call. We’ll keep things moving.</p>
              </div>
            </div>
            <div className="pd-review-list">
              {reviews.map((review) => (
                <article className="pd-review-card" key={review.id}>
                  <div className="pd-review-kicker">
                    <span className={`pd-review-dot pd-dot-${review.color}`} />
                    {review.type}
                    <span>{review.player}</span>
                  </div>
                  <h3>{review.title}</h3>
                  <p>{review.description}</p>
                  <div className="pd-review-footer">
                    <span>
                      <Lightbulb size={14} />
                      Suggested next step
                    </span>
                    <button onClick={() => openReview(review)}>
                      Review <ArrowUpRight size={14} />
                    </button>
                  </div>
                </article>
              ))}
              {!reviews.length && (
                <div className="pd-all-reviewed">
                  <CheckCircle size={36} weight="duotone" />
                  <h3>You’re all caught up.</h3>
                  <p>Every suggestion has had a coach’s eye.</p>
                  <button className="pd-text-button" onClick={() => onNavigate("development")}>
                    Explore development <ArrowUpRight />
                  </button>
                </div>
              )}
            </div>
            <div className="pd-prototype-label">
              <span />
              Sample team data · Changes stay in this session
            </div>
          </section>
          <section className="pd-activity-panel" aria-labelledby="pd-activity-title">
            <div className="pd-activity-heading">
              <h2 id="pd-activity-title">Around the team</h2>
              <Clock size={17} />
            </div>
            <div className="pd-activity-list">
              {activity.slice(0, 4).map((item, index) => (
                <div className="pd-activity-row" key={`${item.title}-${index}`}>
                  <span className="pd-activity-icon">
                    <item.icon size={17} />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                    <time>{item.time}</time>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      <button className="pd-assistant-prompt" onClick={onOpenAssistant}>
        <span className="pd-assistant-star">
          <Sparkle size={22} weight="fill" />
        </span>
        <span>
          <strong>A second set of eyes, whenever you need it.</strong>
          <small>Ask about player development, practice ideas, or your team’s next steps.</small>
        </span>
        <span className="pd-assistant-cta">
          Ask the coach assistant <ArrowUpRight size={17} />
        </span>
      </button>
      <span className="pd-sr-only" role="status">
        {announcement}
      </span>
      <dialog
        className="pd-review-dialog"
        aria-labelledby="pd-dialog-title"
        aria-describedby="pd-dialog-scope"
        ref={dialog}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <div className="pd-dialog-top">
              <span className="pd-eyebrow">REVIEW A SUGGESTION</span>
              <button aria-label="Close review" onClick={() => dialog.current.close()}>
                <X size={20} />
              </button>
            </div>
            <div className={`pd-dialog-avatar pd-avatar-${selected.color}`}>
              {selected.initials}
            </div>
            <h2 id="pd-dialog-title">{selected.title}</h2>
            <p className="pd-dialog-player">{selected.player}</p>
            <div className="pd-dialog-section">
              <h3>What we observed</h3>
              <p>{selected.finding}</p>
              <small>{selected.evidence}</small>
            </div>
            <div className="pd-dialog-proposal">
              <Target size={22} />
              <div>
                <span className="pd-eyebrow">PROPOSED NEXT STEP</span>
                <h3>{selected.drill}</h3>
                <p>{selected.duration}</p>
              </div>
            </div>
            <p className="pd-dialog-outcome" id="pd-dialog-scope">
              {selected.outcome} This preview updates sample data only.
            </p>
            <div className="pd-dialog-actions">
              <button onClick={() => resolve(selected, false)}>Dismiss suggestion</button>
              <button onClick={() => resolve(selected, true)}>
                <Check size={17} /> Approve in prototype
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}

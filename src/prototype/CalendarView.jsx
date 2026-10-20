import React, { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  Clock,
  MapPin,
  Users,
  CheckCircle,
  ClipboardText,
} from "@phosphor-icons/react";
import "./calendar-library.css";

const EVENTS = [
  {
    id: "mon",
    day: 0,
    hour: 16,
    title: "Fielding foundations",
    type: "Practice",
    location: "Riverside Field · Diamond 2",
    time: "4:00–5:15 PM",
    coach: "Coach Jordan",
    support: "Coach Lee",
    status: "Plan ready",
    note: "Ground-ball reads, a quiet glove, and a clear next throw.",
    blocks: [
      "10 min · Movement & throwing warm-up",
      "20 min · Quiet glove grounders",
      "20 min · Field, gather, aim",
      "25 min · Situational play & team reset",
    ],
  },
  {
    id: "wed",
    day: 2,
    hour: 16,
    title: "Contact & confidence",
    type: "Practice",
    location: "Riverside Field · Batting cages",
    time: "4:30–5:30 PM",
    coach: "Coach Jordan",
    support: "Open assignment",
    status: "Needs coverage",
    note: "Build balanced contact with a small-group station rotation.",
    blocks: [
      "10 min · Warm-up & readiness check",
      "20 min · Balanced tee swings",
      "20 min · Short target throws",
      "10 min · Team reflection",
    ],
  },
  {
    id: "fri",
    day: 4,
    hour: 17,
    title: "Coach check-in",
    type: "Team meeting",
    location: "Riverside Field · Clubhouse",
    time: "5:00–5:30 PM",
    coach: "Coach Lee",
    support: "Coach Jordan",
    status: "Ready",
    note: "Review observations and prepare Saturday’s practice plan.",
    blocks: ["15 min · Player observations", "15 min · Game preparation"],
  },
  {
    id: "sat",
    day: 5,
    hour: 9,
    title: "Saturday team practice",
    type: "Practice",
    location: "Riverside Field",
    time: "9:00–10:00 AM",
    coach: "Coach Jordan",
    support: "Coach Lee · one station open",
    status: "Needs coverage",
    note: "Three focused stations, sixty minutes together. Two coaches are assigned; infield needs a station coach.",
    blocks: [
      "20 min · Throwing station · Coach Jordan",
      "20 min · Hitting station · Coach Lee",
      "20 min · Infield station · Unassigned",
    ],
  },
];
const dateFor = (offset, day = 0) => new Date(2026, 9, 12 + offset * 7 + day);
const fmt = (date, options) => date.toLocaleDateString("en-US", options);
export default function CalendarView({ onNavigate }) {
  const detailRef = useRef(null);
  function showEvent(event) {
    setSelected(event);
    if (window.matchMedia?.('(max-width: 760px)').matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView?.({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }));
    }
  }
  const [week, setWeek] = useState(0);
  const [mode, setMode] = useState("Week");
  const [selected, setSelected] = useState(EVENTS[3]);
  const events = week === 0 ? EVENTS : [];
  return (
    <section className="pcl-view">
      <div className="pcl-heading">
        <div>
          <span className="pcl-eyebrow">MAKE ROOM FOR PROGRESS</span>
          <h1>Every rep starts here.</h1>
          <p>A shared rhythm for practices, game days, and the people behind them.</p>
        </div>
        <div className="pcl-heading-stat">
          <strong>{events.length}</strong>
          <span>
            team events
            <br />
            this week
          </span>
        </div>
      </div>
      <div className="pcl-toolbar">
        <div className="pcl-date-nav">
          <button
            aria-label="Previous week"
            onClick={() => {
              setWeek(week - 1);
              setSelected(null);
            }}
          >
            <ArrowLeft size={17} />
          </button>
          <h2>
            {fmt(dateFor(week), { month: "long", day: "numeric" })} –{" "}
            {fmt(dateFor(week, 6), { month: "short", day: "numeric", year: "numeric" })}
          </h2>
          <button
            aria-label="Next week"
            onClick={() => {
              setWeek(week + 1);
              setSelected(null);
            }}
          >
            <ArrowRight size={17} />
          </button>
          <button
            onClick={() => {
              setWeek(0);
              setSelected(EVENTS[3]);
            }}
          >
            This week
          </button>
        </div>
        <div className="pcl-segment" aria-label="Calendar display">
          {["Week", "Agenda"].map((item) => (
            <button
              key={item}
              aria-pressed={mode === item}
              className={mode === item ? "active" : ""}
              onClick={() => setMode(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="pcl-calendar-layout">
        <div className="pcl-calendar-main">
          {mode === "Week" ? (
            <div className="pcl-week-scroll">
              <div className="pcl-week">
                <div className="pcl-week-header">
                  <span>PT</span>
                  {Array.from({ length: 7 }, (_, day) => (
                    <div key={day} className={week === 0 && day === 4 ? "pcl-today" : ""}>
                      <span>{fmt(dateFor(week, day), { weekday: "short" })}</span>
                      <strong>{dateFor(week, day).getDate()}</strong>
                      {week === 0 && day === 4 && <small>Today</small>}
                    </div>
                  ))}
                </div>
                <div className="pcl-week-body">
                  <div className="pcl-hours">
                    {["9 AM", "11 AM", "1 PM", "3 PM", "5 PM", "7 PM"].map((time) => (
                      <span key={time}>{time}</span>
                    ))}
                  </div>
                  {Array.from({ length: 7 }, (_, day) => (
                    <div className={`pcl-day ${day > 4 ? "pcl-weekend" : ""}`} key={day}>
                      {events
                        .filter((e) => e.day === day)
                        .map((e) => (
                          <button
                            key={e.id}
                            className={`pcl-event ${e.type === "Game" ? "pcl-game" : ""} ${selected?.id === e.id ? "pcl-selected" : ""}`}
                            style={{ top: `${(e.hour - 9) * 8.3}%` }}
                            onClick={() => showEvent(e)}
                          >
                            <span>{e.type}</span>
                            <strong>{e.title}</strong>
                            <small>{e.time}</small>
                            <span className="pcl-event-dot">{e.status}</span>
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="pcl-agenda">
              {events.map((e) => (
                <button
                  key={e.id}
                  className={
                    selected?.id === e.id ? "pcl-agenda-row pcl-selected" : "pcl-agenda-row"
                  }
                  onClick={() => showEvent(e)}
                >
                  <span className="pcl-agenda-date">
                    <small>{fmt(dateFor(week, e.day), { weekday: "short" })}</small>
                    <strong>{dateFor(week, e.day).getDate()}</strong>
                  </span>
                  <span>
                    <small>
                      {e.type} · {e.time}
                    </small>
                    <strong>{e.title}</strong>
                    <span>{e.location}</span>
                  </span>
                  <ArrowRight size={20} />
                </button>
              ))}
            </div>
          )}
          {events.length === 0 && (
            <div className="pcl-empty">
              <CalendarBlank size={32} />
              <h3>A little breathing room.</h3>
              <p>No sample events in this week.</p>
              <button
                onClick={() => {
                  setWeek(0);
                  setSelected(EVENTS[3]);
                }}
              >
                Back to the sample week
              </button>
            </div>
          )}
          <div className="pcl-calendar-footer">
            <span>
              <i className="pcl-dot" /> Practice
            </span>
            <span>
              <i className="pcl-dot pcl-blue" /> Game
            </span>
            <span>All times Pacific · Synthetic demo schedule</span>
          </div>
        </div>
        <aside ref={detailRef} className="pcl-detail" aria-live="polite">
          {selected && week === 0 ? (
            <>
              <span className="pcl-eyebrow">
                {fmt(dateFor(0, selected.day), { weekday: "long", month: "long", day: "numeric" })}
              </span>
              <h2>{selected.title}</h2>
              <span
                className={`pcl-badge ${selected.status === "Needs coverage" ? "pcl-badge-warm" : ""}`}
              >
                {selected.status}
              </span>
              <div className="pcl-detail-meta">
                <p>
                  <Clock size={18} />
                  {selected.time}
                </p>
                <p>
                  <MapPin size={18} />
                  {selected.location}
                </p>
                <p>
                  <Users size={18} />
                  Angels · Minor B
                </p>
              </div>
              <p>{selected.note}</p>
              <div className="pcl-divider" />
              <h3>Coach coverage</h3>
              <div className="pcl-coach">
                <span className="pcl-avatar">CJ</span>
                <span>
                  <strong>{selected.coach}</strong>
                  <small>Session lead</small>
                </span>
                <CheckCircle size={20} />
              </div>
              <div className="pcl-coach">
                <span className="pcl-avatar pcl-avatar-soft">
                  {selected.support === "Open assignment" ? "+" : "CL"}
                </span>
                <span>
                  <strong>{selected.support}</strong>
                  <small>
                    {selected.status === "Needs coverage"
                      ? "One station needs a coach"
                      : "Station support"}
                  </small>
                </span>
              </div>
              <div className="pcl-divider" />
              <h3>{selected.type === "Practice" ? "Practice outline" : "Run of show"}</h3>
              <ol className="pcl-blocks">
                {selected.blocks.map((block) => (
                  <li key={block}>{block}</li>
                ))}
              </ol>
              <button className="pcl-primary" onClick={() => onNavigate?.("library")}>
                <ClipboardText size={18} />
                Explore practice drills
                <ArrowRight size={18} />
              </button>
              <small className="pcl-muted">
                Demo planning preview. No team schedule is changed.
              </small>
            </>
          ) : (
            <div className="pcl-empty">
              <CalendarBlank size={32} />
              <h3>See the whole picture.</h3>
              <p>Select an event to see its plan and coach coverage.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

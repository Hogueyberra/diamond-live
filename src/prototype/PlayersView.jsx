import React, { useEffect, useRef, useState } from "react";
import { MagnifyingGlass, ArrowRight, Baseball, ClipboardText } from "@phosphor-icons/react";
import PlayerAssessment, { AssessmentGuide, AssessmentHistory } from "./PlayerAssessment.jsx";
import {
  DEMO_PLAYERS as players,
  ASSESSMENT_SKILLS,
  assessmentHistory,
  playerSnapshot,
  formatAssessmentDate,
} from "./playerAssessments.js";
import "./players-development.css";

const tone = (status) =>
  status === "Plan ready" ? "clay" : status === "On track" ? "green" : "gold";

export default function PlayersView({
  onNavigate,
  assessments,
  selectedPlayerId,
  playerSelectionVersion,
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All players");
  const [selected, setSelected] = useState(12);
  const [assessing, setAssessing] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (players.some((player) => player.id === Number(selectedPlayerId))) {
      setSelected(Number(selectedPlayerId));
      setNotice("");
    }
  }, [selectedPlayerId, playerSelectionVersion]);
  const detailRef = useRef(null);
  const selectPlayer = (id) => {
    setSelected(id);
    setNotice("");
    if (window.matchMedia?.("(max-width:760px)").matches) {
      detailRef.current?.scrollIntoView?.({
        block: "start",
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  };
  const visible = players.filter(
    (p) =>
      (filter === "All players" || p.status === filter) &&
      `${p.name} ${p.id} ${p.position} ${p.focus}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const player = players.find((p) => p.id === selected);
  const snapshot = playerSnapshot(player.id, assessments.records);
  const history = assessmentHistory(player.id, assessments.records);
  const latest = history[0];
  const entered = assessments.records.filter((entry) => entry.playerId === player.id);
  const observedCount = ASSESSMENT_SKILLS.filter(({ id }) => snapshot[id].value !== null).length;
  return (
    <section className="pp-view">
      <div className="pp-title-row">
        <div>
          <span className="pp-eyebrow">THE ROSTER</span>
          <h1>Every player. A next step.</h1>
          <p>Bring observations, development, and the next practice together.</p>
        </div>
        <div className="pp-top-stat">
          <strong>06</strong>
          <span>demo players</span>
        </div>
      </div>
      <div className="pp-toolbar">
        <label className="pp-search">
          <MagnifyingGlass size={18} />
          <input
            aria-label="Search players"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, number, position…"
          />
        </label>
        <div className="pp-filters" aria-label="Player status filters">
          {["All players", "Plan ready", "Needs observation", "On track"].map((s) => (
            <button
              key={s}
              aria-pressed={filter === s}
              className={filter === s ? "pp-filter pp-active" : "pp-filter"}
              onClick={() => setFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="pp-player-grid">
        <div className="pp-card pp-roster">
          <div className="pp-card-heading">
            <h2>Team roster</h2>
            <span>{visible.length} players</span>
          </div>
          <div className="pp-list-head">
            <span>PLAYER</span>
            <span>DEVELOPMENT FOCUS</span>
            <span>SAMPLE PLAN STATUS</span>
          </div>
          {visible.length ? (
            visible.map((p) => (
              <button
                key={p.id}
                className={`pp-player-row ${selected === p.id ? "pp-selected" : ""}`}
                onClick={() => selectPlayer(p.id)}
                aria-pressed={selected === p.id}
              >
                <span className="pp-player-identity">
                  <span className="pp-number">{p.id}</span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.position}</small>
                  </span>
                </span>
                <span className="pp-row-focus">
                  {p.focus}
                  <small>
                    {assessments.records.some((entry) => entry.playerId === p.id)
                      ? "Assessment recorded"
                      : "Example · Oct 14"}
                  </small>
                </span>
                <span className={`pp-pill pp-${tone(p.status)}`}>{p.status}</span>
              </button>
            ))
          ) : (
            <div className="pp-empty">
              <MagnifyingGlass size={28} />
              <h3>No players found</h3>
              <p>Try another name, position, or status.</p>
              <button
                className="pp-secondary"
                onClick={() => {
                  setQuery("");
                  setFilter("All players");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
          <div className="pp-roster-foot">
            <Baseball size={19} />
            <span>
              Synthetic roster for exploring the prototype.
              <br />
              Your team records remain in the existing workspace.
            </span>
          </div>
        </div>
        <article ref={detailRef} className="pp-card pp-player-detail">
          <div className="pp-detail-banner">
            <span className="pp-big-number">{player.id}</span>
            <div>
              <span className="pp-eyebrow">PLAYER PROFILE</span>
              <h2>{player.name}</h2>
              <p>{player.position}</p>
            </div>
          </div>
          <div className="pp-detail-body">
            <div className="pp-section-label">
              <h3>Skill snapshot</h3>
              <span className="pp-pill pp-green">{observedCount}/4 observed</span>
            </div>
            <p className="pa-snapshot-intro">
              Latest observation for each skill · 1–10 coach ratings. Record a baseline or reassess
              after practice.
            </p>
            <button
              className="pp-primary pp-full pa-player-action"
              onClick={() => setAssessing(true)}
              disabled={assessments.corrupt}
            >
              <ClipboardText size={18} />
              Record assessment
            </button>
            {notice && (
              <p className="pa-notice" role="status">
                {notice}
              </p>
            )}
            {assessments.corrupt && (
              <p className="pa-error" role="alert">
                Saved assessments could not be read. Existing data has been kept; editing is paused.
              </p>
            )}
            <div className="pp-skill-list">
              {ASSESSMENT_SKILLS.map(({ id, label }) => {
                const { value, source, previous } = snapshot[id];
                return (
                  <div
                    className="pa-snapshot-skill"
                    key={id}
                    role="group"
                    aria-label={`${label}: ${value === null ? "Unobserved" : `${value} out of 10`}`}
                  >
                    <div className="pp-skill-row">
                      <span>{label}</span>
                      <span className="pp-skill-track" aria-hidden="true">
                        {value !== null && <span style={{ width: `${value * 10}%` }} />}
                      </span>
                      <strong>{value === null ? "Unobserved" : `${value}/10`}</strong>
                    </div>
                    <small>
                      {source
                        ? `${source.sample ? "Sample baseline" : source.coach} · ${formatAssessmentDate(source.observedOn)}`
                        : "Ready for a first observation"}
                      {previous !== null && (
                        <span className="pa-change">
                          {" "}
                          ·{" "}
                          {value === previous
                            ? "Same as previous"
                            : `${value > previous ? "+" : ""}${value - previous} since previous`}
                        </span>
                      )}
                    </small>
                  </div>
                );
              })}
            </div>
            <AssessmentGuide />
            <div className="pp-note">
              <ClipboardText size={19} />
              <div>
                <strong>Latest coach observation</strong>
                <p>{latest.notes}</p>
                <small>
                  {latest.sample ? "Sample baseline · " : ""}
                  {latest.coach} · {formatAssessmentDate(latest.observedOn)} · {latest.context}
                </small>
              </div>
            </div>
            <h3>Sample development goal</h3>
            <p className="pp-goal">{player.goal}</p>
            <AssessmentHistory key={player.id} history={history} />
            <button
              className="pp-secondary pp-full"
              onClick={() => onNavigate?.("development", player.id)}
            >
              Review development plan <ArrowRight size={17} />
            </button>
            <p className="pp-footnote">
              {assessments.persistent
                ? "Assessments save in this browser only."
                : "Browser storage unavailable. Changes last for this session only."}{" "}
              Practice completion does not change ratings.
            </p>
          </div>
        </article>
      </div>
      {assessing && (
        <PlayerAssessment
          player={player}
          snapshot={snapshot}
          defaultCoach={entered.at(-1)?.coach || ""}
          onClose={() => setAssessing(false)}
          onSave={(form) => {
            const result = assessments.add(form);
            setNotice(
              result.persistent
                ? "Assessment saved. Your skill snapshot and history are updated."
                : "Assessment kept for this session only. Browser storage is unavailable; it will not survive a reload.",
            );
            setAssessing(false);
          }}
        />
      )}
    </section>
  );
}

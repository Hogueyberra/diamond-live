import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  ClipboardText,
  PencilSimple,
  Timer,
  Flag,
} from "@phosphor-icons/react";
import "./players-development.css";
import DevelopmentResources from "./DevelopmentResources.jsx";
import { assessmentHistory, playerSnapshot, formatAssessmentDate } from "./playerAssessments.js";

const examples = [
  {
    id: 12,
    name: "Noah Martinez",
    number: "12",
    focus: "Ground-ball footwork",
    status: "Plan proposed",
    categoryId: "fielding",
    observation: "Gets to the ball early, but throws before setting the feet.",
    drill: "Ground-ball approach & set",
    cue: "Field, replace the feet, find the target, then throw.",
    goal: "8 accurate throws out of 10 routine grounders.",
  },
  {
    id: 4,
    name: "Mason Brooks",
    number: "4",
    focus: "Contact point",
    status: "Plan proposed",
    categoryId: "hitting",
    observation: "Contact drifts behind the front foot during the tee station.",
    drill: "Contact-point tee progression",
    cue: "Set the tee in front and finish through the center of the ball.",
    goal: "Repeat a balanced contact point on 8 of 10 swings.",
  },
  {
    id: 7,
    name: "Eli Thompson",
    number: "7",
    focus: "Receiving",
    status: "Needs observation",
    skill: "Receiving · Unobserved",
    observation: "No receiving assessment has been recorded in this example.",
    drill: "Receiving observation station",
    cue: "Observe 10 easy catches and record a coaching note.",
    goal: "Record an observation before assigning a skill rating.",
  },
  {
    id: 22,
    name: "Lucas Chen",
    number: "22",
    focus: "First-step reads",
    status: "Plan proposed",
    categoryId: "fielding",
    observation: "Consistent first step on fly balls during the last fielding station.",
    drill: "Fly-ball first-step station",
    cue: "Read the ball, take a balanced first step, and work behind the catch.",
    goal: "Repeat a balanced first step on five consecutive fly-ball reads.",
  },
  {
    id: 18,
    name: "Oliver Davis",
    number: "18",
    focus: "Throwing accuracy",
    status: "Plan proposed",
    categoryId: "throwing",
    observation: "Accurate throws to a target during the partner throwing station.",
    drill: "Partner target throwing",
    cue: "Choose a small target and repeat a balanced throwing motion.",
    goal: "Maintain a consistent target through the throwing progression.",
  },
  {
    id: 9,
    name: "Leo Wilson",
    number: "9",
    focus: "Baserunning",
    status: "Needs observation",
    categoryId: "baserunning",
    observation: "Baserunning has not been observed in this example assessment.",
    drill: "First-to-third observation",
    cue: "Observe a practice situation and record the decision before rating.",
    goal: "Record a baserunning observation before assigning a skill rating.",
  },
];

export default function DevelopmentView({
  onNavigate,
  selectedPlayerId,
  playerSelectionVersion,
  videoLibrary,
  assessments,
  active = true,
}) {
  const [selected, setSelected] = useState(12);
  const assessmentRef = useRef(null);
  const selectPlayer = (id) => {
    setSelected(id);
    if (window.matchMedia?.("(max-width:760px)").matches) {
      assessmentRef.current?.scrollIntoView?.({
        block: "start",
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  };
  useEffect(() => {
    if (examples.some((player) => player.id === Number(selectedPlayerId)))
      setSelected(Number(selectedPlayerId));
  }, [selectedPlayerId, playerSelectionVersion]);
  const [plans, setPlans] = useState({});
  const [attachedByPlayer, setAttachedByPlayer] = useState({});
  const player = examples.find((p) => p.id === selected) || examples[0];
  const snapshot = playerSnapshot(player.id, assessments.records);
  const category = player.categoryId && snapshot[player.categoryId];
  const source = category?.source;
  const latest = assessmentHistory(player.id, assessments.records)[0];
  const skillLabel = player.categoryId
    ? `${player.categoryId[0].toUpperCase()}${player.categoryId.slice(1)} · ${category.value === null ? "Unobserved" : `${category.value}/10`}`
    : player.skill;
  const plan = plans[player.id] || {
    minutes: 12,
    cue: player.cue,
    approved: false,
    completed: false,
  };
  const update = (patch) => setPlans((prev) => ({ ...prev, [player.id]: { ...plan, ...patch } }));
  const approved = Object.values(plans).filter((p) => p.approved).length;
  const observedFocuses = examples.filter(
    (item) =>
      item.categoryId &&
      playerSnapshot(item.id, assessments.records)[item.categoryId].value !== null,
  ).length;
  return (
    <section className="pp-view">
      <div className="pp-title-row">
        <div>
          <span className="pp-eyebrow">PLAYER DEVELOPMENT</span>
          <h1>Observation into action.</h1>
          <p>A coach-led path from what you see to what you practice.</p>
        </div>
        <span className="pp-demo-label">Interactive demo · changes reset on reload</span>
      </div>
      <div className="pp-pipeline">
        {[
          {
            n: String(observedFocuses).padStart(2, "0"),
            label: "Focuses observed",
            sub: `${examples.length - observedFocuses} more need observation`,
          },
          { n: "04", label: "Plans proposed", sub: "Plus 2 observation stations" },
          {
            n: String(approved).padStart(2, "0"),
            label: "Coach approved",
            sub: "In this demo session",
          },
          {
            n: String(Object.values(plans).filter((p) => p.completed).length).padStart(2, "0"),
            label: "Practice completed",
            sub: "Recorded in this demo",
          },
        ].map((s, i) => (
          <div key={s.label} className="pp-pipeline-item">
            <strong>{s.n}</strong>
            <span>
              <b>{s.label}</b>
              <small>{s.sub}</small>
            </span>
            {i < 3 && <ArrowRight size={17} />}
          </div>
        ))}
      </div>
      <div className="pp-development-grid">
        <aside className="pp-card">
          <div className="pp-card-heading">
            <h2>Development queue</h2>
            <span>6 examples</span>
          </div>
          {examples.map((p) => (
            <button
              key={p.id}
              className={`pp-queue-player ${player.id === p.id ? "pp-selected" : ""}`}
              onClick={() => selectPlayer(p.id)}
              aria-pressed={player.id === p.id}
            >
              <span className="pp-number">{p.number}</span>
              <span>
                <strong>{p.name}</strong>
                <small>{p.focus}</small>
                <span
                  className={`pp-pill pp-${plans[p.id]?.approved ? "green" : p.status === "Needs observation" ? "gold" : "clay"}`}
                >
                  {plans[p.id]?.completed
                    ? "Completed"
                    : plans[p.id]?.approved
                      ? "Approved"
                      : p.status}
                </span>
              </span>
            </button>
          ))}
          <div className="pp-queue-note">
            <Flag size={20} />
            <p>
              Progress starts with evidence.
              <br />
              No observation? Schedule one first.
            </p>
          </div>
        </aside>
        <article ref={assessmentRef} className="pp-card pp-assessment">
          <div className="pp-card-heading">
            <div>
              <span className="pp-eyebrow">
                {source && !source.sample ? "COACH OBSERVATION" : "SAMPLE ASSESSMENT"} · 1–10 RUBRIC
              </span>
              <h2>{player.name}</h2>
            </div>
            <span className="pp-number">{player.number}</span>
          </div>
          <div className="pp-detail-body">
            <div className="pp-section-label">
              <h3>What the coach observed</h3>
              <ClipboardText size={20} />
            </div>
            <p className="pp-observation">“{source?.notes || player.observation}”</p>
            <div className="pp-source">
              <span>{source?.coach || "Coach Jordan"}</span>
              <span>{formatAssessmentDate(source?.observedOn || "2026-10-14")}</span>
              <span>{skillLabel}</span>
            </div>
            {!latest.sample && latest.id !== source?.id && (
              <p className="pp-muted" style={{ marginTop: 14 }}>
                A newer assessment covers other skills. This practice focus keeps its own
                observation.
              </p>
            )}
            <button className="pp-text-button" onClick={() => onNavigate?.("players", player.id)}>
              Update ratings in Players <ArrowRight size={16} />
            </button>
            <div className="pp-evidence-box">
              <span className="pp-eyebrow">FOCUS FOR THE NEXT PRACTICE</span>
              <h3>{player.focus}</h3>
              <p>{player.goal}</p>
            </div>
            <h3>Keep the loop moving</h3>
            <ol className="pp-next-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>Observe</strong>
                  <p>Capture a specific baseball skill and coaching note.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Practice deliberately</strong>
                  <p>Review the proposed drill and adjust the coaching cue.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Observe again</strong>
                  <p>
                    Record the outcome at the next session. Ratings are never updated automatically.
                  </p>
                </div>
              </li>
            </ol>
            <button className="pp-text-button" onClick={() => onNavigate?.("players", player.id)}>
              Back to player profiles <ArrowRight size={16} />
            </button>
          </div>
        </article>
        <article className="pp-card pp-plan">
          <div className="pp-plan-heading">
            <PencilSimple size={22} />
            <div>
              <h2>Practice proposal</h2>
              <small>Editable · coach review required</small>
            </div>
          </div>
          <div className="pp-detail-body">
            <span className="pp-eyebrow">SUGGESTED STATION</span>
            <h3 className="pp-drill-name">{player.drill}</h3>
            <p className="pp-muted">
              A sample drill for this focus. Reassessing updates the observation; review this
              proposal separately before using it.
            </p>
            <label className="pp-field">
              Station duration{" "}
              <span className="pp-duration">
                <Timer size={18} />
                <input
                  type="number"
                  min="5"
                  max="30"
                  value={plan.minutes}
                  disabled={plan.approved}
                  onChange={(e) => update({ minutes: e.target.value })}
                />{" "}
                minutes
              </span>
            </label>
            <label className="pp-field">
              Coaching cue
              <textarea
                value={plan.cue}
                disabled={plan.approved}
                onChange={(e) => update({ cue: e.target.value })}
                rows={4}
              />
            </label>
            <DevelopmentResources
              player={player}
              library={videoLibrary}
              attached={attachedByPlayer[player.id] || []}
              onAttach={(id) =>
                setAttachedByPlayer((current) => {
                  const ids = current[player.id] || [];
                  return {
                    ...current,
                    [player.id]: ids.includes(id)
                      ? ids.filter((item) => item !== id)
                      : [...ids, id],
                  };
                })
              }
              locked={plan.approved}
              onNavigate={onNavigate}
              active={active}
            />
            <div className="pp-plan-summary">
              <strong>Review checklist</strong>
              <p>
                Player: {player.name}
                <br />
                Focus: {player.focus}
                <br />
                Outcome: {player.goal}
              </p>
            </div>
            {plan.approved ? (
              <div className="pp-success" role="status">
                <CheckCircle size={23} />
                <div>
                  <strong>
                    {plan.completed
                      ? "Practice recorded as complete"
                      : "Proposal approved in this demo"}
                  </strong>
                  <p>
                    {plan.completed
                      ? "Next step: observe the skill again. No rating has changed."
                      : "Your edited proposal is ready for a practice block. No existing team plan has changed."}
                  </p>
                </div>
              </div>
            ) : (
              <button
                className="pp-primary pp-full"
                disabled={!plan.cue.trim() || Number(plan.minutes) < 5 || Number(plan.minutes) > 30}
                onClick={() => update({ approved: true })}
              >
                Approve practice proposal <CheckCircle size={18} />
              </button>
            )}
            {plan.approved && !plan.completed && (
              <button className="pp-secondary pp-full" onClick={() => update({ completed: true })}>
                Record demo practice complete
              </button>
            )}
            {plan.approved && (
              <button
                className="pp-text-button"
                onClick={() => update({ approved: false, completed: false })}
              >
                Edit proposal
              </button>
            )}
            <p className="pp-footnote">
              Local prototype only. No assignments or messages are sent. No production records are
              saved.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import { ClipboardText, X } from "@phosphor-icons/react";
import {
  ASSESSMENT_SKILLS,
  ASSESSMENT_CONTEXTS,
  RATING_ANCHORS,
  emptyAssessmentRatings,
  localAssessmentDate,
  formatAssessmentDate,
} from "./playerAssessments.js";
import "./player-assessment.css";

export function AssessmentGuide() {
  return (
    <details className="pa-guide">
      <summary>How to score · 1–10 guide</summary>
      <p>
        Use the same drill and expectations for the player’s age and experience. These anchors
        describe what you observed; use the numbers between them for intermediate performance.
      </p>
      <dl>
        {RATING_ANCHORS.map((anchor) => (
          <div key={anchor.value}>
            <dt>
              <b>{anchor.value}</b> {anchor.label}
            </dt>
            <dd>{anchor.description}</dd>
          </div>
        ))}
      </dl>
      <p>
        Leave a skill unobserved when you haven’t seen it. A missed observation is never a zero.
        These four category ratings are separate from detailed scouting evaluations.
      </p>
    </details>
  );
}

export function AssessmentHistory({ history }) {
  const [limit, setLimit] = useState(5);
  return (
    <details className="pa-history">
      <summary>
        Assessment history{" "}
        <span>{history.filter((entry) => !entry.sample).length} recorded + sample baseline</span>
      </summary>
      <p className="pp-muted">
        Newest observation date first. Reassessments keep earlier entries. To correct a score,
        record a new entry for the same observation date.
      </p>
      <ol>
        {history.slice(0, limit).map((entry) => (
          <li key={entry.id}>
            <div className="pa-history-heading">
              <strong>{formatAssessmentDate(entry.observedOn)}</strong>
              <span>{entry.sample ? "Sample baseline" : entry.context}</span>
            </div>
            <small>
              {entry.coach}
              {entry.sample ? " · Fictional example" : " · Coach-entered"}
            </small>
            <div className="pa-history-scores">
              {ASSESSMENT_SKILLS.filter(({ id }) => entry.ratings[id] !== null).map(
                ({ id, label }) => (
                  <span key={id}>
                    {label} <b>{entry.ratings[id]}/10</b>
                  </span>
                ),
              )}
            </div>
            <p>{entry.notes}</p>
          </li>
        ))}
      </ol>
      {history.length > limit && (
        <button className="pp-secondary" onClick={() => setLimit(limit + 5)}>
          Show older assessments
        </button>
      )}
    </details>
  );
}

export default function PlayerAssessment({ player, snapshot, defaultCoach = "", onSave, onClose }) {
  const dialog = useRef(null);
  const [form, setForm] = useState(() => ({
    playerId: player.id,
    observedOn: localAssessmentDate(),
    coach: defaultCoach,
    context: "Practice",
    notes: "",
    ratings: emptyAssessmentRatings(),
  }));
  const [error, setError] = useState("");
  const update = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
    setError("");
  };
  const observed = ASSESSMENT_SKILLS.filter(({ id }) => form.ratings[id] !== null).length;
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.showModal();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  function submit(event) {
    event.preventDefault();
    try {
      onSave(form);
    } catch (failure) {
      setError(failure.message);
    }
  }
  return (
    <dialog
      className="pa-dialog"
      ref={dialog}
      aria-labelledby="pa-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form onSubmit={submit}>
        <header className="pa-dialog-heading">
          <div>
            <span className="pp-eyebrow">RECORD AN OBSERVATION</span>
            <h2 id="pa-title">Assess {player.name}</h2>
            <p>Rate only the skills you saw. Skipped skills keep their previous rating and date.</p>
          </div>
          <button
            type="button"
            className="pa-close"
            aria-label="Close assessment"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>
        <div className="pa-form-body">
          <div className="pa-form-meta">
            <label>
              Observed on
              <input
                type="date"
                required
                max={localAssessmentDate()}
                value={form.observedOn}
                onChange={(event) => update({ observedOn: event.target.value })}
              />
            </label>
            <label>
              Setting
              <select
                value={form.context}
                onChange={(event) => update({ context: event.target.value })}
              >
                {ASSESSMENT_CONTEXTS.map((context) => (
                  <option key={context}>{context}</option>
                ))}
              </select>
            </label>
            <label className="pa-coach">
              Coach name
              <input
                required
                maxLength={80}
                autoComplete="name"
                placeholder="Your name"
                value={form.coach}
                onChange={(event) => update({ coach: event.target.value })}
              />
            </label>
          </div>
          <AssessmentGuide />
          <div className="pa-rating-fields">
            {ASSESSMENT_SKILLS.map(({ id, label, cue }) => {
              const selected = form.ratings[id];
              const anchor =
                selected && [...RATING_ANCHORS].reverse().find((item) => item.value <= selected);
              return (
                <fieldset key={id} className="pa-rating-field">
                  <legend>
                    {label}{" "}
                    <span>
                      Current:{" "}
                      {snapshot[id].value === null ? "Unobserved" : `${snapshot[id].value}/10`}
                    </span>
                  </legend>
                  <p>{cue}</p>
                  <div className="pa-rating-options">
                    {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                      <label key={value}>
                        <input
                          type="radio"
                          name={`rating-${id}`}
                          aria-label={`${label} ${value} out of 10`}
                          value={value}
                          checked={selected === value}
                          onChange={() => update({ ratings: { ...form.ratings, [id]: value } })}
                        />
                        <span>{value}</span>
                      </label>
                    ))}
                  </div>
                  <label className="pa-unobserved">
                    <input
                      type="radio"
                      name={`rating-${id}`}
                      aria-label={`${label} not observed today`}
                      checked={selected === null}
                      onChange={() => update({ ratings: { ...form.ratings, [id]: null } })}
                    />{" "}
                    Not observed today
                  </label>
                  {anchor && (
                    <p className="pa-selected-score" aria-live="polite">
                      <strong>
                        {selected}/10 · {anchor.label}
                      </strong>{" "}
                      — {anchor.description}
                    </p>
                  )}
                </fieldset>
              );
            })}
          </div>
          <label className="pa-notes">
            What did you observe?
            <textarea
              required
              rows={3}
              maxLength={1500}
              placeholder="For example: set the feet before 7 of 10 throws at the ground-ball station."
              value={form.notes}
              onChange={(event) => update({ notes: event.target.value })}
            />
          </label>
          <p className="pp-muted">
            Use specific examples so the next assessment has something to compare with.
          </p>
          {error && (
            <p className="pa-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="pa-form-footer">
          <span>
            {observed ? `${observed} of 4 skills observed` : "Choose at least one observed skill"}
            <small>Prototype · saved in this browser</small>
          </span>
          <div>
            <button type="button" className="pp-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="pp-primary" disabled={!observed}>
              <ClipboardText size={18} /> Save assessment
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}

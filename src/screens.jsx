import { useState } from "react";
import { FIXTURE, JORDAN_STATUSES, PLAYERS, POSITIONS, playerById } from "./data.js";
import { batterLabel, can, familyBlurb, inningLabel } from "./game.js";
import { useGame } from "./state.jsx";

function playerName(id) {
  return playerById(id)?.name ?? id;
}

function Lock({ children }) {
  return <p className="lock">{children}</p>;
}

export function Saturday() {
  const { state, role, dispatch } = useGame();
  const arrived = PLAYERS.filter((player) => state.arrived[player.id]).length;
  const shots = state.clips.filter((clip) => clip.status !== "needed").length;
  const mateoSpot = state.lineup.indexOf(FIXTURE.childId);

  return (
    <div className="stack">
      <section className="paper hero">
        <p className="kicker">{FIXTURE.when}</p>
        <h2>Hawks vs {FIXTURE.opponent}</h2>
        <p className="lede">
          {FIXTURE.place}, {FIXTURE.field}. Arrive {FIXTURE.arrive}. First pitch {FIXTURE.firstPitch}.
        </p>
        <dl className="facts">
          <div>
            <dt>Checked in</dt>
            <dd>
              {arrived} of {PLAYERS.length}
            </dd>
          </div>
          <div>
            <dt>Still out</dt>
            <dd>{PLAYERS.filter((player) => !state.arrived[player.id]).map((player) => player.name.split(" ")[0]).join(", ") || "Nobody"}</dd>
          </div>
          <div>
            <dt>Film</dt>
            <dd>
              {shots}/{state.clips.length} shot
            </dd>
          </div>
        </dl>
      </section>

      {role === "coach" && (
        <section className="paper">
          <p className="kicker">Your job</p>
          <h2>Set the card</h2>
          <p>
            {playerName(state.lineup[0])} leads off. {playerName(FIXTURE.pitcherId)} starts.{" "}
            {PLAYERS.length - arrived === 0 ? "The whole roster is here." : `${PLAYERS.length - arrived} still on the way.`}
          </p>
          <label className="field-label" htmlFor="dugout-note">
            Dugout note
          </label>
          <textarea
            id="dugout-note"
            maxLength={180}
            value={state.dugoutNote}
            onChange={(event) => dispatch({ type: "note", note: event.target.value })}
          />
          {can(role, "start") && state.status === "pregame" && (
            <button className="primary" type="button" onClick={() => dispatch({ type: "start" })}>
              Start first pitch
            </button>
          )}
        </section>
      )}

      {role === "scorekeeper" && (
        <section className="paper">
          <p className="kicker">Your job</p>
          <h2>Open the book</h2>
          <p>
            {state.status === "pregame"
              ? "Breakers bat first. The count stays blank until you start the game."
              : `${inningLabel(state)}. ${batterLabel(state)} is up. Count is ${state.balls}-${state.strikes}.`}
          </p>
          {state.status === "pregame" && (
            <button className="primary" type="button" onClick={() => dispatch({ type: "start" })}>
              Start first pitch
            </button>
          )}
        </section>
      )}

      {role === "videographer" && (
        <section className="paper">
          <p className="kicker">Your job</p>
          <h2>Stay on the open side</h2>
          <p>
            {state.clips.length} shots on the list. Don't block the first-base parents. {shots} already off the list.
          </p>
          <ol className="shot-preview">
            {state.clips.slice(0, 3).map((clip) => (
              <li key={clip.id}>
                <span className={`pill ${clip.status}`}>{clip.status}</span> {clip.label}
              </li>
            ))}
          </ol>
        </section>
      )}

      {role === "parent" && (
        <section className="paper">
          <p className="kicker">Your job</p>
          <h2>Mateo and the oranges</h2>
          <p>
            Mateo {state.arrived.mateo ? "is here" : "is not here yet"}
            {mateoSpot >= 0 ? `, batting ${mateoSpot + 1}` : ""}. You are bringing {FIXTURE.snack}. First pitch is {FIXTURE.firstPitch} on {FIXTURE.field}.
          </p>
          <div className="row">
            {JORDAN_STATUSES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={state.jordanStatus === option.id ? "choice on" : "choice"}
                aria-pressed={state.jordanStatus === option.id}
                onClick={() => dispatch({ type: "jordan", status: option.id })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function Lineup() {
  const { state, role, dispatch } = useGame();
  const editable = can(role, "lineup");
  const arrivals = can(role, "arrivals");

  return (
    <div className="stack">
      <section className="paper">
        <p className="kicker">Batting order</p>
        <h2>Today's card</h2>
        {!editable && <Lock>You're viewing the card. Switch to Coach Dana to move players.</Lock>}
        <ol className="lineup">
          {state.lineup.map((id, index) => {
            const player = playerById(id);
            return (
              <li key={id}>
                <span className="order">{index + 1}</span>
                <span className="who">
                  <strong>
                    #{player.number} {player.name}
                  </strong>
                  <span>Bats {player.bats}</span>
                </span>
                <label className="sr-only" htmlFor={`pos-${id}`}>
                  Position for {player.name}
                </label>
                <select
                  id={`pos-${id}`}
                  value={state.positions[id]}
                  disabled={!editable}
                  onChange={(event) => dispatch({ type: "position", id, position: event.target.value })}
                >
                  {POSITIONS.map((position) => (
                    <option key={position}>{position}</option>
                  ))}
                </select>
                <button type="button" disabled={!editable || index === 0} onClick={() => dispatch({ type: "move", id, direction: -1 })}>
                  Up
                </button>
                <button
                  type="button"
                  disabled={!editable || index === state.lineup.length - 1}
                  onClick={() => dispatch({ type: "move", id, direction: 1 })}
                >
                  Down
                </button>
                <button
                  type="button"
                  className={state.arrived[id] ? "choice on" : "choice"}
                  aria-pressed={state.arrived[id]}
                  disabled={!arrivals}
                  onClick={() => dispatch({ type: "arrival", id })}
                >
                  {state.arrived[id] ? "Here" : "Out"}
                </button>
                <button type="button" disabled={!editable || state.lineup.length <= 9} onClick={() => dispatch({ type: "bench", id })}>
                  Sit
                </button>
              </li>
            );
          })}
        </ol>
      </section>
      <section className="paper">
        <h2>Bench</h2>
        <ul className="bench">
          {state.bench.map((id) => {
            const player = playerById(id);
            return (
              <li key={id}>
                <span>
                  #{player.number} {player.name}
                </span>
                <button type="button" disabled={!editable} onClick={() => dispatch({ type: "activate", id })}>
                  Bat last
                </button>
                <button
                  type="button"
                  className={state.arrived[id] ? "choice on" : "choice"}
                  disabled={!arrivals}
                  onClick={() => dispatch({ type: "arrival", id })}
                >
                  {state.arrived[id] ? "Here" : "Out"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

const PITCHES = [
  ["ball", "Ball"],
  ["strike", "Strike"],
  ["foul", "Foul"],
  ["out", "In play out"],
  ["K", "Strikeout"],
  ["1B", "Single"],
  ["2B", "Double"],
  ["3B", "Triple"],
  ["HR", "Home run"],
];

export function Scorebook() {
  const { state, role, dispatch } = useGame();
  const scoring = can(role, "score") && state.status === "live";
  const due = state.half === "bottom" ? state.lineup.map(playerName) : [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `Breakers ${n}`);
  const dueIndex = state.half === "bottom" ? state.hawksBatterIndex % state.lineup.length : state.breakersBatterIndex % 9;

  return (
    <div className="stack">
      <section className="paper scorebook">
        <p className="kicker">Official book</p>
        <h2>Scorebook</h2>
        <div className="diamond-wrap">
          <div className="diamond" aria-hidden="true">
            <i />
            <span className={`bag second ${state.bases[1] ? "on" : ""}`} />
            <span className={`bag first ${state.bases[0] ? "on" : ""}`} />
            <span className={`bag third ${state.bases[2] ? "on" : ""}`} />
            <span className="bag home" />
          </div>
          <p className="at-bat">
            {state.status === "pregame" ? "Waiting on first pitch" : batterLabel(state)}
            {state.status === "live" ? ` · ${state.balls}-${state.strikes}` : ""}
          </p>
          <p className="outs" aria-label={`${state.outs} outs`}>
            {[0, 1, 2].map((out) => (
              <span key={out} className={out < state.outs ? "dot on" : "dot"} />
            ))}
          </p>
        </div>
        {state.status === "pregame" && can(role, "start") && (
          <button className="primary" type="button" onClick={() => dispatch({ type: "start" })}>
            Start first pitch
          </button>
        )}
        {state.status === "pregame" && !can(role, "start") && (
          <Lock>First pitch has not happened. Dana or Priya can start it.</Lock>
        )}
        {state.status === "final" && <Lock>Final is in the book. Reset Saturday to run it back.</Lock>}
        {state.status !== "pregame" && !can(role, "score") && state.status !== "final" && (
          <Lock>Switch to Scorekeeper Priya to put this pitch in the book.</Lock>
        )}
        <div className="pitch-grid">
          {PITCHES.map(([kind, label]) => (
            <button key={kind} type="button" disabled={!scoring} onClick={() => dispatch({ type: "pitch", kind })}>
              {label}
            </button>
          ))}
        </div>
        {can(role, "undo") && (
          <button type="button" disabled={!state.past.length} onClick={() => dispatch({ type: "undo" })}>
            Undo last pitch
          </button>
        )}
      </section>
      <section className="paper">
        <h2>Due up</h2>
        <ol className="due">
          {due.map((name, index) => (
            <li key={`${name}-${index}`} className={index === dueIndex ? "current" : ""}>
              {name}
            </li>
          ))}
        </ol>
        <h2>Tape</h2>
        <ol className="tape">
          {state.log.map((line, index) => (
            <li key={`${line}-${index}`}>{line}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function Film() {
  const { state, role, dispatch } = useGame();
  const filming = can(role, "film");
  return (
    <div className="stack">
      <section className="paper">
        <p className="kicker">Shot list</p>
        <h2>Chris's camera</h2>
        {!filming && <Lock>Switch to Videographer Chris to mark a shot.</Lock>}
        <ul className="clips">
          {state.clips.map((clip) => (
            <li key={clip.id}>
              <div>
                <strong>{clip.label}</strong>
                <span>{clip.detail}</span>
              </div>
              <button
                type="button"
                className={`pill ${clip.status}`}
                disabled={!filming}
                onClick={() => dispatch({ type: "clip", id: clip.id })}
              >
                {clip.status}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function Family() {
  const { state, role, dispatch } = useGame();
  const family = can(role, "family");
  const [copied, setCopied] = useState(false);
  const blurb = familyBlurb(state);
  const mateoSpot = state.lineup.indexOf(FIXTURE.childId);

  async function copyUpdate() {
    try {
      await navigator.clipboard.writeText(blurb);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="stack">
      <section className="paper">
        <p className="kicker">Family</p>
        <h2>Jordan's Saturday</h2>
        {!family && <Lock>Switch to Parent Jordan to update the group thread.</Lock>}
        <p>
          Mateo is #{playerById(FIXTURE.childId).number}
          {mateoSpot >= 0 ? `, batting ${mateoSpot + 1}` : ", on the bench"}
          {state.arrived.mateo ? ", and he is checked in." : ", and he is not checked in."} Snack duty is {FIXTURE.snack}.
        </p>
        <div className="row">
          {JORDAN_STATUSES.map((option) => (
            <button
              key={option.id}
              type="button"
              className={state.jordanStatus === option.id ? "choice on" : "choice"}
              aria-pressed={state.jordanStatus === option.id}
              disabled={!family}
              onClick={() => dispatch({ type: "jordan", status: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button type="button" className="primary" disabled={!family} onClick={() => dispatch({ type: "snack" })}>
          {state.snackConfirmed ? "Oranges are at the table" : "Mark oranges delivered"}
        </button>
      </section>
      <section className="paper">
        <h2>Text the group</h2>
        <p className="blurb">{blurb}</p>
        <button type="button" onClick={copyUpdate}>
          {copied ? "Copied" : "Copy update"}
        </button>
      </section>
    </div>
  );
}

import { useState } from "react";
import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes } from "react-router";
import { routerBasename } from "./base.js";
import { FIXTURE, ROLES, playerById } from "./data.js";
import { Family, Film, Lineup, Saturday, Scorebook } from "./screens.jsx";
import { GameProvider, useGame } from "./state.jsx";

const LINKS = [
  ["/", "Saturday"],
  ["/lineup", "Lineup"],
  ["/scorebook", "Scorebook"],
  ["/film", "Film"],
  ["/family", "Family"],
];

function HawkMark() {
  return (
    <svg className="mark" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 4 44 24 24 44 4 24Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M24 14c4 4 6 8 6 12 0-6-2-8-6-10-4 2-6 4-6 10 0-4 2-8 6-12Z" fill="currentColor" />
    </svg>
  );
}

function ScoreStrip() {
  const { state } = useGame();
  const pitcher = playerById(FIXTURE.pitcherId);
  const final = state.status === "final";
  const inning = final ? "Final" : state.status === "pregame" ? `First pitch ${FIXTURE.firstPitch}` : `${state.half === "top" ? "Top" : "Bot"} ${state.inning}`;
  return (
    <section className="strip" aria-live="polite">
      <div>
        <span>Hawks</span>
        <strong>{state.homeScore}</strong>
      </div>
      <div className="situation">
        <b>{inning}</b>
        <span>
          {state.status === "live" ? `${state.outs} ${state.outs === 1 ? "out" : "outs"} · ${state.balls}-${state.strikes}` : FIXTURE.field}
        </span>
      </div>
      <div>
        <span>Breakers</span>
        <strong>{state.visitorScore}</strong>
      </div>
      {state.status !== "pregame" && (
        <p className={state.pitches >= FIXTURE.pitchWarn ? "pitches warn" : "pitches"}>
          {pitcher.name.split(" ")[0]} · {state.pitches} pitches
        </p>
      )}
    </section>
  );
}

function Shell() {
  const { role, setRole, reset } = useGame();
  const [flash, setFlash] = useState("");

  return (
    <div className="app">
      <header className="top">
        <div className="top-row">
          <div className="brand">
            <HawkMark />
            <div>
              <p className="eyebrow">Diamond Live</p>
              <h1>Tustin 10U Hawks</h1>
            </div>
          </div>
          <button
            className="reset"
            type="button"
            onClick={() => {
              reset();
              setFlash("Saturday morning restored.");
            }}
          >
            Reset Saturday
          </button>
        </div>
        <div className="role-switch" role="radiogroup" aria-label="Who you are">
          {ROLES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={role === item.id}
              className={role === item.id ? "role on" : "role"}
              onClick={() => setRole(item.id)}
            >
              <span>{item.name}</span>
              <small>{item.job}</small>
            </button>
          ))}
        </div>
      </header>
      <ScoreStrip />
      {flash ? (
        <p className="flash" role="status">
          {flash}
        </p>
      ) : null}
      <nav className="nav" aria-label="Saturday">
        {LINKS.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/"}>
            {label}
          </NavLink>
        ))}
      </nav>
      <main>
        <Outlet />
      </main>
      <footer>Demo Saturday for the Hawks. Not a live feed.</footer>
    </div>
  );
}

export function AppRoutes() {
  return (
    <GameProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Saturday />} />
          <Route path="lineup" element={<Lineup />} />
          <Route path="scorebook" element={<Scorebook />} />
          <Route path="film" element={<Film />} />
          <Route path="family" element={<Family />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </GameProvider>
  );
}

export default function App() {
  const basename = routerBasename(import.meta.env.BASE_URL);
  return (
    <BrowserRouter basename={basename === "/" ? undefined : basename}>
      <AppRoutes />
    </BrowserRouter>
  );
}

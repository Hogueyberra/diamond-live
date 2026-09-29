import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ROLES } from "./data.js";
import { appendAction, createRecord, lastPitch, replayRecord, undoPitch } from "./gameRecord.js";
import { loadLibrary, saveLibrary } from "./gameStorage.js";

export { STATE_KEY, RECORDS_KEY } from "./gameStorage.js";
export const ROLE_KEY = "diamond-live-role";

function browserStorage() {
  try { return window.localStorage; } catch { return undefined; }
}

function newIdentity() {
  return { id: crypto.randomUUID(), createdAt: new Date().toISOString() };
}

function initialize() {
  return { ...loadLibrary(browserStorage(), newIdentity()), actionError: null };
}

function loadRole() {
  try {
    const saved = browserStorage()?.getItem(ROLE_KEY);
    return ROLES.some((role) => role.id === saved) ? saved : "coach";
  } catch { return "coach"; }
}

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [store, setStore] = useState(initialize);
  const [role, setRole] = useState(loadRole);
  const [saveError, setSaveError] = useState(null);
  const [savedLibrary, setSavedLibrary] = useState(null);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const { library } = store;

  useEffect(() => {
    if (!library) return;
    try {
      saveLibrary(browserStorage(), library);
      setSavedLibrary(library);
      setSaveError(null);
    } catch (error) { setSaveError(error.message); }
  }, [library, saveAttempt]);

  useEffect(() => {
    try { browserStorage()?.setItem(ROLE_KEY, role); } catch { /* Role choice is optional demo UI state. */ }
  }, [role]);

  const api = useMemo(() => {
    if (!library) return null;
    const record = library.games.find((game) => game.id === library.activeGameId);
    return {
      state: replayRecord(record), record, role, setRole,
      canUndoPitch: Boolean(lastPitch(record)),
      saveError, actionError: store.actionError, saved: savedLibrary === library,
      retrySave() { setSaveAttempt((attempt) => attempt + 1); },
      dispatch(action) {
        // Generate IDs and times once, outside React's potentially repeated updater.
        const meta = { id: crypto.randomUUID(), recordedAt: new Date().toISOString(), occurredAt: null, actor: { id: `demo-${role}`, role } };
        setStore((current) => {
          const game = current.library.games.find((item) => item.id === current.library.activeGameId);
          try {
            const updated = action.type === "undo" ? undoPitch(game, meta) : appendAction(game, action, meta);
            if (updated === game) return current;
            return { ...current, actionError: null, library: { ...current.library, games: current.library.games.map((item) => item.id === game.id ? updated : item) } };
          } catch (error) { return { ...current, actionError: error.message }; }
        });
      },
      reset() {
        const next = createRecord(newIdentity());
        setStore((current) => ({ ...current, actionError: null, library: { ...current.library, activeGameId: next.id, games: [...current.library.games, next] } }));
      },
      exportGames() {
        const url = URL.createObjectURL(new Blob([JSON.stringify(library, null, 2)], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "diamond-live-games.json";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
    };
  }, [library, role, saveError, savedLibrary, store.actionError]);

  return <GameContext.Provider value={api ?? { loadError: store.error, retryLoad: () => setStore(initialize()) }}>{children}</GameContext.Provider>;
}

export function GameBoundary({ children }) {
  const game = useGame();
  if (game.loadError) return (
    <div className="legacy-game"><main className="app">
      <section className="paper">
        <h1>Saved game needs attention</h1>
        <p role="alert">{game.loadError}</p>
        <p>Scoring is paused to protect the saved game. Retry after restoring storage access or ask for help recovering this browser's data.</p>
        <button type="button" onClick={game.retryLoad}>Retry loading saved games</button>
        <p><a href={import.meta.env.BASE_URL}>Back to coaching home</a></p>
      </section>
    </main></div>
  );

  return children;
}

export function useGame() {
  const value = useContext(GameContext);
  if (!value) throw new Error("useGame must be used inside GameProvider");
  return value;
}

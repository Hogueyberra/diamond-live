import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ROLES } from "./data.js";
import { createSaturday, reduce } from "./game.js";

export const STATE_KEY = "diamond-live-saturday-v1";
export const ROLE_KEY = "diamond-live-role";

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return createSaturday();
    const parsed = JSON.parse(raw);
    if (!parsed?.lineup || !parsed?.bases || !parsed?.clips) return createSaturday();
    return parsed;
  } catch {
    return createSaturday();
  }
}

function loadRole() {
  const saved = localStorage.getItem(ROLE_KEY);
  return ROLES.some((role) => role.id === saved) ? saved : "coach";
}

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [state, setState] = useState(loadState);
  const [role, setRole] = useState(loadRole);

  useEffect(() => {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem(ROLE_KEY, role);
  }, [role]);

  const api = useMemo(
    () => ({
      state,
      role,
      setRole,
      dispatch(action) {
        setState((current) => reduce(current, action));
      },
      reset() {
        setState(createSaturday());
      },
    }),
    [role, state],
  );

  return <GameContext.Provider value={api}>{children}</GameContext.Provider>;
}

export function useGame() {
  const value = useContext(GameContext);
  if (!value) throw new Error("useGame must be used inside GameProvider");
  return value;
}

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_SETTINGS, type Derived, derived, MODES, type Settings } from "./music";

/**
 * Settings (key, mode, tempo) and progress live in this browser's localStorage.
 * The server always renders the defaults; saved values load after hydration.
 */
const KEY = "sounds.v1";

interface Saved {
  settings: Settings;
  done: Record<string, true>;
  last: string | null;
}

interface Store extends Saved {
  values: Derived;
  ready: boolean;
  setSettings: (patch: Partial<Settings>) => void;
  toggleDone: (key: string) => void;
  visit: (key: string) => void;
}

const StoreContext = createContext<Store | null>(null);

function load(): Saved | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!raw || typeof raw !== "object") return null;
    const s = raw.settings ?? {};
    return {
      settings: {
        root: Number.isInteger(s.root) && s.root >= 0 && s.root < 12 ? s.root : DEFAULT_SETTINGS.root,
        mode: MODES.some((m) => m.id === s.mode) ? s.mode : DEFAULT_SETTINGS.mode,
        bpm: Number.isFinite(s.bpm) && s.bpm >= 40 && s.bpm <= 200 ? s.bpm : DEFAULT_SETTINGS.bpm,
      },
      done: raw.done && typeof raw.done === "object" ? raw.done : {},
      last: typeof raw.last === "string" ? raw.last : null,
    };
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved>({ settings: DEFAULT_SETTINGS, done: {}, last: null });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = load();
    if (s) setSaved(s);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      // Private windows and blocked storage: progress just won't persist.
    }
  }, [saved, ready]);

  const setSettings = useCallback(
    (patch: Partial<Settings>) => setSaved((p) => ({ ...p, settings: { ...p.settings, ...patch } })),
    [],
  );
  const toggleDone = useCallback(
    (key: string) =>
      setSaved((p) => {
        const done = { ...p.done };
        if (done[key]) delete done[key];
        else done[key] = true;
        return { ...p, done };
      }),
    [],
  );
  const visit = useCallback((key: string) => setSaved((p) => (p.last === key ? p : { ...p, last: key })), []);

  const value = useMemo<Store>(
    () => ({ ...saved, values: derived(saved.settings), ready, setSettings, toggleDone, visit }),
    [saved, ready, setSettings, toggleDone, visit],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}

/** Shorthand for the key- and tempo-dependent values. */
export function useValues(): Derived {
  return useStore().values;
}

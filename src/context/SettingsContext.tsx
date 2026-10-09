import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { DEFAULT_PREFERENCES, type UserPreferences } from "../types";

const STORAGE_KEY = "fieldnotes.settings";

interface SettingsContextValue {
  prefs: UserPreferences;
  /** True once preferences have been hydrated (local + profile). */
  ready: boolean;
  updatePreferences(patch: Partial<UserPreferences>): void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}

function readLocal(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<UserPreferences>) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function writeLocal(prefs: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage may be unavailable; the profile remains the source of truth.
  }
}

function applyTheme(theme: UserPreferences["theme"]): void {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#17180F" : "#F6F3EB");
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { profile, saveProfile } = useAuth();
  const { notify } = useToast();
  const [prefs, setPrefs] = useState<UserPreferences>(() => readLocal());
  const [ready, setReady] = useState(false);
  const hydratedProfileId = useRef<string | null>(null);

  // Apply theme on mount and whenever the system scheme changes.
  useEffect(() => {
    applyTheme(prefs.theme);
    if (prefs.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [prefs.theme]);

  // Hydrate from the saved profile once it arrives.
  useEffect(() => {
    if (!profile) {
      if (!hydratedProfileId.current) setReady(true);
      return;
    }
    if (hydratedProfileId.current === profile.id) return;
    hydratedProfileId.current = profile.id;
    const merged = { ...DEFAULT_PREFERENCES, ...(profile.preferences ?? {}) };
    setPrefs(merged);
    writeLocal(merged);
    setReady(true);
  }, [profile]);

  const updatePreferences = useCallback(
    (patch: Partial<UserPreferences>) => {
      setPrefs((current) => {
        const next = { ...current, ...patch };
        writeLocal(next);
        if (profile) {
          void saveProfile({ preferences: next }).then((result) => {
            if (result.error) {
              notify("Couldn’t save that preference. It applies locally for now.", {
                tone: "error",
              });
            }
          });
        }
        return next;
      });
    },
    [profile, saveProfile, notify],
  );

  const value = useMemo(() => ({ prefs, ready, updatePreferences }), [prefs, ready, updatePreferences]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

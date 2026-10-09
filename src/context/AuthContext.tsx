import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  errorMessage,
  isSessionError,
  requireClient,
  supabase,
} from "../lib/supabase";
import { DEFAULT_PREFERENCES, type Profile, type UserPreferences } from "../types";

export type AuthStatus = "loading" | "signedout" | "signedin";

export interface AuthResult {
  error: string | null;
  /** Sign-up succeeded but the address still needs confirmation. */
  needsConfirmation?: boolean;
}

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** True while the profile row is being loaded/refreshed. */
  profileLoading: boolean;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string, displayName: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<AuthResult>;
  refreshProfile(): Promise<void>;
  saveProfile(patch: {
    display_name?: string;
    preferences?: UserPreferences;
  }): Promise<AuthResult>;
  deleteAccount(): Promise<AuthResult>;
  /** Called when a backend call reveals an expired/invalid session. */
  handleSessionExpired(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

function mergePreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFERENCES };
  return { ...DEFAULT_PREFERENCES, ...(raw as Partial<UserPreferences>) };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() => (supabase ? "loading" : "signedout"));
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  /**
   * Ends the session when a backend call reveals an invalid/expired token.
   * State is flipped in this callback (not in an effect) so the app returns to
   * the sign-in screen immediately and safely.
   */
  const handleSessionExpired = useCallback(() => {
    setSession(null);
    setProfile(null);
    setStatus("signedout");
    void supabase?.auth.signOut({ scope: "local" }).catch(() => undefined);
  }, []);

  const loadProfile = useCallback(
    async (userId: string) => {
      const client = supabase;
      if (!client) return;
      setProfileLoading(true);
      try {
        const initial = await client
          .from("profiles")
          .select("id, display_name, created_at, preferences")
          .eq("id", userId)
          .maybeSingle();
        if (initial.error) throw initial.error;

        let data = initial.data;

        if (!data) {
          // Fallback for environments where the sign-up trigger is missing.
          const { error: insertError } = await client
            .from("profiles")
            .upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
          if (insertError) throw insertError;
          const retry = await client
            .from("profiles")
            .select("id, display_name, created_at, preferences")
            .eq("id", userId)
            .maybeSingle();
          if (retry.error) throw retry.error;
          data = retry.data;
        }

        setProfile(
          data
            ? {
                id: data.id,
                display_name: data.display_name,
                created_at: data.created_at,
                preferences: mergePreferences(data.preferences),
              }
            : null,
        );
      } catch (error) {
        if (isSessionError(error)) {
          handleSessionExpired();
        } else {
          console.error("[fieldnotes] profile load failed:", errorMessage(error));
        }
        setProfile(null);
      } finally {
        setProfileLoading(false);
      }
    },
    [handleSessionExpired],
  );

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setStatus(data.session ? "signedin" : "signedout");
      if (data.session) void loadProfile(data.session.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setStatus(newSession ? "signedin" : "signedout");
        if (newSession) {
          void loadProfile(newSession.user.id);
        } else {
          setProfile(null);
        }
      },
    );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const client = requireClient();
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) return { error: errorMessage(error) };
        return { error: null };
      } catch (error) {
        return { error: errorMessage(error) };
      }
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string): Promise<AuthResult> => {
      try {
        const client = requireClient();
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) return { error: errorMessage(error) };
        if (data.session) {
          await loadProfile(data.user?.id ?? data.session.user.id);
          return { error: null };
        }
        return { error: null, needsConfirmation: true };
      } catch (error) {
        return { error: errorMessage(error) };
      }
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Local sign-out proceeds regardless of network state.
    }
    setSession(null);
    setProfile(null);
    setStatus("signedout");
  }, []);

  const sendPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    try {
      const client = requireClient();
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/signin?reset=1`,
      });
      if (error) return { error: errorMessage(error) };
      return { error: null };
    } catch (error) {
      return { error: errorMessage(error) };
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const saveProfile = useCallback(
    async (patch: { display_name?: string; preferences?: UserPreferences }): Promise<AuthResult> => {
      if (!session) return { error: "You need to sign in to do that." };
      try {
        const client = requireClient();
        const { error } = await client
          .from("profiles")
          .update({ ...patch, id: session.user.id })
          .eq("id", session.user.id);
        if (error) return { error: errorMessage(error) };
        setProfile((current) =>
          current
            ? {
                ...current,
                display_name: patch.display_name ?? current.display_name,
                preferences: patch.preferences ?? current.preferences,
              }
            : current,
        );
        return { error: null };
      } catch (error) {
        return { error: errorMessage(error) };
      }
    },
    [session],
  );

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    try {
      const client = requireClient();
      const { error } = await client.rpc("delete_account");
      if (error) return { error: errorMessage(error) };
      await supabase?.auth.signOut({ scope: "local" }).catch(() => undefined);
      setSession(null);
      setProfile(null);
      setStatus("signedout");
      return { error: null };
    } catch (error) {
      return { error: errorMessage(error) };
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      profileLoading,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      refreshProfile,
      saveProfile,
      deleteAccount,
      handleSessionExpired,
    }),
    [
      status,
      session,
      profile,
      profileLoading,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      refreshProfile,
      saveProfile,
      deleteAccount,
      handleSessionExpired,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

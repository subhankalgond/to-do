import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && anonKey && /^https?:\/\//.test(url));

export const SUPABASE_CONFIG_ERROR =
  "FIELDNOTES isn’t connected to a backend yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a .env.local file, then restart the dev server.";

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "fieldnotes.auth",
      },
    })
  : null;

export function requireClient(): SupabaseClient {
  if (!supabase) throw new Error(SUPABASE_CONFIG_ERROR);
  return supabase;
}

const NETWORK_SIGNALS = new Set(["Failed to fetch", "NetworkError when attempting to fetch resource."]);
const NETWORK_RE = /getaddrinfo\s+ENOTFOUND|request to\s+https?:\/\/[^\s]+ failed, reason:\s*(?:getaddrinfo\s+ENOTFOUND|self-signed certificate|unable to verify|invalid certificate|network is unreachable|connection refused|socket hang up|abort)/i;
const FETCH_TYPE_NAME = "TypeError";

/**
 * True when a backend error looks like a connection failure, not a config
 * problem, bad input, or an expired session. Includes the ordinary Supabase
 * “Failed to fetch” / “NetworkError when attempting to fetch resource.” strings
 * even when they don’t include a leading “TypeError:”.
 */
export function isNetworkError(error: unknown): boolean {
  if ((error as { name?: string } | null)?.name === FETCH_TYPE_NAME) {
    const message = (error as { message?: string } | null)?.message ?? "";
    return NETWORK_SIGNALS.has(message) || NETWORK_RE.test(message);
  }
  const message = extractMessage(error);
  if (!message) return false;
  if (message.startsWith(FETCH_TYPE_NAME + ":")) {
    return NETWORK_SIGNALS.has(message.slice(FETCH_TYPE_NAME.length + 1)) || NETWORK_RE.test(message);
  }
  return NETWORK_SIGNALS.has(message) || NETWORK_RE.test(message);
}

const KNOWN_MESSAGES: Record<string, string> = {
  "Invalid login credentials": "That email and password combination didn’t match.",
  "User already registered": "An account with that email already exists.",
  "Email not confirmed": "Please confirm your email address before signing in.",
  "Signup requires a valid password": "Choose a password of at least 6 characters.",
  "Password should be at least 6 characters": "Choose a password of at least 6 characters.",
  "New password should be different from the old password.": "Choose a password different from your current one.",
  "Email link is invalid or has expired":
    "That link is no longer valid. Request a new one and try again.",
};

/** True when the error indicates an expired or missing session. */
export function isSessionError(error: unknown): boolean {
  const message = extractMessage(error);
  if (!message) return false;
  return /jwt|token .*invalid|refresh token|not authenticated|PGRST301/i.test(message);
}

function extractMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  const maybe = error as { message?: unknown };
  return typeof maybe.message === "string" ? maybe.message : null;
}

/**
 * Safe, user-facing error text. Internal details, credentials and driver noise
 * are never surfaced verbatim.
 *
 * A real network failure becomes “Couldn’t reach the server. Check your connection and try again.”
 * so that sign-in/sign-up show the same unreachable-server message users expect.
 * The “FIELDNOTES isn’t connected…” text is reserved for the true no-credentials case.
 */
export function errorMessage(error: unknown, fallback?: string): string {
  const message = extractMessage(error);
  if (!message) return fallback ?? "Couldn’t reach the server. Check your connection and try again.";

  if (isNetworkError(error)) {
    return "Couldn’t reach the server. Check your connection and try again.";
  }
  if (/rate limit|too many request|too many attempts/i.test(message)) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (isSessionError(error)) {
    return "Your session has expired. Please sign in again.";
  }
  if (/duplicate key|already exists/i.test(message)) {
    return "That already exists. Choose a different name.";
  }

  const known = KNOWN_MESSAGES[message];
  if (known) return known;
  if (fallback) return fallback;

  console.error("[fieldnotes] backend error:", message);
  return "Couldn’t reach the server. Check your connection and try again.";
}

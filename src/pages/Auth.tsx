import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { isSupabaseConfigured, SUPABASE_CONFIG_ERROR } from "../lib/supabase";
import { Modal } from "../components/ui/Modal";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthFrame({
  eyebrow,
  title,
  lede,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink lg:flex-row">
      {/* Editorial spine */}
      <aside
        className="flex flex-col justify-between border-b px-6 py-8 lg:w-[42%] lg:border-r lg:border-b-0 lg:px-14 lg:py-12"
        style={{ borderColor: "var(--line)", background: "var(--sunk)" }}
      >
        <div>
          <Link to="/signin" className="font-serif text-[19px] tracking-[0.2em] uppercase">
            Fieldnotes
          </Link>
        </div>
        <div className="mt-10 lg:mt-0">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-4 font-serif text-[2.6rem] leading-[1.04] tracking-[-0.015em] text-balance sm:text-[3.4rem]">
            {title}
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            {lede}
          </p>
        </div>
        <p className="eyebrow mt-10 lg:mt-0">An editorial task manager</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          {children}
          <div className="mt-8 border-t pt-6 text-sm" style={{ borderColor: "var(--line)" }}>
            {footer}
          </div>
        </div>
      </main>
    </div>
  );
}

export function SignInPage() {
  const { signIn, sendPasswordReset } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [params] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const resetMode = params.get("reset") === "1";
  const [requestingReset, setRequestingReset] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (params.get("reset") === "1") {
      notify("Check your inbox for the reset link, or request a new one below.");
    }
  }, [params, notify]);

  const validate = () => {
    const errors: { email?: string; password?: string } = {};
    if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address.";
    if (password.length < 6) errors.password = "Password must be at least 6 characters.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!validate()) return;
    setSubmitting(true);
    const result = await signIn(email.trim(), password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate("/today", { replace: true });
  };

  return (
    <AuthFrame
      eyebrow="Sign in"
      title="Back to the page."
      lede="Your ledger, your projects and your order — exactly as you left them, on any device."
      footer={
        <p style={{ color: "var(--muted)" }}>
          No account yet?{" "}
          <Link to="/signup" className="link-quiet font-medium">
            Create one
          </Link>
        </p>
      }
    >
      {!isSupabaseConfigured ? (
        <div className="border p-4 text-sm" style={{ borderColor: "var(--terracotta)", color: "var(--ink-soft)" }}>
          <p className="eyebrow mb-2" style={{ color: "var(--terracotta-deep)" }}>
            Backend not configured
          </p>
          {SUPABASE_CONFIG_ERROR}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div>
            <h2 className="font-serif text-3xl">{resetMode ? "Reset password" : "Sign in"}</h2>
            <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
              {resetMode
                ? "Enter your email and we’ll send a reset link."
                : "Enter your details to continue."}
            </p>
          </div>

          {error ? (
            <div
              role="alert"
              className="border px-3 py-2 text-sm"
              style={{ borderColor: "var(--terracotta)", color: "var(--terracotta-deep)" }}
            >
              {error}
            </div>
          ) : null}

          <div>
            <label className="field-label" htmlFor="signin-email">
              Email
            </label>
            <input
              id="signin-email"
              type="email"
              className="input"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldErrors((current) => ({ ...current, email: undefined }));
              }}
              autoComplete="email"
              required
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? "signin-email-error" : undefined}
            />
            {fieldErrors.email ? (
              <p id="signin-email-error" role="alert" className="mt-1.5 text-xs" style={{ color: "var(--terracotta-deep)" }}>
                {fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label className="field-label" htmlFor="signin-password">
                Password
              </label>
              <button
                type="button"
                className="text-xs underline underline-offset-2"
                style={{ color: "var(--muted)" }}
                onClick={() => setRequestingReset(true)}
              >
                Forgot password?
              </button>
            </div>
            <input
              id="signin-password"
              type="password"
              className="input"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({ ...current, password: undefined }));
              }}
              autoComplete="current-password"
              required
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? "signin-password-error" : undefined}
            />
            {fieldErrors.password ? (
              <p id="signin-password-error" role="alert" className="mt-1.5 text-xs" style={{ color: "var(--terracotta-deep)" }}>
                {fieldErrors.password}
              </p>
            ) : null}
          </div>

          <button type="submit" className="btn btn-solid w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}

      <Modal
        open={requestingReset}
        onClose={() => setRequestingReset(false)}
        title="Reset your password"
        description="We’ll email a secure link to set a new one."
        footer={
          <>
            <button type="button" className="btn btn-quiet" onClick={() => setRequestingReset(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="signin-reset-form"
              className="btn btn-solid"
              disabled={sendingReset}
            >
              {sendingReset ? "Sending…" : "Send link"}
            </button>
          </>
        }
      >
        <form
          id="signin-reset-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (sendingReset) return;
            if (!EMAIL_PATTERN.test(email.trim())) {
              setFieldErrors((current) => ({
                ...current,
                email: "Enter a valid email address first.",
              }));
              setRequestingReset(false);
              return;
            }
            setSendingReset(true);
            const result = await sendPasswordReset(email.trim());
            setSendingReset(false);
            if (result.error) {
              setError(result.error);
              setRequestingReset(false);
              return;
            }
            setRequestingReset(false);
            setResetSent(true);
          }}
        >
          <label className="field-label" htmlFor="signin-reset-email">
            Email
          </label>
          <input
            id="signin-reset-email"
            type="email"
            className="input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </form>
      </Modal>

      {resetSent ? (
        <p role="status" className="mt-4 text-sm" style={{ color: "var(--olive-deep)" }}>
          If that address has an account, a reset link is on its way.
        </p>
      ) : null}
    </AuthFrame>
  );
}

export function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmationNeeded, setConfirmationNeeded] = useState(false);

  const validate = () => {
    const errors: typeof fieldErrors = {};
    if (!name.trim()) errors.name = "Tell us what to call you.";
    if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address.";
    if (password.length < 6) errors.password = "Use at least 6 characters.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!validate()) return;
    setSubmitting(true);
    const result = await signUp(email.trim(), password, name.trim());
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsConfirmation) {
      setConfirmationNeeded(true);
      return;
    }
    navigate("/today", { replace: true });
  };

  if (confirmationNeeded) {
    return (
      <AuthFrame
        eyebrow="Confirm your email"
        title="One more step."
        lede="Check your inbox for a confirmation link. Once it lands, sign in and the ledger will be waiting."
        footer={
          <p style={{ color: "var(--muted)" }}>
            Already confirmed?{" "}
            <Link to="/signin" className="link-quiet font-medium">
              Sign in
            </Link>
          </p>
        }
      >
        <div className="border p-4 text-sm" style={{ borderColor: "var(--olive)", color: "var(--ink-soft)" }}>
          <p className="eyebrow mb-2">Confirmation sent</p>
          We sent a link to <strong>{email}</strong>. Open it to activate your account.
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      eyebrow="Create account"
      title="A ledger of your own."
      lede="Tasks, projects and tags — private to you, protected at the database, and available wherever you sign in."
      footer={
        <p style={{ color: "var(--muted)" }}>
          Already have an account?{" "}
          <Link to="/signin" className="link-quiet font-medium">
            Sign in
          </Link>
        </p>
      }
    >
      {!isSupabaseConfigured ? (
        <div className="border p-4 text-sm" style={{ borderColor: "var(--terracotta)", color: "var(--ink-soft)" }}>
          <p className="eyebrow mb-2" style={{ color: "var(--terracotta-deep)" }}>
            Backend not configured
          </p>
          {SUPABASE_CONFIG_ERROR}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div>
            <h2 className="font-serif text-3xl">Create your account</h2>
            <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
              Free to use, yours alone.
            </p>
          </div>

          {error ? (
            <div
              role="alert"
              className="border px-3 py-2 text-sm"
              style={{ borderColor: "var(--terracotta)", color: "var(--terracotta-deep)" }}
            >
              {error}
            </div>
          ) : null}

          <div>
            <label className="field-label" htmlFor="signup-name">
              Name
            </label>
            <input
              id="signup-name"
              className="input"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setFieldErrors((current) => ({ ...current, name: undefined }));
              }}
              autoComplete="name"
              required
              aria-invalid={fieldErrors.name ? true : undefined}
              aria-describedby={fieldErrors.name ? "signup-name-error" : undefined}
            />
            {fieldErrors.name ? (
              <p id="signup-name-error" role="alert" className="mt-1.5 text-xs" style={{ color: "var(--terracotta-deep)" }}>
                {fieldErrors.name}
              </p>
            ) : null}
          </div>

          <div>
            <label className="field-label" htmlFor="signup-email">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              className="input"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldErrors((current) => ({ ...current, email: undefined }));
              }}
              autoComplete="email"
              required
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? "signup-email-error" : undefined}
            />
            {fieldErrors.email ? (
              <p id="signup-email-error" role="alert" className="mt-1.5 text-xs" style={{ color: "var(--terracotta-deep)" }}>
                {fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div>
            <label className="field-label" htmlFor="signup-password">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              className="input"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({ ...current, password: undefined }));
              }}
              autoComplete="new-password"
              required
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? "signup-password-error" : undefined}
            />
            {fieldErrors.password ? (
              <p id="signup-password-error" role="alert" className="mt-1.5 text-xs" style={{ color: "var(--terracotta-deep)" }}>
                {fieldErrors.password}
              </p>
            ) : null}
          </div>

          <button type="submit" className="btn btn-solid w-full" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>
      )}
    </AuthFrame>
  );
}

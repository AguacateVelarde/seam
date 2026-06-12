import { useQueryClient } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { ApiError, UNAUTHORIZED_EVENT } from "../lib/api";
import {
  clearPendingInvite,
  getPendingInvite,
  markSessionExpired,
  useAuthStore,
} from "../lib/auth";
import { clearUserScopedCache, useAuthStatus, useLogin, useSetup } from "../lib/hooks";
import { Button } from "./ui/Button";
import { Field, Input } from "./ui/Input";

// Gates the authed branch of the router: shows the first-run setup wizard,
// the login screen, or the app (Outlet) depending on server + session state.
// The public /invite/:token route lives OUTSIDE this gate.
export function AuthGate() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const status = useAuthStatus();

  useEffect(() => {
    const onUnauthorized = () => {
      markSessionExpired();
      clearUserScopedCache(queryClient);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [queryClient]);

  if (status.isLoading) {
    return (
      <CenteredShell>
        <p className="text-sm text-slate-500">Connecting to the Seam server…</p>
      </CenteredShell>
    );
  }

  if (status.isError) {
    return (
      <CenteredShell>
        <Card>
          <CardHeading title="Cannot reach the Seam server" />
          <p className="mt-2 text-sm text-slate-600">
            The studio could not contact the server. Check that it is running, then retry.
          </p>
          <Button className="mt-4 w-full" onClick={() => status.refetch()}>
            Retry
          </Button>
        </Card>
      </CenteredShell>
    );
  }

  if (status.data?.needsSetup) {
    return <SetupWizard onDone={() => status.refetch()} />;
  }

  if (!token) {
    return <LoginScreen sessionExpired={sessionExpired} />;
  }

  return <Outlet />;
}

/* ------------------------------- Layout bits ------------------------------ */

function CenteredShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">{children}</div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      {children}
    </div>
  );
}

function CardHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Layers size={18} className="text-slate-700" />
        <span className="text-sm font-semibold text-slate-900">Seam Studio</span>
      </div>
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
    </div>
  );
}

/* ------------------------------ Setup wizard ------------------------------ */

function SetupWizard({ onDone }: { onDone: () => void }) {
  const setup = useSetup();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const passwordError =
    touched && password.length > 0 && password.length < 8
      ? "Password must be at least 8 characters"
      : null;
  const valid = name.trim().length > 0 && email.trim().length > 0 && password.length >= 8;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!valid) return;
    setServerError(null);
    try {
      await setup.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        password,
        workspaceName: workspaceName.trim() || undefined,
      });
      // Token is stored by the mutation; refetch status so the gate falls
      // through to the app.
      onDone();
    } catch (error) {
      if (error instanceof ApiError && error.code === "SETUP_COMPLETE") {
        setServerError("Setup is already complete on this server — sign in instead.");
        onDone();
      } else {
        setServerError(error instanceof Error ? error.message : "Setup failed");
      }
    }
  }

  return (
    <CenteredShell>
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <Card>
          <CardHeading
            title="Welcome to Seam — create your admin account"
            subtitle="This account owns the instance. Teammates join later via invites you send from workspace settings."
          />
          <div className="mt-5 space-y-4">
            <Field label="Your name">
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field
              label="Password"
              error={passwordError}
              hint={passwordError ? undefined : "At least 8 characters."}
            >
              <Input
                type="password"
                value={password}
                error={Boolean(passwordError)}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched(true)}
              />
            </Field>
            <Field label="Workspace name" hint="You can rename it or add more workspaces later.">
              <Input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="My Workspace"
              />
            </Field>
            {serverError && <p className="text-sm text-red-600">{serverError}</p>}
            <Button type="submit" className="w-full" disabled={!valid || setup.isPending}>
              {setup.isPending ? "Creating account…" : "Create account"}
            </Button>
          </div>
        </Card>
      </form>
    </CenteredShell>
  );
}

/* -------------------------------- Login -------------------------------- */

function LoginScreen({ sessionExpired }: { sessionExpired: boolean }) {
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    try {
      await login.mutateAsync({ email: email.trim(), password });
      // If the user landed here from an invite link ("sign in first"), send
      // them back to the invite page to accept it.
      const pendingInvite = getPendingInvite();
      if (pendingInvite) {
        clearPendingInvite();
        navigate(`/invite/${pendingInvite}`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Invalid email or password");
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    }
  }

  return (
    <CenteredShell>
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <Card>
          <CardHeading title="Sign in" subtitle="Sign in to manage this Seam server." />
          {sessionExpired && (
            <p className="mt-3 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              Your session expired — sign in again.
            </p>
          )}
          <div className="mt-5 space-y-4">
            <Field label="Email">
              <Input
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              disabled={!email.trim() || !password || login.isPending}
            >
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </div>
        </Card>
      </form>
    </CenteredShell>
  );
}

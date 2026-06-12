import { Layers } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { ApiError } from "../../lib/api";
import { setPendingInvite, useAuthStore } from "../../lib/auth";
import { formatDate } from "../../lib/format";
import { useAcceptInvite, useInviteInfo, useInviteSignup } from "../../lib/hooks";
import { toast } from "../../store/toast";

// Public page: anyone with an invite link lands here, with or without a
// session. Lives OUTSIDE the AuthGate so signup works for brand-new users.
export function InvitePage() {
  const { token = "" } = useParams();
  const invite = useInviteInfo(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Layers size={18} className="text-slate-700" />
          <span className="text-sm font-semibold text-slate-900">Seam Studio</span>
        </div>

        {invite.isLoading ? (
          <p className="text-sm text-slate-500">Checking your invite…</p>
        ) : invite.isError ? (
          <InvalidInvite error={invite.error} />
        ) : invite.data ? (
          <InviteBody token={token} info={invite.data} />
        ) : null}
      </div>
    </div>
  );
}

function InvalidInvite({ error }: { error: unknown }) {
  const expired = error instanceof ApiError && error.status === 410;
  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">
        {expired ? "This invite has expired" : "This invite is invalid or has expired"}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Ask a workspace admin to send you a new invite link.
      </p>
    </div>
  );
}

function InviteBody({
  token,
  info,
}: {
  token: string;
  info: {
    workspaceName: string;
    email: string | null;
    role: "admin" | "member";
    expiresAt: string;
  };
}) {
  const navigate = useNavigate();
  const sessionToken = useAuthStore((s) => s.token);
  const accept = useAcceptInvite(token);
  const signup = useInviteSignup(token);

  const [name, setName] = useState("");
  const [email, setEmail] = useState(info.email ?? "");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleAccept() {
    try {
      await accept.mutateAsync();
      toast.success(`Joined ${info.workspaceName}`);
      navigate("/projects");
    } catch {
      // error toast handled globally
    }
  }

  const passwordError =
    touched && password.length > 0 && password.length < 8
      ? "Password must be at least 8 characters"
      : null;
  const signupValid = name.trim().length > 0 && email.trim().length > 0 && password.length >= 8;

  async function handleSignup(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!signupValid) return;
    setFormError(null);
    try {
      await signup.mutateAsync({
        name: name.trim(),
        // The server only needs the email when the invite has none.
        email: info.email ? undefined : email.trim(),
        password,
      });
      toast.success(`Welcome! You've joined ${info.workspaceName}`);
      navigate("/projects");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFormError(
          "An account with this email already exists — sign in and accept the invite instead.",
        );
      } else {
        setFormError(error instanceof Error ? error.message : "Signup failed");
      }
    }
  }

  function goToLogin() {
    setPendingInvite(token);
    navigate("/");
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">
        You've been invited to join {info.workspaceName} on Seam
      </h1>
      <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
        <span>Role:</span>
        <Badge tone={info.role === "admin" ? "purple" : "blue"}>{info.role}</Badge>
        <span className="text-xs text-slate-400">Expires {formatDate(info.expiresAt)}</span>
      </div>

      {sessionToken ? (
        <div className="mt-6">
          <Button className="w-full" onClick={handleAccept} disabled={accept.isPending}>
            {accept.isPending ? "Joining…" : "Join workspace"}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSignup} className="mt-6 space-y-4">
          <Field label="Your name">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
            />
          </Field>
          <Field
            label="Email"
            hint={info.email ? "This invite is tied to this email address." : undefined}
          >
            <Input
              type="email"
              value={email}
              disabled={Boolean(info.email)}
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
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Button type="submit" className="w-full" disabled={!signupValid || signup.isPending}>
            {signup.isPending ? "Creating account…" : "Create account & join"}
          </Button>
          <p className="text-center text-xs text-slate-500">
            Already have an account?{" "}
            <button
              type="button"
              onClick={goToLogin}
              className="font-medium text-slate-700 underline hover:text-slate-900"
            >
              Sign in first
            </button>
          </p>
        </form>
      )}
    </div>
  );
}

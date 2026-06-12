import { LogOut } from "lucide-react";
import { useLogout, useMe } from "../lib/hooks";

function useSignOut() {
  const logout = useLogout();
  return () => {
    // Clearing the token flips AuthGate to the login screen; the server-side
    // session is revoked best-effort.
    logout.mutate();
  };
}

/** User block + sign-out for the bottom of the project sidebar. */
export function SidebarUserCard() {
  const { data: me } = useMe();
  const signOut = useSignOut();

  return (
    <div className="border-t border-slate-100 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-700" title={me?.user.name}>
            {me?.user.name ?? "…"}
          </p>
          <p className="truncate text-[11px] text-slate-400" title={me?.user.email}>
            {me?.user.email ?? ""}
          </p>
        </div>
        <button
          type="button"
          onClick={signOut}
          title="Sign out"
          className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );
}

/** Compact user + sign-out affordance for page headers (e.g. ProjectList). */
export function HeaderUserMenu() {
  const { data: me } = useMe();
  const signOut = useSignOut();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-xs font-medium text-slate-700">{me?.user.name ?? ""}</p>
        <p className="text-[11px] text-slate-400">{me?.user.email ?? ""}</p>
      </div>
      <button
        type="button"
        onClick={signOut}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        <LogOut size={13} />
        Sign out
      </button>
    </div>
  );
}

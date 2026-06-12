import { create } from "zustand";

// Session token storage. The token is issued by POST /v1/auth/login,
// /v1/auth/setup, or /v1/invites/:token/signup and sent as a Bearer header
// on every management request (see api.ts).
const TOKEN_STORAGE = "seam.sessionToken";

// Invite token stashed when an invited user chooses "sign in first" — after a
// successful login we bounce them back to the invite page automatically.
const PENDING_INVITE_STORAGE = "seam.pendingInvite";

export function getSessionToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE);
}

export function setSessionToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE, token);
  useAuthStore.setState({ token, sessionExpired: false });
}

export function clearSessionToken(): void {
  localStorage.removeItem(TOKEN_STORAGE);
  useAuthStore.setState({ token: null });
}

export function getPendingInvite(): string | null {
  return sessionStorage.getItem(PENDING_INVITE_STORAGE);
}

export function setPendingInvite(token: string): void {
  sessionStorage.setItem(PENDING_INVITE_STORAGE, token);
}

export function clearPendingInvite(): void {
  sessionStorage.removeItem(PENDING_INVITE_STORAGE);
}

interface AuthState {
  token: string | null;
  /** True when the server rejected the session (401) — shows a note on the login screen. */
  sessionExpired: boolean;
}

export const useAuthStore = create<AuthState>(() => ({
  token: getSessionToken(),
  sessionExpired: false,
}));

export function markSessionExpired(): void {
  localStorage.removeItem(TOKEN_STORAGE);
  useAuthStore.setState({ token: null, sessionExpired: true });
}

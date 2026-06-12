import { getSessionToken } from "./auth";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly meta?: unknown;

  constructor(status: number, code: string, message: string, meta?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}

const baseUrl = (import.meta.env.VITE_SEAM_SERVER_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);

export const UNAUTHORIZED_EVENT = "seam:unauthorized";

export interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; meta?: unknown };
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const url = new URL(baseUrl + path);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const token = getSessionToken();

  const res = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let json: unknown;
  if (res.status !== 204) {
    const text = await res.text();
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
    }
  }

  if (!res.ok) {
    // Only treat a 401 as "session expired" when we actually attached a
    // session token AND the request wasn't an auth/invite call — a wrong
    // password on login (or a public invite lookup) must show an inline
    // error, not bounce the whole app to the login screen.
    if (
      res.status === 401 &&
      token &&
      !path.startsWith("/v1/auth/login") &&
      !path.startsWith("/v1/invites/")
    ) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const envelope = json as ErrorEnvelope | undefined;
    throw new ApiError(
      res.status,
      envelope?.error?.code ?? "UNKNOWN_ERROR",
      envelope?.error?.message ?? `Request failed with status ${res.status}`,
      envelope?.error?.meta,
    );
  }

  return json as T;
}

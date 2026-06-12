import type { SeamResponse } from "@seam/schema";

export type SeamClientOptions = {
  /** Base URL of the Seam server, e.g. "https://seam.example.com" */
  baseUrl: string;
  /** API key with "read" (or "admin") role */
  apiKey: string;
  /** Project ID to fetch screens from */
  projectId: string;
  /** Custom fetch implementation (defaults to globalThis.fetch) */
  fetch?: typeof fetch;
};

export type GetScreenOptions = {
  /** User ID for sticky A/B assignment (sent as X-User-Id) */
  userId?: string;
  /** Adapter subtype, e.g. "stac" or "divkit". Omit for native Seam UIDL. */
  adapter?: string;
  /** Abort signal for the request */
  signal?: AbortSignal;
};

export class SeamError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "SeamError";
  }
}

export class SeamClient {
  private baseUrl: string;
  private apiKey: string;
  private projectId: string;
  private fetchImpl: typeof fetch;

  constructor(options: SeamClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.projectId = options.projectId;
    this.fetchImpl = options.fetch ?? fetch;
  }

  /**
   * Fetch a published screen from the Delivery API.
   * Returns the native SeamResponse, or the adapter-transformed payload
   * (typed as unknown) when `adapter` is set.
   */
  async getScreen(
    path: string,
    options?: GetScreenOptions & { adapter?: undefined },
  ): Promise<SeamResponse>;
  async getScreen(path: string, options: GetScreenOptions & { adapter: string }): Promise<unknown>;
  async getScreen(path: string, options: GetScreenOptions = {}): Promise<unknown> {
    const accept = options.adapter
      ? `application/vnd.seam.${options.adapter}+json`
      : "application/vnd.seam+json";

    const headers: Record<string, string> = {
      "X-Seam-Key": this.apiKey,
      Accept: accept,
    };
    if (options.userId) headers["X-User-Id"] = options.userId;

    const url = `${this.baseUrl}/v1/deliver/${this.projectId}/screens/${encodeURIComponent(path)}`;
    const res = await this.fetchImpl(url, { headers, signal: options.signal });

    if (!res.ok) {
      let code = "UNKNOWN";
      let message = res.statusText;
      let meta: Record<string, unknown> | undefined;
      try {
        const body = (await res.json()) as {
          error?: { code?: string; message?: string; meta?: Record<string, unknown> };
        };
        code = body.error?.code ?? code;
        message = body.error?.message ?? message;
        meta = body.error?.meta;
      } catch {
        // non-JSON error body
      }
      throw new SeamError(code, res.status, message, meta);
    }

    return res.json();
  }
}

export function createSeamClient(options: SeamClientOptions): SeamClient {
  return new SeamClient(options);
}

export type { SeamResponse, Node, PropValue } from "@seam/schema";

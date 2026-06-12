import type { Context } from "hono";

// Sub-routers receive path params from their mount path (e.g. :projectId),
// which Hono types as string | undefined. All our mounts guarantee presence.
export function param(c: Context, name: string): string {
  const value = c.req.param(name);
  if (value === undefined) {
    throw new Error(`Missing route param "${name}" — check router mount path`);
  }
  return value;
}

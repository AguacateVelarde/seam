import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { SeamError } from "../lib/errors";

function handle(err: unknown, c: Context): Response {
  if (err instanceof SeamError) {
    return c.json(err.toResponse(), err.status);
  }
  console.error(err);
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
    500,
  );
}

// Registered via app.onError — errors thrown inside mounted sub-routers
// bubble here (a try/catch middleware on the parent app would not see them).
export function errorHandler(err: Error, c: Context): Response {
  return handle(err, c);
}

// Kept for direct use on a single Hono instance.
export const errorMiddleware = createMiddleware(async (c, next) => {
  try {
    await next();
  } catch (err: unknown) {
    return handle(err, c);
  }
});

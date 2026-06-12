import type { ZodError } from "zod";

// Error codes → HTTP status
// SCREEN_NOT_FOUND          404
// SCREEN_NOT_PUBLISHED      404
// PROJECT_NOT_FOUND         404
// COMPONENT_NOT_FOUND       404
// ACTION_NOT_FOUND          404
// EXPERIMENT_NOT_FOUND      404
// SNAPSHOT_NOT_FOUND        404
// PUBLICATION_NOT_FOUND     404
// INVALID_SCHEMA            422  (Zod validation failed)
// UNAUTHORIZED              401
// FORBIDDEN                 403
// ADAPTER_NOT_FOUND         406  (Accept header requests unknown adapter)
// EXPERIMENT_CONFLICT       409  (Attempt to modify active experiment variants)
// DUPLICATE_NAME            409  (Component/action/screen name already exists in project)
// COMPONENT_IN_USE          409  (Component referenced in published snapshots)

export type ErrorResponse = {
  error: {
    code: string;
    message: string;
    meta?: Record<string, unknown>;
  };
};

export class SeamError extends Error {
  constructor(
    public code: string,
    public status: 400 | 401 | 403 | 404 | 406 | 409 | 410 | 422 | 500,
    message?: string,
    public meta?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.name = "SeamError";
  }

  toResponse(): ErrorResponse {
    return { error: { code: this.code, message: this.message, meta: this.meta } };
  }
}

export function invalidSchema(error: ZodError): SeamError {
  return new SeamError("INVALID_SCHEMA", 422, "Request body failed validation", {
    issues: error.issues,
  });
}

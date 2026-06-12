// postgres.js surfaces Postgres errors with a `code` property.
// 23505 = unique_violation — used to map duplicate names to DUPLICATE_NAME 409.
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

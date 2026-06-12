// Convert Date fields on a DB row to ISO strings so responses match the
// shared @seam/schema types (which use z.string().datetime()).
export function serializeRow<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ]),
  );
}

export function serializeRows<T extends Record<string, unknown>>(
  rows: T[],
): Record<string, unknown>[] {
  return rows.map(serializeRow);
}

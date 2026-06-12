const BINDING_RE = /\{\{\s*([^}]+?)\s*\}\}/g;
const EXACT_BINDING_RE = /^\{\{\s*([^}]+?)\s*\}\}$/;

/**
 * Derive a plausible fake value from the last path segment of a binding
 * expression, e.g. "user.name" -> "John Doe".
 */
export function fakeValueFor(expression: string): string | number | boolean {
  const segment = expression.split(".").pop()?.trim() ?? expression.trim();
  const key = segment.toLowerCase();

  if (/^(is|has)([_A-Z]|$)/.test(segment) || /^(is|has)_/.test(key)) return true;
  if (key === "name" || key.endsWith("name")) return "John Doe";
  if (/(count|limit|total|amount|price|qty|quantity|balance|age|size|num)/.test(key)) return 42;
  if (/(url|image|img|photo|avatar|picture|icon|banner)/.test(key)) {
    return "https://placehold.co/600x400";
  }
  if (/email/.test(key)) return "john.doe@example.com";
  if (/(phone|tel)/.test(key)) return "+1 555 0123";
  if (/(date|time|_at$|at$)/.test(key)) return "2026-06-11T12:00:00Z";
  if (/(id$|^id)/.test(key)) return "usr_01ABC123";
  return `Sample ${segment}`;
}

/**
 * Walk an arbitrary JSON payload and replace "{{ ... }}" binding expressions
 * with heuristic example values.
 */
export function simulateBindings(value: unknown): unknown {
  if (typeof value === "string") {
    const exact = value.match(EXACT_BINDING_RE);
    if (exact) return fakeValueFor(exact[1]);
    return value.replace(BINDING_RE, (_match, expr: string) => String(fakeValueFor(expr)));
  }
  if (Array.isArray(value)) return value.map(simulateBindings);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, simulateBindings(v)]),
    );
  }
  return value;
}

/**
 * Builds a short excerpt around the first match of `query` inside `text`,
 * for search-result previews. Pulled out as a pure function so it's
 * testable without a database.
 */
export function buildSnippet(text: string, query: string, radius = 40): string | null {
  if (!query) return null;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return null;
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

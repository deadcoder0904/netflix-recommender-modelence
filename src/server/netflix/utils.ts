export function splitGenres(genres: string) {
  if (!genres) return [];
  return genres
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function chunkArray<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function toOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n === 0) return undefined;
  return n;
}

export function dedupeStrings(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function nowIso() {
  return new Date().toISOString();
}

const DEFAULT_WINDOW_MS = 5 * 60_000;
const counters = new Map<string, number[]>();

function prune(list: number[], now: number, windowMs: number) {
  const cutoff = now - windowMs;
  let idx = 0;
  while (idx < list.length && list[idx] < cutoff) idx += 1;
  if (idx > 0) list.splice(0, idx);
}

export function recordRequest(key: string) {
  const now = Date.now();
  const list = counters.get(key) ?? [];
  list.push(now);
  prune(list, now, DEFAULT_WINDOW_MS);
  counters.set(key, list);
}

export function getRequestCounts(windowMs = DEFAULT_WINDOW_MS) {
  const now = Date.now();
  const counts: Record<string, number> = {};
  for (const [key, list] of counters.entries()) {
    prune(list, now, windowMs);
    counts[key] = list.length;
  }
  return {
    windowMs,
    since: new Date(now - windowMs).toISOString(),
    counts,
  };
}

export function resetRequestCounts() {
  counters.clear();
}

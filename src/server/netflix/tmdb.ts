import { dbNetflixPosters } from "./db";

type PosterRequest = {
  showId?: string;
  title: string;
  type?: string;
  year?: number;
  refresh?: boolean;
};

type PosterResult = {
  posterUrl: string | null;
  status: "ready" | "missing" | "error" | "cooldown";
  source: "cache" | "tmdb" | "disabled";
  cooldownUntil?: number;
};

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w780";
const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w500";
function readEnvNumber(name: string, fallback: number, opts?: { min?: number; max?: number }) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  let value = Math.round(n);
  if (typeof opts?.min === "number") value = Math.max(opts.min, value);
  if (typeof opts?.max === "number") value = Math.min(opts.max, value);
  return value;
}

const REQUEST_CONCURRENCY = readEnvNumber("TMDB_CONCURRENCY", 6, { min: 1, max: 12 });
const REQUEST_MIN_DELAY_MS = readEnvNumber("TMDB_MIN_DELAY_MS", 75, { min: 0, max: 2000 });
const MAX_ERROR_BACKOFF_MS = 6 * 60 * 60_000;
const MISSING_RETRY_MS = 24 * 60 * 60_000;
const DISABLED_COOLDOWN_MS = 60 * 60_000;
const SOFT_COOLDOWN_MAX_MS = 2 * 60 * 60_000;

type PosterStore = {
  fetch: typeof dbNetflixPosters.fetch;
  upsertOne: typeof dbNetflixPosters.upsertOne;
};

let posterStore: PosterStore = dbNetflixPosters;

export function __setPosterStoreForTests(store: PosterStore) {
  posterStore = store;
}

let tmdbDisabled = false;
let tmdbCooldownUntil = 0;
const inFlight = new Map<string, Promise<PosterResult>>();

type QueueTask<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
};

function createLimiter(concurrency: number, minDelayMs: number) {
  let active = 0;
  let lastStart = 0;
  const queue: QueueTask<PosterResult>[] = [];

  const drain = () => {
    if (active >= concurrency) return;
    const next = queue.shift();
    if (!next) return;

    const wait = Math.max(0, minDelayMs - (Date.now() - lastStart));
    const start = () => {
      active += 1;
      lastStart = Date.now();
      next
        .run()
        .then(next.resolve)
        .catch(next.reject)
        .finally(() => {
          active -= 1;
          drain();
        });
    };

    if (wait > 0) {
      setTimeout(start, wait);
    } else {
      start();
    }
  };

  const enqueue = (run: () => Promise<PosterResult>) =>
    new Promise<PosterResult>((resolve, reject) => {
      queue.push({ run, resolve, reject });
      drain();
    });

  return { enqueue };
}

const tmdbLimiter = createLimiter(REQUEST_CONCURRENCY, REQUEST_MIN_DELAY_MS);

function buildKey(req: PosterRequest) {
  if (req.showId) return req.showId;
  return `${req.type ?? "Any"}::${req.title.trim().toLowerCase()}::${req.year ?? ""}`;
}

function normalizeType(type?: string) {
  const lower = (type ?? "").toLowerCase();
  if (lower.includes("tv")) return "tv";
  if (lower.includes("show")) return "tv";
  return "movie";
}

function nextCooldown(errorCount: number) {
  const base = 30_000;
  const ms = Math.min(base * Math.pow(2, Math.max(errorCount - 1, 0)), MAX_ERROR_BACKOFF_MS);
  return Date.now() + ms;
}

async function getCachedPoster(key: string) {
  const cached = await posterStore.fetch({ key }, { limit: 1 });
  const record = cached[0];
  if (!record) return null;
  return record;
}

async function updatePosterCache(key: string, update: Record<string, unknown>) {
  await posterStore.upsertOne(
    { key },
    {
      $set: {
        ...update,
        updatedAt: new Date(),
      },
    },
  );
}

async function fetchFromTmdb(req: PosterRequest, key: string): Promise<PosterResult> {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) {
    tmdbDisabled = true;
    await updatePosterCache(key, {
      key,
      show_id: req.showId,
      title: req.title,
      type: req.type ?? "",
      year: req.year,
      status: "missing",
      cooldown_until: new Date(Date.now() + DISABLED_COOLDOWN_MS),
    });
    return { posterUrl: null, status: "missing", source: "disabled" };
  }

  if (tmdbCooldownUntil && Date.now() < tmdbCooldownUntil) {
    return {
      posterUrl: null,
      status: "cooldown",
      source: "cache",
      cooldownUntil: tmdbCooldownUntil,
    };
  }

  const endpoint = normalizeType(req.type) === "tv" ? "search/tv" : "search/movie";
  const params = new URLSearchParams({
    api_key: apiKey,
    query: req.title,
    include_adult: "false",
    language: "en-US",
  });
  if (req.year) {
    params.set(endpoint === "search/tv" ? "first_air_date_year" : "year", String(req.year));
  }

  const url = `${TMDB_BASE}/${endpoint}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 429 || res.status >= 500) {
      tmdbCooldownUntil = Date.now() + 2 * 60_000;
    }
    throw new Error(`TMDB request failed (${res.status})`);
  }

  const json = (await res.json()) as { results?: Array<Record<string, unknown>> };
  const first = json.results?.find(
    (r) => r && (typeof r.backdrop_path === "string" || typeof r.poster_path === "string"),
  );
  if (!first) {
    await updatePosterCache(key, {
      key,
      show_id: req.showId,
      title: req.title,
      type: req.type ?? "",
      year: req.year,
      status: "missing",
      cooldown_until: new Date(Date.now() + MISSING_RETRY_MS),
    });
    return { posterUrl: null, status: "missing", source: "tmdb" };
  }

  const backdropPath = typeof first.backdrop_path === "string" ? first.backdrop_path : null;
  const posterPath = typeof first.poster_path === "string" ? first.poster_path : null;
  const thumbUrl = backdropPath
    ? `${TMDB_BACKDROP_BASE}${backdropPath}`
    : posterPath
      ? `${TMDB_POSTER_BASE}${posterPath}`
      : null;

  await updatePosterCache(key, {
    key,
    show_id: req.showId,
    title: req.title,
    type: req.type ?? "",
    year: req.year,
    tmdb_id: typeof first.id === "number" ? first.id : undefined,
    poster_path: posterPath ?? undefined,
    backdrop_path: backdropPath ?? undefined,
    poster_url: posterPath ? `${TMDB_POSTER_BASE}${posterPath}` : undefined,
    thumb_url: thumbUrl ?? undefined,
    status: "ready",
  });
  return { posterUrl: thumbUrl, status: "ready", source: "tmdb" };
}

export async function getPosterForTitle(req: PosterRequest): Promise<PosterResult> {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (tmdbDisabled && apiKey) tmdbDisabled = false;
  if (tmdbDisabled) return { posterUrl: null, status: "missing", source: "disabled" };

  const key = buildKey(req);
  const cached = await getCachedPoster(key);
  if (cached) {
    const cachedUrl = cached.thumb_url ?? cached.poster_url ?? null;
    if (cachedUrl && cached.status === "ready") {
      return { posterUrl: cachedUrl, status: "ready", source: "cache" };
    }
    const now = Date.now();
    let forceRefreshMissing = false;
    if (cached.cooldown_until && cached.cooldown_until.getTime() > now && !req.refresh) {
      const cooldownMs =
        cached.updatedAt instanceof Date
          ? cached.cooldown_until.getTime() - cached.updatedAt.getTime()
          : null;

      // If the cache was created while TMDB was disabled (no API key), don't keep users stuck in cooldown
      // once an API key is present again. Those records use a short cooldown (~1h).
      const looksLikeDisabledCooldown =
        cached.status === "missing" &&
        Boolean(apiKey) &&
        typeof cooldownMs === "number" &&
        cooldownMs > 0 &&
        cooldownMs <= SOFT_COOLDOWN_MAX_MS &&
        cached.error_count == null &&
        cached.last_error_at == null;

      if (looksLikeDisabledCooldown) {
        forceRefreshMissing = true;
      } else {
        return {
          posterUrl: null,
          status: "cooldown",
          source: "cache",
          cooldownUntil: cached.cooldown_until.getTime(),
        };
      }
    }

    if (cached.status === "missing") {
      const staleMissing =
        cached.updatedAt instanceof Date && now - cached.updatedAt.getTime() > MISSING_RETRY_MS;
      if (!req.refresh && !staleMissing && !forceRefreshMissing) {
        return { posterUrl: null, status: "missing", source: "cache" };
      }
    }
  }

  const inflight = inFlight.get(key);
  if (inflight) return inflight;

  const task = tmdbLimiter.enqueue(async () => {
    try {
      const result = await fetchFromTmdb(req, key);
      return result;
    } catch {
      const errorCount = (cached?.error_count ?? 0) + 1;
      const cooldownUntil = nextCooldown(errorCount);
      await updatePosterCache(key, {
        key,
        show_id: req.showId,
        title: req.title,
        type: req.type ?? "",
        year: req.year,
        status: "error",
        error_count: errorCount,
        last_error_at: new Date(),
        cooldown_until: new Date(cooldownUntil),
      });
      return { posterUrl: null, status: "error", source: "tmdb" };
    }
  });

  inFlight.set(key, task);
  try {
    return await task;
  } finally {
    inFlight.delete(key);
  }
}

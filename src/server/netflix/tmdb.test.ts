import { afterEach, describe, expect, it } from "bun:test";

type PosterRecord = {
  key: string;
  status: string;
  updatedAt: Date;
  thumb_url?: string;
  poster_url?: string;
  cooldown_until?: Date;
  error_count?: number;
};

function createPosterStore() {
  const records = new Map<string, PosterRecord>();

  return {
    fetch: async (query: { key: string }) => {
      const record = records.get(query.key);
      return record ? [record] : [];
    },
    upsertOne: async (filter: { key: string }, update: { $set: PosterRecord }) => {
      const existing = records.get(filter.key);
      const next = {
        ...(existing ?? { key: filter.key, status: "missing", updatedAt: new Date() }),
      };
      records.set(filter.key, { ...next, ...update.$set });
    },
    seed(record: PosterRecord) {
      records.set(record.key, record);
    },
  };
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function importTmdbWithStore(store: ReturnType<typeof createPosterStore>) {
  const mod = await import(`./tmdb.ts?test=${Math.random()}`);
  mod.__setPosterStoreForTests(store as any);
  return mod;
}

describe("tmdb poster caching", () => {
  it("retries missing cache when refresh is true", async () => {
    process.env.TMDB_API_KEY = "test-key";

    const store = createPosterStore();
    store.seed({ key: "s1", status: "missing", updatedAt: new Date() });

    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: [{ id: 1, poster_path: "/poster.jpg" }],
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const { getPosterForTitle } = await importTmdbWithStore(store);

    const result = await getPosterForTitle({
      showId: "s1",
      title: "Inception",
      type: "Movie",
      year: 2010,
      refresh: true,
    });

    expect(fetchCount).toBe(1);
    expect(result.status).toBe("ready");
    expect(result.posterUrl).toContain("image.tmdb.org");
  });

  it("does not refetch missing cache without refresh", async () => {
    process.env.TMDB_API_KEY = "test-key";

    const store = createPosterStore();
    store.seed({ key: "s2", status: "missing", updatedAt: new Date() });

    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: [{ id: 1, poster_path: "/poster.jpg" }],
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const { getPosterForTitle } = await importTmdbWithStore(store);

    const result = await getPosterForTitle({
      showId: "s2",
      title: "Inception",
      type: "Movie",
      year: 2010,
      refresh: false,
    });

    expect(fetchCount).toBe(0);
    expect(result.status).toBe("missing");
    expect(result.source).toBe("cache");
  });

  it("bypasses cooldown cache when refresh is true", async () => {
    process.env.TMDB_API_KEY = "test-key";

    const store = createPosterStore();
    store.seed({
      key: "s3",
      status: "missing",
      updatedAt: new Date(),
      cooldown_until: new Date(Date.now() + 60 * 60_000),
    });

    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: [{ id: 1, poster_path: "/poster.jpg" }],
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const { getPosterForTitle } = await importTmdbWithStore(store);

    const result = await getPosterForTitle({
      showId: "s3",
      title: "Inception",
      type: "Movie",
      year: 2010,
      refresh: true,
    });

    expect(fetchCount).toBe(1);
    expect(result.status).toBe("ready");
  });

  it("ignores short missing cooldown when TMDB key becomes available", async () => {
    process.env.TMDB_API_KEY = "test-key";

    const store = createPosterStore();
    store.seed({
      key: "s4",
      status: "missing",
      updatedAt: new Date(),
      cooldown_until: new Date(Date.now() + 60 * 60_000),
    });

    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: [{ id: 1, poster_path: "/poster.jpg" }],
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const { getPosterForTitle } = await importTmdbWithStore(store);

    const result = await getPosterForTitle({
      showId: "s4",
      title: "Inception",
      type: "Movie",
      year: 2010,
    });

    expect(fetchCount).toBe(1);
    expect(result.status).toBe("ready");
  });
});

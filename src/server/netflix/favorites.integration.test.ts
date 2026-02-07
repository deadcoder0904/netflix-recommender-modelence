import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import netflixModule from "./index";
import { dbNetflixFavorites, dbNetflixMeta, dbNetflixPosters, dbNetflixTitles } from "./db";
import { getRequestCounts, resetRequestCounts } from "./requests";

const hasMongoUri = !!process.env.MONGODB_URI?.trim();
const maybeTest = hasMongoUri ? test : test.skip;

let client: MongoClient | null = null;

function callMethod(def: any, args: any, ctx?: any) {
  return typeof def === "function" ? def(args, ctx) : def.handler(args, ctx);
}

beforeAll(async () => {
  if (!hasMongoUri) return;
  const uri = process.env.MONGODB_URI!.trim();
  client = new MongoClient(uri, { maxPoolSize: 5, ignoreUndefined: true });
  await client.connect();
  dbNetflixTitles.init(client);
  dbNetflixMeta.init(client);
  dbNetflixPosters.init(client);
  dbNetflixFavorites.init(client);
  await dbNetflixFavorites.createIndexes();
});

afterAll(async () => {
  if (client) {
    await client.close();
    client = null;
  }
});

describe("favorites", () => {
  maybeTest("toggles and lists favorites without duplicates", async () => {
    resetRequestCounts();

    const status = await callMethod((netflixModule as any).queries.status, {});
    if (!status.ready) {
      throw new Error(`Index not ready: ${status.error ?? "unknown"}`);
    }

    const titles = await dbNetflixTitles.fetch({}, { limit: 1 });
    const showId = String((titles[0] as any)?.show_id ?? "");
    expect(showId).not.toBe("");

    const ctx = { session: { authToken: "test-session" }, user: null };

    const added = await callMethod(
      (netflixModule as any).mutations.toggleFavorite,
      { showId },
      ctx,
    );
    expect(added.is_favorite).toBe(true);

    const list1 = await callMethod(
      (netflixModule as any).queries.favorites,
      { page: 1, pageSize: 50 },
      ctx,
    );
    const ids1 = list1.results.map((r: any) => r.show_id);
    expect(ids1.includes(showId)).toBe(true);

    const removed = await callMethod(
      (netflixModule as any).mutations.toggleFavorite,
      { showId },
      ctx,
    );
    expect(removed.is_favorite).toBe(false);

    const list2 = await callMethod(
      (netflixModule as any).queries.favorites,
      { page: 1, pageSize: 50 },
      ctx,
    );
    const ids2 = list2.results.map((r: any) => r.show_id);
    expect(ids2.includes(showId)).toBe(false);

    const counts = getRequestCounts();
    expect(counts.counts["netflix.favorites.toggle"]).toBe(2);
    expect(counts.counts["netflix.favorites.list"]).toBe(2);
  });
});

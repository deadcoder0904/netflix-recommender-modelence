import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongoClient } from "mongodb";
import netflixModule from "./index";
import { dbNetflixMeta, dbNetflixPosters, dbNetflixTitles } from "./db";
import { getRequestCounts, resetRequestCounts } from "./requests";

const hasMongoUri = !!process.env.MONGODB_URI?.trim();
const hasVoyageKey = !!process.env.VOYAGE_API_KEY?.trim();

const maybeTest = hasMongoUri && hasVoyageKey ? test : test.skip;

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
  await dbNetflixTitles.createIndexes();
});

afterAll(async () => {
  if (client) {
    await client.close();
    client = null;
  }
});

describe("modelence netflix search", () => {
  maybeTest("returns relevant results for common vibe queries and tracks requests", async () => {
    resetRequestCounts();
    const originalOpenRouterKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "";

    try {
      const status = await callMethod((netflixModule as any).queries.status, {});
      if (!status.ready || typeof status.count !== "number") {
        throw new Error(`Index not ready: ${status.error ?? "unknown"}`);
      }

      const indexCount = status.count;

      const cases: Array<{ query: string; expectAny: string[] }> = [
        {
          query: "mindfuck",
          expectAny: ["Inception", "ARQ", "Black Mirror", "Mirage", "In Paradox"],
        },
        {
          query: "time travel",
          expectAny: ["About Time", "ARQ", "See You Yesterday", "Russian Doll"],
        },
        {
          query: "zombie apocalypse",
          expectAny: ["Train to Busan", "Black Summer", "Z Nation"],
        },
        {
          query: "heist",
          expectAny: ["The Great Heist", "Den of Thieves", "Bitcoin Heist"],
        },
        {
          query: "stand up comedy",
          expectAny: ["The Standups", "Dave Chappelle", "Maria Bamford"],
        },
        {
          query: "cooking show",
          expectAny: ["Chef's Table", "Cooked", "Salt Fat Acid Heat"],
        },
      ];

      for (const c of cases) {
        const res = await callMethod((netflixModule as any).queries.search, {
          q: c.query,
          page: 1,
          pageSize: 30,
          rerank: false,
        });

        expect(res.total, `total results for "${c.query}"`).toBeGreaterThan(0);
        expect(res.total, `total should not be full index for "${c.query}"`).toBeLessThan(
          indexCount,
        );
        expect(res.results.length, `results length for "${c.query}"`).toBeGreaterThan(0);

        for (const item of res.results) {
          expect(item.title, `empty title for query "${c.query}"`).not.toBe("");
          expect(item.description, `empty description for query "${c.query}"`).not.toBe("");
        }

        const titlesLower = res.results.map((r: any) => r.title.toLowerCase());
        const expectedLower = c.expectAny.map((s) => s.toLowerCase());
        const matched = expectedLower.some((exp) => titlesLower.some((t: any) => t.includes(exp)));
        expect(
          matched,
          `expected any of ${JSON.stringify(c.expectAny)} in top results for "${c.query}"`,
        ).toBe(true);
      }

      const counts = getRequestCounts();
      console.info("Request counts:", counts);
      expect(counts.counts["netflix.search"]).toBe(cases.length);
    } finally {
      process.env.OPENROUTER_API_KEY = originalOpenRouterKey;
    }
  });
});

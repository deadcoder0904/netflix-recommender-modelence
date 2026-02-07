import z from "zod";
import { Module } from "modelence/server";
import { dbNetflixFavorites, dbNetflixMeta, dbNetflixTitles, dbNetflixPosters } from "./db";
import { ensureSeeded } from "./seed";
import { getFilters, searchNetflix } from "./search";
import { getPosterForTitle } from "./tmdb";
import { getRequestCounts, recordRequest, resetRequestCounts } from "./requests";
import { getFavoritesForShowIds, getOwner, listFavorites, toggleFavorite } from "./favorites";

const statusSchema = z.object({}).optional();

const searchSchema = z.object({
  q: z.string().default(""),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(80).default(20),
  type: z.string().optional(),
  rating: z.string().optional(),
  year: z.union([z.number(), z.string()]).optional(),
  genre: z.string().optional(),
  sort: z.string().optional(),
  rerank: z.union([z.boolean(), z.string()]).optional(),
  rerankTopK: z.union([z.number(), z.string()]).optional(),
});

const posterSchema = z.object({
  showId: z.string().optional(),
  title: z.string(),
  type: z.string().optional(),
  year: z.union([z.number(), z.string()]).optional(),
  refresh: z.union([z.boolean(), z.string()]).optional(),
});

const postersSchema = z.object({
  items: z.array(posterSchema).min(1).max(80),
});

const favoritesSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(80).default(20),
});

const toggleFavoriteSchema = z.object({
  showId: z.string().min(1),
});

function parseYear(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function parseBool(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "1" || lower === "true") return true;
    if (lower === "0" || lower === "false") return false;
  }
  return undefined;
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

const isDev = process.env.NODE_ENV !== "production";

export default new Module("netflix", {
  stores: [dbNetflixTitles, dbNetflixPosters, dbNetflixMeta, dbNetflixFavorites],

  queries: {
    status: async (args: unknown) => {
      statusSchema.parse(args);
      recordRequest("netflix.status");
      try {
        const seed = await ensureSeeded();
        const doc = await dbNetflixMeta.fetch({ key: "index" }, { limit: 1 });
        const meta = doc[0];
        return {
          ready: seed.total > 0,
          count: meta?.count ?? seed.total,
          dimensions: meta?.dimensions ?? seed.dimensions ?? 0,
          createdAt: meta?.createdAt?.toISOString?.() ?? meta?.updatedAt?.toISOString?.() ?? null,
          source: meta?.source ?? seed.source,
        };
      } catch (err) {
        return { ready: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    filters: async () => {
      recordRequest("netflix.filters");
      await ensureSeeded();
      return getFilters();
    },

    search: async (args: unknown, ctx: unknown) => {
      const params = searchSchema.parse(args);
      recordRequest("netflix.search");
      await ensureSeeded();

      const doRerank = parseBool(params.rerank);
      const rerankTopK = parseNumber(params.rerankTopK);
      const year = parseYear(params.year);

      const res = await searchNetflix(params.q ?? "", {
        page: params.page,
        pageSize: params.pageSize,
        type: params.type,
        rating: params.rating,
        year,
        genre: params.genre,
        sort: params.sort as any,
        doRerank: doRerank ?? true,
        rerankTopK: rerankTopK ?? 10,
      });

      try {
        const owner = getOwner(ctx);
        const showIds = res.results.map((r) => r.show_id).filter(Boolean);
        const favorites = await getFavoritesForShowIds(owner, showIds);
        return {
          ...res,
          results: res.results.map((r) => ({
            ...r,
            is_favorite: favorites.has(r.show_id),
          })),
        };
      } catch {
        return res;
      }
    },

    poster: async (args: unknown) => {
      const params = posterSchema.parse(args);
      recordRequest("netflix.poster");
      const year = parseYear(params.year);

      const refresh = parseBool(params.refresh);
      const result = await getPosterForTitle({
        showId: params.showId,
        title: params.title,
        type: params.type,
        year,
        refresh,
      });

      return {
        posterUrl: result.posterUrl,
        status: result.status,
        source: result.source,
        cooldownUntil: result.cooldownUntil ? new Date(result.cooldownUntil).toISOString() : null,
      };
    },

    posters: async (args: unknown) => {
      const params = postersSchema.parse(args);
      recordRequest("netflix.posters");

      const results = await Promise.all(
        params.items.map(async (item) => {
          const year = parseYear(item.year);
          const refresh = parseBool(item.refresh);
          const result = await getPosterForTitle({
            showId: item.showId,
            title: item.title,
            type: item.type,
            year,
            refresh,
          });

          return {
            showId: item.showId ?? null,
            posterUrl: result.posterUrl,
            status: result.status,
            source: result.source,
            cooldownUntil: result.cooldownUntil
              ? new Date(result.cooldownUntil).toISOString()
              : null,
          };
        }),
      );

      return { results };
    },

    favorites: async (args: unknown, ctx: unknown) => {
      const params = favoritesSchema.parse(args);
      recordRequest("netflix.favorites.list");
      await ensureSeeded();
      const owner = getOwner(ctx);
      return listFavorites(owner, { page: params.page, pageSize: params.pageSize });
    },
  },

  mutations: {
    toggleFavorite: async (args: unknown, ctx: unknown) => {
      const params = toggleFavoriteSchema.parse(args);
      recordRequest("netflix.favorites.toggle");
      await ensureSeeded();
      const owner = getOwner(ctx);
      return toggleFavorite(owner, params.showId);
    },
  },

  routes: isDev
    ? [
        {
          path: "/api/debug/requests",
          handlers: {
            get: async (params) => {
              const windowMsParam = params.query.windowMs;
              const windowMs = windowMsParam ? Number(windowMsParam) : undefined;
              return { data: getRequestCounts(Number.isFinite(windowMs) ? windowMs : undefined) };
            },
          },
        },
        {
          path: "/api/debug/requests/reset",
          handlers: {
            post: async () => {
              resetRequestCounts();
              return { data: { ok: true } };
            },
          },
        },
      ]
    : [],
});

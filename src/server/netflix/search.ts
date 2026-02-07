import { dbNetflixMeta, dbNetflixTitles } from "./db";
import { rewriteQuery } from "./queryRewrite";
import { embedQuery, rerank } from "./voyage";
import { splitGenres } from "./utils";

const CANONICAL_GENRE_ORDER = [
  "Action",
  "Adventure",
  "Anime",
  "Animation",
  "Biography",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Kids",
  "Musical",
  "Mystery",
  "Reality",
  "Romance",
  "Sci-Fi",
  "Sports",
  "Thriller",
  "War",
  "Western",
] as const;

function canonicalizeGenre(raw: string): string | null {
  const g = raw.toLowerCase().trim();
  if (!g) return null;

  if (g.includes("international")) return null;

  if (g.includes("anime")) return "Anime";
  if (g.includes("documentar") || g.includes("docuseries")) return "Documentary";
  if (g.includes("biograph")) return "Biography";
  if (g.includes("histor")) return "History";
  if (g.includes("war")) return "War";
  if (g.includes("western")) return "Western";
  if (g.includes("sports")) return "Sports";
  if (g.includes("reality")) return "Reality";
  if (g.includes("stand-up")) return "Comedy";
  if (g.includes("comed")) return "Comedy";
  if (g.includes("crime")) return "Crime";
  if (g.includes("thriller")) return "Thriller";
  if (g.includes("myster")) return "Mystery";
  if (g.includes("horror")) return "Horror";
  if (g.includes("sci-fi")) return "Sci-Fi";
  if (g.includes("fantasy")) return "Fantasy";
  if (g.includes("action")) return "Action";
  if (g.includes("adventure")) return "Adventure";
  if (g.includes("romantic")) return "Romance";
  if (g.includes("drama")) return "Drama";
  if (g.includes("music") || g.includes("musical")) return "Musical";
  if (g.includes("kids tv")) return "Kids";
  if (g.includes("children") || g.includes("family") || g.includes("kids")) return "Family";
  if (g.includes("animation")) return "Animation";
  if (g.includes("faith") || g.includes("spiritual")) return "Documentary";
  if (g.includes("independent") || g.includes("classic") || g.includes("cult")) return "Drama";
  if (g.includes("lgbtq")) return "Drama";

  return null;
}

function normalizedGenres(genres: string) {
  const out = new Set<string>();
  for (const g of splitGenres(genres)) {
    const normalized = canonicalizeGenre(g);
    if (normalized) out.add(normalized);
  }
  return [...out];
}

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "best",
  "for",
  "from",
  "good",
  "how",
  "i",
  "in",
  "is",
  "it",
  "like",
  "me",
  "movie",
  "movies",
  "my",
  "netflix",
  "of",
  "on",
  "or",
  "recommend",
  "recommendations",
  "recs",
  "series",
  "show",
  "shows",
  "similar",
  "some",
  "the",
  "this",
  "to",
  "tv",
  "watch",
  "with",
]);

type NetflixDoc = {
  show_id: string;
  type: string;
  title: string;
  director: string;
  cast: string;
  country: string;
  date_added: string;
  release_year?: number;
  rating: string;
  duration: string;
  genres: string;
  description: string;
  genres_list?: string[];
  score?: number;
};

export type SearchResult = {
  query: string;
  total: number;
  page: number;
  pageSize: number;
  results: NetflixDoc[];
};

export type SearchOptions = {
  page?: number;
  pageSize?: number;
  type?: string;
  rating?: string;
  year?: number | null;
  genre?: string;
  sort?: "relevance" | "year_desc" | "year_asc" | "title_asc";
  doRerank?: boolean;
  rerankTopK?: number;
  minScore?: number;
  minScoreRatio?: number;
};

function extractKeywords(text: string) {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of cleaned.split(" ")) {
    const w = token.trim();
    if (w.length < 3) continue;
    if (STOPWORDS.has(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= 12) break;
  }
  return out;
}

function lexicalBoost(item: NetflixDoc, keywords: string[]) {
  if (keywords.length === 0) return 0;
  const title = item.title.toLowerCase();
  const genres = item.genres.toLowerCase();
  const desc = item.description.toLowerCase();

  let hits = 0;
  let score = 0;
  for (const kw of keywords) {
    if (title.includes(kw)) {
      hits++;
      score += 3;
      continue;
    }
    if (genres.includes(kw)) {
      hits++;
      score += 2;
      continue;
    }
    if (desc.includes(kw)) {
      hits++;
      score += 1;
      continue;
    }
  }

  if (hits < 2) return 0;
  return score;
}

function buildContent(item: NetflixDoc) {
  const parts = [
    `Title: ${item.title}`,
    item.genres ? `Genres: ${item.genres}` : "",
    item.release_year ? `Year: ${item.release_year}` : "",
    item.type ? `Type: ${item.type}` : "",
    item.description ? `Description: ${item.description}` : "",
  ].filter(Boolean);

  return parts.join("\n");
}

function formatResult(doc: Record<string, unknown>): NetflixDoc {
  return {
    show_id: String(doc.show_id ?? ""),
    type: String(doc.type ?? ""),
    title: String(doc.title ?? ""),
    director: String(doc.director ?? ""),
    cast: String(doc.cast ?? ""),
    country: String(doc.country ?? ""),
    date_added: String(doc.date_added ?? ""),
    release_year: typeof doc.release_year === "number" ? doc.release_year : undefined,
    rating: String(doc.rating ?? ""),
    duration: String(doc.duration ?? ""),
    genres: String(doc.genres ?? ""),
    description: String(doc.description ?? ""),
    genres_list: Array.isArray(doc.genres_list) ? (doc.genres_list as string[]) : undefined,
    score: typeof doc.score === "number" ? doc.score : undefined,
  };
}

function matchesFilters(
  item: NetflixDoc,
  filters: {
    type?: string | null;
    rating?: string | null;
    year?: number | null;
    genre?: string | null;
  },
) {
  if (filters.type && item.type !== filters.type) return false;
  if (filters.rating && item.rating !== filters.rating) return false;
  if (filters.year && item.release_year !== filters.year) return false;
  if (filters.genre) {
    const list = normalizedGenres(item.genres);
    if (!list.includes(filters.genre)) return false;
  }
  return true;
}

function sortResults(items: NetflixDoc[], sort: SearchOptions["sort"]) {
  if (sort === "title_asc") {
    items.sort((a, b) => a.title.localeCompare(b.title) || (b.score ?? 0) - (a.score ?? 0));
    return;
  }
  if (sort === "year_asc") {
    items.sort(
      (a, b) =>
        (a.release_year ?? 9999) - (b.release_year ?? 9999) || (b.score ?? 0) - (a.score ?? 0),
    );
    return;
  }
  if (sort === "year_desc") {
    items.sort(
      (a, b) => (b.release_year ?? -1) - (a.release_year ?? -1) || (b.score ?? 0) - (a.score ?? 0),
    );
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CANONICAL_GENRE_MATCHERS: Record<string, RegExp> = {
  Action: /action/i,
  Adventure: /adventure/i,
  Anime: /anime/i,
  Animation: /animation/i,
  Biography: /biograph/i,
  Comedy: /stand-up|comed/i,
  Crime: /crime/i,
  Documentary: /documentar|docuseries|faith|spiritual/i,
  Drama: /drama/i,
  Family: /children|family|kids/i,
  Fantasy: /fantasy/i,
  History: /histor/i,
  Horror: /horror/i,
  Kids: /kids tv/i,
  Musical: /music|musical/i,
  Mystery: /myster/i,
  Reality: /reality/i,
  Romance: /romantic/i,
  "Sci-Fi": /sci-fi/i,
  Sports: /sports/i,
  Thriller: /thriller/i,
  War: /war/i,
  Western: /western/i,
};

function genreRegex(genre: string) {
  const matcher = CANONICAL_GENRE_MATCHERS[genre];
  if (matcher) return matcher;
  return new RegExp(`(^|,\\s*)${escapeRegExp(genre.trim())}(,|$)`, "i");
}

export async function getFilters() {
  const doc = await dbNetflixMeta.fetch({ key: "filters" }, { limit: 1 });
  const cached = doc[0];
  if (cached?.types && cached?.ratings && cached?.years && cached?.genres) {
    return {
      types: cached.types,
      ratings: cached.ratings,
      years: cached.years,
      genres: [...CANONICAL_GENRE_ORDER],
    };
  }

  const cursor = await dbNetflixTitles.aggregate([
    { $project: { type: 1, rating: 1, release_year: 1, genres: 1 } },
  ]);
  const rows = await cursor.toArray();
  const items = rows.map((row) => ({
    type: String(row.type ?? ""),
    rating: String(row.rating ?? ""),
    release_year: typeof row.release_year === "number" ? row.release_year : undefined,
    genres: String(row.genres ?? ""),
  }));

  const types = new Set<string>();
  const ratings = new Set<string>();
  const years = new Set<number>();
  const genreCounts = new Map<string, number>();
  for (const item of items) {
    if (item.type) types.add(item.type);
    if (item.rating) ratings.add(item.rating);
    if (item.release_year) years.add(item.release_year);
    for (const g of normalizedGenres(item.genres)) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
  }

  const genres = [...CANONICAL_GENRE_ORDER];

  return {
    types: [...types].sort((a, b) => a.localeCompare(b)),
    ratings: [...ratings].sort((a, b) => a.localeCompare(b)),
    years: [...years].sort((a, b) => b - a),
    genres,
  };
}

export async function searchNetflix(query: string, opts?: SearchOptions): Promise<SearchResult> {
  const q = query.trim();
  const pageSize = Math.min(Math.max(opts?.pageSize ?? 20, 1), 80);
  const page = Math.min(Math.max(opts?.page ?? 1, 1), 10_000);
  const offset = (page - 1) * pageSize;

  const filterType = opts?.type && opts.type !== "all" ? opts.type : null;
  const filterRating = opts?.rating && opts.rating !== "all" ? opts.rating : null;
  const filterYear = opts?.year ?? null;
  const filterGenre = opts?.genre && opts.genre !== "all" ? opts.genre : null;

  const sort = opts?.sort ?? (q ? "relevance" : "year_desc");
  const filters = { type: filterType, rating: filterRating, year: filterYear, genre: filterGenre };

  if (!q) {
    const match: Record<string, unknown> = {};
    if (filterType) match.type = filterType;
    if (filterRating) match.rating = filterRating;
    if (filterYear) match.release_year = filterYear;
    if (filterGenre) {
      match.$or = [{ genres_list: filterGenre }, { genres: { $regex: genreRegex(filterGenre) } }];
    }

    const sortDoc =
      sort === "title_asc"
        ? { title: 1, _id: 1 }
        : sort === "year_asc"
          ? { release_year: 1, _id: 1 }
          : { release_year: -1, _id: -1 };

    const cursor = await dbNetflixTitles.aggregate([
      { $match: match },
      { $sort: sortDoc },
      { $skip: offset },
      { $limit: pageSize },
      { $project: { embedding: 0 } },
    ]);
    const rows = await cursor.toArray();
    const total = await dbNetflixTitles.countDocuments(match);
    const results = rows.map((row) => formatResult(row));
    return { query: q, total, page, pageSize, results };
  }

  const rewrite = await rewriteQuery(q);
  const qEmb = await embedQuery(rewrite.embedQuery ?? q, { model: "voyage-4-lite" });
  if (qEmb.length === 0) {
    return { query: q, total: 0, page, pageSize, results: [] };
  }

  const numCandidates = Math.min(2000, Math.max(pageSize * 20, 200));
  const limit = Math.min(numCandidates, offset + pageSize + 200);
  const cursor = await dbNetflixTitles.vectorSearch({
    field: "embedding",
    embedding: qEmb,
    numCandidates,
    limit,
    indexName: "embeddingVector",
    projection: {
      embedding: 0,
      score: { $meta: "vectorSearchScore" },
    },
  });

  const rows = await cursor.toArray();
  const scored = rows.map((row) => formatResult(row)).filter((row) => matchesFilters(row, filters));

  if (scored.length === 0) {
    return { query: q, total: 0, page, pageSize, results: [] };
  }

  const maxScore = Math.max(...scored.map((s) => s.score ?? 0));
  let ratio = opts?.minScoreRatio ?? rewrite.minScoreRatio ?? 0.75;
  if (!Number.isFinite(ratio)) ratio = 0.75;
  ratio = Math.min(Math.max(ratio, 0), 1);
  const minScore =
    Number.isFinite(opts?.minScore as number) && typeof opts?.minScore === "number"
      ? (opts!.minScore as number)
      : maxScore * ratio;

  let ordered = scored.filter((s) => (s.score ?? 0) >= minScore);

  const preferredType = rewrite.preferredType ?? "Any";
  if (!filterType && preferredType !== "Any") {
    ordered = ordered.map((row) => ({
      ...row,
      score: (row.score ?? 0) + (row.type === preferredType ? 0.006 : 0),
    }));
  }

  ordered.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const keywords = extractKeywords(`${rewrite.embedQuery ?? q} ${q}`);
  const boostScopeSize = Math.min(500, ordered.length);
  if (keywords.length > 0 && boostScopeSize > 0) {
    const head = ordered
      .slice(0, boostScopeSize)
      .map((item) => ({
        item,
        boosted: (item.score ?? 0) + lexicalBoost(item, keywords) * 0.02,
      }))
      .sort((a, b) => b.boosted - a.boosted)
      .map((x) => x.item);
    ordered = [...head, ...ordered.slice(boostScopeSize)];
  }

  if (opts?.doRerank !== false && ordered.length > 0) {
    const rerankScopeSize = Math.min(100, ordered.length);
    const rerankScope = ordered.slice(0, rerankScopeSize);
    const docs = rerankScope.map(buildContent);
    const rerankTopK = Math.min(
      Math.max(opts?.rerankTopK ?? Math.min(20, rerankScope.length), 1),
      rerankScope.length,
    );

    try {
      const reranked = await rerank(rewrite.rerankQuery ?? q, docs, { topK: rerankTopK });
      const picked = new Set<number>();
      const front = reranked
        .map((r) => {
          const docIndex = r.index ?? -1;
          const item = rerankScope[docIndex];
          if (!item) return null;
          picked.add(docIndex);
          return { ...item, score: r.relevanceScore ?? item.score };
        })
        .filter(Boolean) as NetflixDoc[];

      const rest = [
        ...rerankScope.filter((_, i) => !picked.has(i)),
        ...ordered.slice(rerankScopeSize),
      ];
      ordered = [...front, ...rest];
    } catch {
      // If rerank fails, fallback to current ordering.
    }
  }

  sortResults(ordered, sort);

  const total = ordered.length;
  const results = ordered.slice(offset, offset + pageSize);
  return { query: q, total, page, pageSize, results };
}

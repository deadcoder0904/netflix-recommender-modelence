import { embedDocuments } from "./voyage";
import { loadNetflixCsv } from "./csv";
import { dbNetflixMeta, dbNetflixTitles } from "./db";
import { loadLocalIndex } from "./localIndex";
import { chunkArray, splitGenres } from "./utils";
import { ensureMetaCollectionReady } from "./metaCleanup";

type SeedResult = {
  source: "local-index" | "csv" | "none";
  total: number;
  inserted: number;
  dimensions?: number;
  model?: string;
};

type NetflixTitleInsert = {
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
  genres_list: string[];
  description: string;
  embedding: number[];
  embedding_model?: string;
  createdAt: Date;
  updatedAt: Date;
};

let seedPromise: Promise<SeedResult> | null = null;

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

export async function ensureSeeded() {
  return (seedPromise ??= seedNetflix());
}

async function seedNetflix(): Promise<SeedResult> {
  await ensureMetaCollectionReady();
  const index = await loadLocalIndex();
  if (index) {
    return seedFromIndex(index);
  }
  return seedFromCsv();
}

async function fetchExistingIds() {
  const cursor = await dbNetflixTitles.aggregate([{ $project: { show_id: 1 } }]);
  const docs = await cursor.toArray();
  const out = new Set<string>();
  for (const doc of docs) {
    if (typeof doc.show_id === "string") out.add(doc.show_id);
  }
  return out;
}

function computeFilters(
  items: Array<{ type: string; rating: string; release_year?: number; genres: string }>,
) {
  const types = new Set<string>();
  const ratings = new Set<string>();
  const years = new Set<number>();
  const genreCounts = new Map<string, number>();

  for (const item of items) {
    if (!item.type || !item.genres) continue;
    if (item.type) types.add(item.type);
    if (item.rating) ratings.add(item.rating);
    if (item.release_year) years.add(item.release_year);
    for (const g of normalizedGenres(item.genres)) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
  }

  const genres = CANONICAL_GENRE_ORDER.filter((g) => genreCounts.has(g)).slice(0, 24);

  return {
    types: [...types].sort((a, b) => a.localeCompare(b)),
    ratings: [...ratings].sort((a, b) => a.localeCompare(b)),
    years: [...years].sort((a, b) => b - a),
    genres,
  };
}

async function seedFromIndex(
  index: NonNullable<Awaited<ReturnType<typeof loadLocalIndex>>>,
): Promise<SeedResult> {
  const existingCount = await dbNetflixTitles.countDocuments({});
  if (existingCount >= index.manifest.count) {
    return {
      source: "local-index",
      total: existingCount,
      inserted: 0,
      dimensions: index.manifest.dimensions,
      model: index.manifest.model,
    };
  }

  const existingIds = await fetchExistingIds();
  const dims = index.manifest.dimensions;
  const now = new Date();
  let inserted = 0;
  let batch: NetflixTitleInsert[] = [];

  for (let i = 0; i < index.metadata.length; i++) {
    const meta = index.metadata[i]!;
    if (!meta.title || !meta.description) continue;
    if (existingIds.has(meta.show_id)) continue;

    const start = i * dims;
    const embedding = Array.from(index.embeddings.subarray(start, start + dims));
    batch.push({
      show_id: meta.show_id,
      type: meta.type,
      title: meta.title,
      director: meta.director ?? "",
      cast: meta.cast ?? "",
      country: meta.country ?? "",
      date_added: meta.date_added ?? "",
      release_year: meta.release_year,
      rating: meta.rating ?? "",
      duration: meta.duration ?? "",
      genres: meta.genres ?? "",
      genres_list: splitGenres(meta.genres ?? ""),
      description: meta.description ?? "",
      embedding,
      embedding_model: index.manifest.model,
      createdAt: now,
      updatedAt: now,
    });

    if (batch.length >= 200) {
      await dbNetflixTitles.insertMany(batch);
      inserted += batch.length;
      batch = [];
    }
  }

  if (batch.length) {
    await dbNetflixTitles.insertMany(batch);
    inserted += batch.length;
  }

  const filters = computeFilters(index.metadata);
  await dbNetflixMeta.upsertOne(
    { key: "index" },
    {
      $set: {
        key: "index",
        count: index.manifest.count,
        dimensions: index.manifest.dimensions,
        model: index.manifest.model,
        source: "local-index",
        createdAt: new Date(index.manifest.createdAt),
        updatedAt: new Date(),
      },
    },
  );
  await dbNetflixMeta.upsertOne(
    { key: "filters" },
    {
      $set: {
        key: "filters",
        ...filters,
        updatedAt: new Date(),
      },
    },
  );

  const total = existingCount + inserted;
  return {
    source: "local-index",
    total,
    inserted,
    dimensions: index.manifest.dimensions,
    model: index.manifest.model,
  };
}

async function seedFromCsv(): Promise<SeedResult> {
  const rows = await loadNetflixCsv();
  if (rows.length === 0) {
    return { source: "none", total: 0, inserted: 0 };
  }

  const existingCount = await dbNetflixTitles.countDocuments({});
  if (existingCount >= rows.length) {
    return { source: "csv", total: existingCount, inserted: 0, model: "voyage-4-lite" };
  }

  const existingIds = await fetchExistingIds();
  const missing = rows.filter((row) => !existingIds.has(row.show_id));
  if (missing.length === 0) {
    return { source: "csv", total: existingCount, inserted: 0, model: "voyage-4-lite" };
  }

  const now = new Date();
  let inserted = 0;

  for (const batch of chunkArray(missing, 64)) {
    const embeddings = await embedDocuments(
      batch.map((b) => b.embeddingContent),
      {
        model: "voyage-4-lite",
      },
    );

    const docs: NetflixTitleInsert[] = batch.map((row, idx) => ({
      show_id: row.show_id,
      type: row.type,
      title: row.title,
      director: row.director ?? "",
      cast: row.cast ?? "",
      country: row.country ?? "",
      date_added: row.date_added ?? "",
      release_year: row.release_year,
      rating: row.rating ?? "",
      duration: row.duration ?? "",
      genres: row.genres ?? "",
      genres_list: row.genres_list,
      description: row.description ?? "",
      embedding: embeddings[idx] ?? [],
      embedding_model: "voyage-4-lite",
      createdAt: now,
      updatedAt: now,
    }));

    if (docs.length) {
      await dbNetflixTitles.insertMany(docs);
      inserted += docs.length;
    }
  }

  const filters = computeFilters(rows);
  await dbNetflixMeta.upsertOne(
    { key: "index" },
    {
      $set: {
        key: "index",
        count: rows.length,
        dimensions: 1024,
        model: "voyage-4-lite",
        source: "csv",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );
  await dbNetflixMeta.upsertOne(
    { key: "filters" },
    {
      $set: {
        key: "filters",
        ...filters,
        updatedAt: new Date(),
      },
    },
  );

  return { source: "csv", total: existingCount + inserted, inserted, model: "voyage-4-lite" };
}

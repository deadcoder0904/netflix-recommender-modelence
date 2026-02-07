import { Store, schema } from "modelence/server";

export const dbNetflixTitles = new Store("netflix_titles", {
  schema: {
    show_id: schema.string(),
    type: schema.string(),
    title: schema.string(),
    director: schema.string(),
    cast: schema.string(),
    country: schema.string(),
    date_added: schema.string(),
    release_year: schema.number().optional(),
    rating: schema.string(),
    duration: schema.string(),
    genres: schema.string(),
    genres_list: schema.array(schema.string()),
    description: schema.string(),
    embedding: schema.embedding(),
    embedding_model: schema.string().optional(),
    createdAt: schema.date(),
    updatedAt: schema.date(),
  },
  indexes: [
    { key: { show_id: 1 }, unique: true },
    { key: { type: 1 } },
    { key: { rating: 1 } },
    { key: { release_year: -1 } },
    { key: { genres_list: 1 } },
    { key: { title: 1 } },
  ],
  searchIndexes: [
    Store.vectorIndex({
      field: "embedding",
      dimensions: 1024,
      similarity: "cosine",
      indexName: "embeddingVector",
    }),
  ],
});

export const dbNetflixPosters = new Store("netflix_posters", {
  schema: {
    key: schema.string(),
    show_id: schema.string().optional(),
    title: schema.string(),
    type: schema.string(),
    year: schema.number().optional(),
    tmdb_id: schema.number().optional(),
    poster_path: schema.string().optional(),
    backdrop_path: schema.string().optional(),
    poster_url: schema.string().optional(),
    thumb_url: schema.string().optional(),
    status: schema.string(),
    error_count: schema.number().optional(),
    last_error_at: schema.date().optional(),
    cooldown_until: schema.date().optional(),
    updatedAt: schema.date(),
  },
  indexes: [{ key: { key: 1 } }, { key: { updatedAt: -1 } }],
});

export const dbNetflixMeta = new Store("netflix_meta", {
  schema: {
    key: schema.string(),
    count: schema.number().optional(),
    dimensions: schema.number().optional(),
    model: schema.string().optional(),
    source: schema.string().optional(),
    types: schema.array(schema.string()).optional(),
    ratings: schema.array(schema.string()).optional(),
    years: schema.array(schema.number()).optional(),
    genres: schema.array(schema.string()).optional(),
    createdAt: schema.date().optional(),
    updatedAt: schema.date(),
  },
  indexes: [],
});

export const dbNetflixFavorites = new Store("netflix_favorites", {
  schema: {
    owner_type: schema.enum(["user", "session"]),
    owner_id: schema.string(),
    show_id: schema.string(),
    createdAt: schema.date(),
  },
  indexes: [
    { key: { owner_type: 1, owner_id: 1, show_id: 1 }, unique: true },
    { key: { owner_type: 1, owner_id: 1, createdAt: -1 } },
  ],
});

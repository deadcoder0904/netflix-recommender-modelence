import { Store, schema } from "modelence/server";

export const dbPicks = new Store("picks", {
  schema: {
    title: schema.string(),
    type: schema.string(), // 'movie' | 'show'
    rating: schema.string(), // 'G', 'PG', 'PG-13', 'R', 'TV-MA', 'TV-14', etc.
    year: schema.number(),
    description: schema.string(),
    genres: schema.array(schema.string()),
    imageUrl: schema.string().optional(),
    createdAt: schema.date(),
  },
  indexes: [
    { key: { title: "text", description: "text", genres: "text" } },
    { key: { type: 1 } },
    { key: { rating: 1 } },
    { key: { year: -1 } },
    { key: { genres: 1 } },
  ],
});

import { dbNetflixFavorites, dbNetflixTitles } from "./db";

type Owner = { owner_type: "user" | "session"; owner_id: string };

export function getOwner(ctx: any): Owner {
  const userId = ctx?.user?.id;
  if (typeof userId === "string" && userId.trim()) {
    return { owner_type: "user", owner_id: userId };
  }
  const token = ctx?.session?.authToken;
  if (typeof token === "string" && token.trim()) {
    return { owner_type: "session", owner_id: token };
  }
  throw new Error("Missing session - cannot identify favorites owner");
}

export async function isFavorited(owner: Owner, showId: string) {
  const existing = await dbNetflixFavorites.fetch({ ...owner, show_id: showId }, { limit: 1 });
  return Boolean(existing[0]);
}

export async function getFavoritesForShowIds(owner: Owner, showIds: string[]) {
  if (showIds.length === 0) return new Set<string>();
  const rows = await dbNetflixFavorites.fetch(
    { ...owner, show_id: { $in: showIds } },
    { limit: Math.min(showIds.length, 1000) },
  );
  return new Set(rows.map((r) => String((r as any).show_id ?? "")).filter(Boolean));
}

export async function toggleFavorite(owner: Owner, showId: string) {
  const existing = await dbNetflixFavorites.fetch({ ...owner, show_id: showId }, { limit: 1 });
  if (existing[0]?._id) {
    await dbNetflixFavorites.deleteOne({ _id: existing[0]._id } as any);
    return { show_id: showId, is_favorite: false };
  }

  const targetCount = await dbNetflixTitles.countDocuments({ show_id: showId });
  if (targetCount <= 0) throw new Error("Title not found");

  await dbNetflixFavorites.insertOne({
    ...owner,
    show_id: showId,
    createdAt: new Date(),
  });

  return { show_id: showId, is_favorite: true };
}

export async function listFavorites(owner: Owner, opts?: { page?: number; pageSize?: number }) {
  const pageSize = Math.min(Math.max(opts?.pageSize ?? 20, 1), 80);
  const page = Math.min(Math.max(opts?.page ?? 1, 1), 10_000);
  const offset = (page - 1) * pageSize;

  const cursor = await dbNetflixFavorites.aggregate([
    { $match: owner },
    { $sort: { createdAt: -1, _id: -1 } },
    { $skip: offset },
    { $limit: pageSize },
    {
      $lookup: {
        from: "netflix_titles",
        let: { sid: "$show_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$show_id", "$$sid"] } } },
          { $project: { embedding: 0 } },
        ],
        as: "title",
      },
    },
    { $unwind: "$title" },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [
            "$title",
            {
              is_favorite: true,
            },
          ],
        },
      },
    },
  ]);

  const results = await cursor.toArray();
  const total = await dbNetflixFavorites.countDocuments(owner);

  return {
    total,
    page,
    pageSize,
    results,
  };
}

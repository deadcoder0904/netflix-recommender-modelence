import type { Collection, ObjectId } from "mongodb";
import { dbNetflixMeta } from "./db";

let cleanedOnce = false;

export async function ensureMetaCollectionReady() {
  if (cleanedOnce) return;
  cleanedOnce = true;
  const collection = dbNetflixMeta.rawCollection();
  await cleanupMetaCollection(collection);
}

export async function cleanupMetaCollection(collection: Collection<any>) {
  const indexes = await collection.indexes();
  const singletonIndex = indexes.find((idx) => idx.name === "singleton_1");
  if (singletonIndex) {
    await collection.dropIndex("singleton_1");
  }

  await collection.deleteMany({
    $or: [{ key: { $exists: false } }, { key: null }, { key: "" }],
  });

  const duplicates = await collection
    .aggregate([
      { $match: { key: { $type: "string", $ne: "" } } },
      { $sort: { updatedAt: -1 } },
      {
        $group: {
          _id: "$key",
          ids: { $push: "$_id" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  for (const dup of duplicates) {
    const ids = (dup.ids ?? []) as ObjectId[];
    if (ids.length <= 1) continue;
    await collection.deleteMany({ _id: { $in: ids.slice(1) } });
  }
}

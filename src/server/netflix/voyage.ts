import { VoyageAIClient } from "voyageai";

let client: VoyageAIClient | null = null;
const queryEmbedCache = new Map<string, { at: number; embedding: number[] }>();
const QUERY_EMBED_TTL_MS = 60 * 60_000;
const QUERY_EMBED_MAX = 200;

function getClient() {
  if (client) return client;
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY environment variable is not set");
  client = new VoyageAIClient({ apiKey });
  return client;
}

export async function embedQuery(text: string, opts?: { model?: string }) {
  const model = opts?.model ?? "voyage-4-lite";
  const key = `${model}::${text}`;
  const now = Date.now();
  const cached = queryEmbedCache.get(key);
  if (cached && now - cached.at < QUERY_EMBED_TTL_MS) return cached.embedding;

  const result = await getClient().embed({
    input: [text],
    model,
    inputType: "query",
  });
  const embedding = result.data?.[0]?.embedding ?? [];
  queryEmbedCache.set(key, { at: now, embedding });
  if (queryEmbedCache.size > QUERY_EMBED_MAX) {
    const first = queryEmbedCache.keys().next().value;
    if (first) queryEmbedCache.delete(first);
  }
  return embedding;
}

export async function embedDocuments(texts: string[], opts?: { model?: string }) {
  const result = await getClient().embed({
    input: texts,
    model: opts?.model ?? "voyage-4-lite",
    inputType: "document",
  });
  return result.data?.map((d) => d.embedding ?? []) ?? [];
}

export async function rerank(
  query: string,
  documents: string[],
  opts?: { model?: string; topK?: number },
) {
  const result = await getClient().rerank({
    model: opts?.model ?? "rerank-2.5-lite",
    query,
    documents,
    topK: opts?.topK ?? Math.min(10, documents.length),
  });
  return result.data ?? [];
}

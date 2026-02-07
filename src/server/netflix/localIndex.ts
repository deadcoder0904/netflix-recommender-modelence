import path from "node:path";
import { readFile } from "node:fs/promises";

export type NetflixTitleMetadata = {
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
};

type IndexManifestV1 = {
  version: 1;
  model: string;
  inputType: "document";
  dimensions: number;
  count: number;
  createdAt: string;
  embeddingsFile: string;
  normsFile: string;
  metadataFile: string;
};

export type LocalIndex = {
  manifest: IndexManifestV1;
  embeddings: Float32Array;
  metadata: NetflixTitleMetadata[];
};

function resolvePath(rel: string) {
  return path.resolve(process.cwd(), rel);
}

export async function loadLocalIndex(): Promise<LocalIndex | null> {
  const manifestPath = resolvePath("data/netflix.index.json");
  const manifestText = await readFile(manifestPath, "utf8").catch(() => "");
  if (!manifestText) return null;

  const manifest = JSON.parse(manifestText) as IndexManifestV1;
  if (manifest.version !== 1) throw new Error("Unsupported index version");

  const embeddingsPath = resolvePath(manifest.embeddingsFile);
  const metadataPath = resolvePath(manifest.metadataFile);

  const [embBuf, metadataText] = await Promise.all([
    readFile(embeddingsPath),
    readFile(metadataPath, "utf8"),
  ]);

  const embeddings = new Float32Array(
    embBuf.buffer,
    embBuf.byteOffset,
    Math.floor(embBuf.byteLength / 4),
  );

  const metadataRaw = JSON.parse(metadataText) as NetflixTitleMetadata[];
  const metadata = metadataRaw.map((m) => ({
    ...m,
    title: (m.title ?? "").trim(),
    description: (m.description ?? "").trim(),
    release_year: m.release_year && m.release_year > 0 ? m.release_year : undefined,
  }));

  return { manifest, embeddings, metadata };
}

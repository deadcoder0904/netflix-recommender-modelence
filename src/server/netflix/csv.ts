import path from "node:path";
import { readFile } from "node:fs/promises";
import { splitGenres, toOptionalNumber } from "./utils";

export type NetflixCsvRow = {
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
  genres_list: string[];
  embeddingContent: string;
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (ch === "\n") {
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
      continue;
    }

    if (ch === "\r") continue;
    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function buildEmbeddingContent(item: Omit<NetflixCsvRow, "embeddingContent" | "genres_list">) {
  const parts = [
    `Title: ${item.title}`,
    `Type: ${item.type}`,
    item.release_year ? `Year: ${item.release_year}` : "",
    item.rating ? `Rating: ${item.rating}` : "",
    item.duration ? `Duration: ${item.duration}` : "",
    item.genres ? `Genres: ${item.genres}` : "",
    item.country ? `Country: ${item.country}` : "",
    item.director ? `Director: ${item.director}` : "",
    item.cast ? `Cast: ${item.cast}` : "",
    item.description ? `Description: ${item.description}` : "",
  ].filter(Boolean);

  return parts.join("\n");
}

export async function loadNetflixCsv(opts?: { limit?: number }) {
  const csvPath = path.resolve(process.cwd(), "netflix.csv");
  const text = await readFile(csvPath, "utf8").catch(() => "");
  if (!text) return [];

  const rows = parseCsv(text);
  if (rows.length <= 1) return [];

  const header = rows[0] ?? [];
  const colIndex = new Map<string, number>();
  for (let i = 0; i < header.length; i++) colIndex.set(header[i] ?? "", i);

  const get = (cells: string[], name: string) => {
    const idx = colIndex.get(name);
    if (idx === undefined) return "";
    return cells[idx] ?? "";
  };

  const out: NetflixCsvRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    if (opts?.limit && out.length >= opts.limit) break;
    const cells = rows[i] ?? [];
    if (cells.length === 0) continue;

    const itemBase = {
      show_id: get(cells, "show_id"),
      type: get(cells, "type"),
      title: get(cells, "title"),
      director: get(cells, "director"),
      cast: get(cells, "cast"),
      country: get(cells, "country"),
      date_added: get(cells, "date_added"),
      release_year: toOptionalNumber(get(cells, "release_year")),
      rating: get(cells, "rating"),
      duration: get(cells, "duration"),
      genres: get(cells, "genres"),
      description: get(cells, "description"),
    };

    out.push({
      ...itemBase,
      genres_list: splitGenres(itemBase.genres),
      embeddingContent: buildEmbeddingContent(itemBase),
    });
  }

  return out;
}

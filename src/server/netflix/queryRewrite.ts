type RewriteResult = {
  embedQuery: string;
  rerankQuery: string;
  minScoreRatio: number;
  preferredType: "Movie" | "TV Show" | "Any";
};

type Cached = { at: number; value: RewriteResult };

const cache = new Map<string, Cached>();
let openRouterBlockedUntil = 0;

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function normalizeQueryForRewrite(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const cleaned = trimmed
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[^a-zA-Z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length !== 1) return cleaned;

  const word = parts[0] ?? "";
  if (word.includes("-") || word.includes("'")) return word;

  const lower = word.toLowerCase();
  if (lower.length >= 7 && lower.endsWith("ing")) return word.slice(0, -3);
  if (lower.length >= 6 && lower.endsWith("ed")) return word.slice(0, -2);
  if (lower === "series") return word;
  if (lower.length >= 6 && lower.endsWith("s")) return word.slice(0, -1);
  return word;
}

function wordLimit(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}

function inferPreferredType(q: string): RewriteResult["preferredType"] {
  const lower = q.toLowerCase();
  if (/\b(movie|film|films|cinema)\b/.test(lower)) return "Movie";
  if (/\b(tv|show|shows|series|episodes)\b/.test(lower)) return "TV Show";
  return "Any";
}

function heuristicRewrite(raw: string): RewriteResult {
  const q = normalizeQueryForRewrite(raw);
  const lower = q.toLowerCase();
  const preferredType = inferPreferredType(q);
  const baseWords = q.split(/\s+/).filter(Boolean);

  const add: string[] = [];
  let typeHint: RewriteResult["preferredType"] = preferredType;

  const rules: Array<{
    match: RegExp;
    add: string[];
    preferredType?: RewriteResult["preferredType"];
    ratio?: number;
  }> = [
    {
      match: /\bmind\s*fuck\b|\bmindfuck\b/,
      add: ["mind-bending", "plot twist", "reality-bending", "psychological thriller", "time loop"],
      ratio: 0.6,
    },
    {
      match: /\bmind[-\s]?bending\b|\breality[-\s]?bending\b|\bplot\s*twist\b/,
      add: ["plot twist", "psychological thriller", "mystery", "unreliable reality"],
      ratio: 0.62,
    },
    { match: /\bpsychological\b/, add: ["mind games", "thriller", "suspense"], ratio: 0.72 },
    { match: /\bthriller\b|\bsuspense\b/, add: ["thriller", "suspense", "mystery"], ratio: 0.7 },
    {
      match: /\brevenge\b|\bvengeance\b|\bpayback\b/,
      add: ["revenge", "vengeance", "payback"],
      ratio: 0.72,
    },
    {
      match: /\btime\s*travel\b|\btime\s*loop\b|\btimeloop\b/,
      add: ["time travel", "time loop", "alternate timeline"],
      ratio: 0.72,
    },
    { match: /\bzombie\b|\bundead\b/, add: ["zombie", "undead", "apocalypse"], ratio: 0.72 },
    {
      match: /\bromcom\b|\bromantic\s+comedy\b/,
      add: ["romantic comedy", "romance", "comedy"],
      ratio: 0.72,
    },
    { match: /\bslow\s*burn\b/, add: ["slow burn", "romance", "character-driven"], ratio: 0.72 },
    {
      match: /\bheist\b|\brobbery\b|\bcon\s*artist\b/,
      add: ["heist", "robbery", "con artists", "caper"],
      ratio: 0.72,
    },
    {
      match: /\bserial\s+killer\b|\bmurder\b/,
      add: ["serial killer", "murder investigation", "crime thriller"],
      ratio: 0.72,
    },
    {
      match: /\bcourt(room)?\b|\btrial\b|\blegal\b/,
      add: ["courtroom", "trial", "legal drama"],
      ratio: 0.74,
    },
    {
      match: /\bstand[- ]?up\b|\bcomedy\s+special\b/,
      add: ["stand-up comedy", "comedy special"],
      ratio: 0.75,
    },
    { match: /\bcooking\b|\bchef\b|\bfood\b/, add: ["cooking", "chef", "culinary"], ratio: 0.75 },
    { match: /\bhorror\b|\bscary\b/, add: ["horror", "scary", "supernatural"], ratio: 0.75 },
    {
      match: /\bsci[- ]?fi\b|\bscience\s+fiction\b/,
      add: ["sci-fi", "science fiction", "futuristic"],
      ratio: 0.75,
    },
    {
      match: /\bk[-\s]?drama\b|\bkorean\s+drama\b/,
      add: ["kdrama", "korean drama", "romance"],
      preferredType: "TV Show",
      ratio: 0.7,
    },
  ];

  let ratio: number | null = null;
  for (const rule of rules) {
    if (!rule.match.test(lower)) continue;
    add.push(...rule.add);
    if (rule.preferredType && preferredType === "Any") typeHint = rule.preferredType;
    if (typeof rule.ratio === "number") ratio = Math.min(ratio ?? 1, rule.ratio);
  }

  const wordsCount = baseWords.length;
  const defaultRatio = wordsCount <= 2 ? 0.65 : wordsCount <= 5 ? 0.7 : 0.75;

  const embedQuery = wordLimit([...baseWords, ...add].join(" "), 25);
  const rerankQuery = `Find titles that match: ${embedQuery}. Prefer plot/theme matches over literal keyword overlap.`;

  return {
    embedQuery,
    rerankQuery,
    minScoreRatio: clamp(ratio ?? defaultRatio, 0.55, 0.9),
    preferredType: typeHint,
  };
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

export async function rewriteQuery(raw: string): Promise<RewriteResult> {
  const q = normalizeQueryForRewrite(raw);
  if (!q) return heuristicRewrite(q);

  const cached = cache.get(q);
  const now = Date.now();
  if (cached && now - cached.at < 10 * 60_000) return cached.value;

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    const value = heuristicRewrite(q);
    cache.set(q, { at: now, value });
    return value;
  }

  if (openRouterBlockedUntil && now < openRouterBlockedUntil) {
    const value = heuristicRewrite(q);
    cache.set(q, { at: now, value });
    return value;
  }

  const model = (process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-oss-20b:free") as string;

  const body = {
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: [
          "You rewrite user queries for a Netflix-style semantic movie/TV search.",
          "Return a JSON object with keys: embedQuery, rerankQuery, minScoreRatio, preferredType.",
          'preferredType must be "Movie", "TV Show", or "Any".',
          "minScoreRatio should be between 0.55 and 0.9.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Rewrite: ${q}`,
      },
    ],
  };

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      if (res.status === 429) openRouterBlockedUntil = Date.now() + 3 * 60_000;
      throw new Error(`OpenRouter request failed (${res.status})`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content);
    if (!parsed) throw new Error("Could not parse rewrite response");

    const value: RewriteResult = {
      embedQuery: String(parsed.embedQuery ?? q),
      rerankQuery: String(parsed.rerankQuery ?? q),
      minScoreRatio: clamp(Number(parsed.minScoreRatio ?? 0.7), 0.55, 0.9),
      preferredType:
        parsed.preferredType === "Movie" || parsed.preferredType === "TV Show"
          ? parsed.preferredType
          : "Any",
    };

    cache.set(q, { at: now, value });
    return value;
  } catch {
    const value = heuristicRewrite(q);
    cache.set(q, { at: now, value });
    return value;
  }
}

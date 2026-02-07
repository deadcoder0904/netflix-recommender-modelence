import { modelenceCall } from "@/client/lib/modelenceCall";

type PosterRequest = {
  showId: string;
  title: string;
  type?: string;
  year?: number;
  refresh?: boolean;
};

export type PosterResponse = {
  posterUrl: string | null;
  status: "ready" | "missing" | "error" | "cooldown";
  source: "cache" | "tmdb" | "disabled";
  cooldownUntil: string | null;
};

type BatchResponse = {
  results: Array<
    PosterResponse & {
      showId: string | null;
    }
  >;
};

type Waiter = {
  resolve: (value: PosterResponse) => void;
  reject: (err: unknown) => void;
  req: PosterRequest;
};

const waitersByShowId = new Map<string, Waiter[]>();
let flushTimer: number | null = null;

function scheduleFlush() {
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flush().catch(() => {
      // flush() resolves/rejects all waiters; errors are already propagated there
    });
  }, 20);
}

async function flush() {
  const entries = [...waitersByShowId.entries()];
  if (entries.length === 0) return;

  waitersByShowId.clear();

  const items = entries.map(([, list]) => list[list.length - 1]!.req);
  const byId = new Map<string, PosterResponse>();

  // Server caps at 80 items; split to avoid hard failures when the user scrolls fast.
  const chunks: PosterRequest[][] = [];
  for (let i = 0; i < items.length; i += 80) {
    chunks.push(items.slice(i, i + 80));
  }

  let dataChunks: BatchResponse[];
  try {
    dataChunks = await Promise.all(
      chunks.map((chunk) => modelenceCall<BatchResponse>("netflix.posters", { items: chunk })),
    );
  } catch (err) {
    for (const [, list] of entries) {
      for (const w of list) w.reject(err);
    }
    return;
  }

  for (const data of dataChunks) {
    for (const r of data.results) {
      if (typeof r.showId === "string" && r.showId) {
        byId.set(r.showId, r);
      }
    }
  }

  for (const [showId, list] of entries) {
    const result = byId.get(showId);
    if (!result) {
      const err = new Error(`Missing poster response for ${showId}`);
      for (const w of list) w.reject(err);
      continue;
    }
    for (const w of list) w.resolve(result);
  }
}

export function getPoster(req: PosterRequest): Promise<PosterResponse> {
  return new Promise<PosterResponse>((resolve, reject) => {
    const existing = waitersByShowId.get(req.showId);
    if (existing) {
      existing.push({ resolve, reject, req });
    } else {
      waitersByShowId.set(req.showId, [{ resolve, reject, req }]);
    }
    scheduleFlush();
  });
}

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { modelenceQuery } from "@modelence/react-query";
import netflixN from "@/client/assets/netflix-n.svg";
import LoadingSpinner from "@/client/components/LoadingSpinner";
import { TooltipProvider } from "@/client/components/ui/Tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/Select";
import { NetflixCard, type NetflixItem } from "@/client/features/netflix/NetflixCard";
import { PaginationSection } from "@/client/features/netflix/PaginationSection";

type FiltersResponse = {
  types: string[];
  ratings: string[];
  years: number[];
  genres: string[];
};

type SearchResponse = {
  query: string;
  total: number;
  page: number;
  pageSize: number;
  results: NetflixItem[];
};

type StatusResponse = {
  ready: boolean;
  count?: number;
  dimensions?: number;
  createdAt?: string | null;
  source?: string;
  error?: string;
};

const DEFAULTS = {
  q: "",
  page: 1,
  pageSize: 20,
  type: "all",
  rating: "all",
  year: "all",
  genre: "all",
  sort: "relevance",
  rerank: "1",
} as const;

function parseIntParam(value: string | null, fallback: number) {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function parsePageSize(value: string | null) {
  const n = parseIntParam(value, DEFAULTS.pageSize);
  return Math.min(Math.max(n, 1), 80);
}

function normalizeSort(value: string | null) {
  if (
    value === "relevance" ||
    value === "year_desc" ||
    value === "year_asc" ||
    value === "title_asc"
  ) {
    return value;
  }
  return DEFAULTS.sort;
}

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeQuery = searchParams.get("q") ?? DEFAULTS.q;
  const page = parseIntParam(searchParams.get("page"), DEFAULTS.page);
  const pageSize = parsePageSize(searchParams.get("pageSize"));
  const filterType = searchParams.get("type") ?? DEFAULTS.type;
  const filterRating = searchParams.get("rating") ?? DEFAULTS.rating;
  const filterYear = searchParams.get("year") ?? DEFAULTS.year;
  const filterGenre = searchParams.get("genre") ?? DEFAULTS.genre;
  const sortBy = normalizeSort(searchParams.get("sort"));
  const rerankParam = searchParams.get("rerank") ?? DEFAULTS.rerank;
  const doRerank = rerankParam !== "0";

  const [queryInput, setQueryInput] = useState(activeQuery);

  useEffect(() => {
    setQueryInput(activeQuery);
  }, [activeQuery]);

  const state = useMemo(
    () => ({
      q: activeQuery,
      page,
      pageSize,
      type: filterType,
      rating: filterRating,
      year: filterYear,
      genre: filterGenre,
      sort: sortBy,
      rerank: doRerank ? "1" : "0",
    }),
    [
      activeQuery,
      doRerank,
      filterGenre,
      filterRating,
      filterType,
      filterYear,
      page,
      pageSize,
      sortBy,
    ],
  );

  const updateParams = (updates: Partial<typeof state>) => {
    const nextState = { ...state, ...updates };
    const next = new URLSearchParams();

    if (nextState.q) next.set("q", nextState.q);
    if (nextState.type !== DEFAULTS.type) next.set("type", nextState.type);
    if (nextState.rating !== DEFAULTS.rating) next.set("rating", nextState.rating);
    if (nextState.genre !== DEFAULTS.genre) next.set("genre", nextState.genre);
    if (nextState.year !== DEFAULTS.year) next.set("year", nextState.year);
    if (nextState.sort !== DEFAULTS.sort) next.set("sort", nextState.sort);
    if (nextState.page !== DEFAULTS.page) next.set("page", String(nextState.page));
    if (nextState.pageSize !== DEFAULTS.pageSize) next.set("pageSize", String(nextState.pageSize));
    if (nextState.rerank !== DEFAULTS.rerank) next.set("rerank", nextState.rerank);

    setSearchParams(next, { replace: true });
  };

  const placeholder = useMemo(
    () => 'Try: "mind-bending movies", "slow burn romance", "time travel", "revenge thriller"...',
    [],
  );

  const canClear = useMemo(() => {
    return (
      Boolean(activeQuery.trim()) ||
      filterType !== DEFAULTS.type ||
      filterRating !== DEFAULTS.rating ||
      filterGenre !== DEFAULTS.genre ||
      filterYear !== DEFAULTS.year ||
      sortBy !== DEFAULTS.sort ||
      page !== DEFAULTS.page ||
      pageSize !== DEFAULTS.pageSize ||
      rerankParam !== DEFAULTS.rerank
    );
  }, [
    activeQuery,
    filterGenre,
    filterRating,
    filterType,
    filterYear,
    page,
    pageSize,
    rerankParam,
    sortBy,
  ]);

  const statusQuery = useQuery({
    ...modelenceQuery<StatusResponse>("netflix.status"),
    staleTime: 5 * 60_000,
  });

  const filtersQuery = useQuery({
    ...modelenceQuery<FiltersResponse>("netflix.filters"),
    enabled: statusQuery.data?.ready === true,
    staleTime: 10 * 60_000,
  });

  const yearParam = filterYear !== DEFAULTS.year ? Number(filterYear) : undefined;

  const searchQuery = useQuery({
    ...modelenceQuery<SearchResponse>("netflix.search", {
      q: activeQuery,
      page,
      pageSize,
      type: filterType,
      rating: filterRating,
      year: Number.isFinite(yearParam) ? yearParam : undefined,
      genre: filterGenre,
      sort: sortBy,
      rerank: doRerank,
      rerankTopK: 10,
    }),
    enabled: statusQuery.data?.ready === true,
    placeholderData: (prev) => prev,
  });

  const results = searchQuery.data?.results ?? [];
  const total = searchQuery.data?.total ?? 0;
  const isInitialResultsLoading =
    statusQuery.data?.ready === true && searchQuery.isLoading && !searchQuery.data;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);

  const showingLabel = useMemo(() => {
    if (total === 0) return "0 results";
    return `Showing ${Math.min((page - 1) * pageSize + 1, total)}–${Math.min(
      page * pageSize,
      total,
    )} of ${total}`;
  }, [page, pageSize, total]);

  const subtitle = activeQuery.trim() ? `Results for “${activeQuery.trim()}”` : "Top picks";

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateParams({ q: queryInput.trim(), page: 1 });
  };

  const filters = filtersQuery.data ?? { types: [], ratings: [], years: [], genres: [] };
  const isSearching = searchQuery.isLoading || searchQuery.isFetching;
  const showBootLoading = statusQuery.isLoading && !statusQuery.data;

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      {showBootLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0b0b]">
          <LoadingSpinner message="Loading catalog…" />
        </div>
      ) : null}
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 pt-10 pb-6">
        <div className="flex items-center gap-4">
          <img src={netflixN} alt="Netflix Recommender" className="size-12 shrink-0" />
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-[#E50914] sm:text-5xl">
              Netflix Recommender
            </h1>
            <p className="text-sm text-white/70">
              Ask for vibes, themes, or similar shows & movies.
            </p>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            to="/favorites"
            className="relative px-3 py-2 text-base font-semibold tracking-wide text-white/85 hover:text-white focus-visible:ring-2 focus-visible:ring-[#E50914]/45 focus-visible:outline-hidden"
          >
            <span className="relative">
              Favorites
              <span className="absolute -bottom-1.5 left-1/2 h-[3px] w-full -translate-x-1/2 rounded-full bg-[#E50914]" />
            </span>
          </Link>
        </nav>
      </header>

      <TooltipProvider delayDuration={200}>
        <main className="mx-auto max-w-7xl px-6 pb-16">
          <form
            onSubmit={onSubmit}
            className="mb-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
          >
            <input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder={placeholder}
              className="h-12 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-hidden placeholder:text-white/50 focus:ring-2 focus:ring-[#E50914]/40"
            />
            <button
              type="submit"
              disabled={isSearching || !queryInput.trim() || statusQuery.data?.ready !== true}
              className="h-12 rounded-xl bg-[#E50914] px-6 font-semibold text-white transition-colors hover:bg-[#f6121d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSearching ? "Searching…" : "Search"}
            </button>
          </form>

          <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4 lg:max-w-[520px]">
              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-white/60">Type</div>
                <Select
                  value={filterType}
                  onValueChange={(v) => updateParams({ type: v, page: 1 })}
                >
                  <SelectTrigger className="h-10 w-full rounded-lg border-white/10 bg-white/5 text-sm text-white shadow-none hover:bg-white/6 focus-visible:ring-[#E50914]/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    className="border-white/10 bg-[#0f0f0f] text-white shadow-xl shadow-black/60"
                  >
                    <SelectItem value="all">All</SelectItem>
                    {filters.types.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-white/60">Rating</div>
                <Select
                  value={filterRating}
                  onValueChange={(v) => updateParams({ rating: v, page: 1 })}
                >
                  <SelectTrigger className="h-10 w-full rounded-lg border-white/10 bg-white/5 text-sm text-white shadow-none hover:bg-white/6 focus-visible:ring-[#E50914]/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    className="border-white/10 bg-[#0f0f0f] text-white shadow-xl shadow-black/60"
                  >
                    <SelectItem value="all">All</SelectItem>
                    {filters.ratings.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-white/60">Year</div>
                <Select
                  value={filterYear}
                  onValueChange={(v) => updateParams({ year: v, page: 1 })}
                >
                  <SelectTrigger className="h-10 w-full rounded-lg border-white/10 bg-white/5 text-sm text-white shadow-none hover:bg-white/6 focus-visible:ring-[#E50914]/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    className="border-white/10 bg-[#0f0f0f] text-white shadow-xl shadow-black/60"
                  >
                    <SelectItem value="all">All</SelectItem>
                    {filters.years.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-white/60">Order by</div>
                <Select value={sortBy} onValueChange={(v) => updateParams({ sort: v, page: 1 })}>
                  <SelectTrigger className="h-10 w-full rounded-lg border-white/10 bg-white/5 text-sm text-white shadow-none hover:bg-white/6 focus-visible:ring-[#E50914]/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    className="border-white/10 bg-[#0f0f0f] text-white shadow-xl shadow-black/60"
                  >
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="year_desc">Latest</SelectItem>
                    <SelectItem value="year_asc">Oldest</SelectItem>
                    <SelectItem value="title_asc">Title</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 flex flex-wrap items-center gap-3 sm:col-span-4">
                <button
                  type="button"
                  disabled={!canClear}
                  onClick={() => {
                    setQueryInput("");
                    setSearchParams(new URLSearchParams(), { replace: true });
                  }}
                  className={[
                    "h-10 px-4 rounded-lg border text-sm font-semibold",
                    "transition-[background-color,border-color,box-shadow,transform,filter] duration-150",
                    "border-white/10 bg-white/5 text-white/80",
                    "hover:border-white/20 hover:bg-white/[0.08] hover:text-white hover:shadow-md hover:shadow-black/40 hover:-translate-y-0.5",
                    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#E50914]/45",
                    "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:hover:bg-white/5 disabled:hover:border-white/10",
                  ].join(" ")}
                >
                  Clear
                </button>
                <label className="flex items-center gap-2 text-xs text-white/60">
                  <input
                    type="checkbox"
                    checked={doRerank}
                    onChange={(e) =>
                      updateParams({ rerank: e.target.checked ? "1" : "0", page: 1 })
                    }
                    className="accent-[#E50914]"
                  />
                  <span title="If enabled, we do an extra Voyage rerank call to refine the ordering of top results.">
                    Rerank
                  </span>
                </label>
                {filterGenre !== DEFAULTS.genre && (
                  <div className="text-sm text-white/60">
                    Genre: <span className="text-white/85">{filterGenre}</span>
                  </div>
                )}
              </div>
            </div>

            {filters.genres.length > 0 && (
              <div className="flex w-full flex-wrap gap-2">
                {filters.genres.map((tag) => {
                  const active = filterGenre === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        updateParams({ genre: active ? DEFAULTS.genre : tag, page: 1 })
                      }
                      className={[
                        "cursor-pointer select-none text-[12px] leading-7 px-4 rounded-full border transition-colors",
                        active
                          ? "border-[#E50914]/60 bg-[#E50914]/15 text-white"
                          : "border-white/10 bg-black/30 text-white/70 hover:border-white/20 hover:bg-white/[0.06]",
                      ].join(" ")}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {statusQuery.data && !statusQuery.data.ready && (
            <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-1 font-semibold">Index not ready</div>
              <div className="text-sm text-white/70">
                {statusQuery.data.error ?? "Waiting for seed to finish."}
              </div>
            </div>
          )}

          {searchQuery.error && (
            <div className="mb-6 rounded-xl border border-[#E50914]/30 bg-[#E50914]/10 p-4 text-sm">
              {searchQuery.error instanceof Error ? searchQuery.error.message : "Search failed."}
            </div>
          )}

          {!isInitialResultsLoading ? (
            <div className="mb-4 flex items-center gap-3">
              <div className="h-8 w-1 rounded-full bg-[#E50914]" />
              <div>
                <div className="flex items-baseline gap-3">
                  <div className="text-2xl font-bold">
                    {total} {subtitle}
                  </div>
                  {searchQuery.isFetching ? (
                    <div className="text-xs font-semibold text-white/50">Updating…</div>
                  ) : null}
                </div>
                <div className="text-sm text-white/70">TV shows and movies from Netflix</div>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-3">
              <div className="h-8 w-1 rounded-full bg-[#E50914]" />
              <div>
                <div className="text-2xl font-bold">Loading picks…</div>
                <div className="text-sm text-white/70">Fetching page {page}</div>
              </div>
            </div>
          )}

          <PaginationSection
            className="mb-6"
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            showingLabel={showingLabel}
            isLoading={searchQuery.isFetching}
            onPageChange={(next) => updateParams({ page: next })}
            onPageSizeChange={(next) => updateParams({ pageSize: next, page: 1 })}
          />

          <div className="grid grid-cols-2 gap-6 pt-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {isInitialResultsLoading && results.length === 0
              ? Array.from({ length: Math.min(20, pageSize) }).map((_, idx) => (
                  <div
                    key={`skeleton-${idx}`}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"
                  >
                    <div className="shimmer h-[260px] sm:h-[290px] lg:h-[310px]" />
                    <div className="flex flex-col gap-3 p-4">
                      <div className="shimmer h-5 w-3/4 rounded-sm" />
                      <div className="shimmer h-4 w-1/2 rounded-sm" />
                      <div className="shimmer h-20 rounded-sm" />
                      <div className="shimmer h-8 rounded-sm" />
                    </div>
                  </div>
                ))
              : results.map((item) => (
                  <NetflixCard
                    key={item.show_id}
                    item={item}
                    activeType={filterType}
                    activeRating={filterRating}
                    activeGenre={filterGenre}
                    activeYear={filterYear}
                    onToggleType={(value) =>
                      updateParams({ type: filterType === value ? DEFAULTS.type : value, page: 1 })
                    }
                    onToggleRating={(value) =>
                      updateParams({
                        rating: filterRating === value ? DEFAULTS.rating : value,
                        page: 1,
                      })
                    }
                    onToggleGenre={(value) =>
                      updateParams({
                        genre: filterGenre === value ? DEFAULTS.genre : value,
                        page: 1,
                      })
                    }
                    onToggleYear={(value) =>
                      updateParams({ year: filterYear === value ? DEFAULTS.year : value, page: 1 })
                    }
                  />
                ))}
          </div>

          <div className="mt-10">
            <PaginationSection
              withPerPage
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              showingLabel={showingLabel}
              isLoading={searchQuery.isFetching}
              onPageChange={(next) => updateParams({ page: next })}
              onPageSizeChange={(next) => updateParams({ pageSize: next, page: 1 })}
            />
          </div>
        </main>
      </TooltipProvider>
    </div>
  );
}

import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { modelenceQuery } from "@modelence/react-query";
import netflixN from "@/client/assets/netflix-n.svg";
import LoadingSpinner from "@/client/components/LoadingSpinner";
import { TooltipProvider } from "@/client/components/ui/Tooltip";
import { NetflixCard, type NetflixItem } from "@/client/features/netflix/NetflixCard";
import { PaginationSection } from "@/client/features/netflix/PaginationSection";

type FavoritesResponse = {
  total: number;
  page: number;
  pageSize: number;
  results: NetflixItem[];
};

type StatusResponse = {
  ready: boolean;
  count?: number;
  createdAt?: string | null;
  source?: string;
  error?: string;
};

const DEFAULTS = {
  page: 1,
  pageSize: 20,
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

export default function FavoritesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseIntParam(searchParams.get("page"), DEFAULTS.page);
  const pageSize = parsePageSize(searchParams.get("pageSize"));

  const statusQuery = useQuery({
    ...modelenceQuery<StatusResponse>("netflix.status"),
    staleTime: 5 * 60_000,
  });

  const favoritesQuery = useQuery({
    ...modelenceQuery<FavoritesResponse>("netflix.favorites", { page, pageSize }),
    enabled: statusQuery.data?.ready === true,
    placeholderData: (prev) => prev,
  });

  const results = favoritesQuery.data?.results ?? [];
  const total = favoritesQuery.data?.total ?? 0;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);

  const showingLabel = useMemo(() => {
    if (total === 0) return "0 favorites";
    return `Showing ${Math.min((page - 1) * pageSize + 1, total)}–${Math.min(
      page * pageSize,
      total,
    )} of ${total}`;
  }, [page, pageSize, total]);

  const updateParams = (updates: { page?: number; pageSize?: number }) => {
    const next = new URLSearchParams();
    const nextPage = updates.page ?? page;
    const nextPageSize = updates.pageSize ?? pageSize;

    if (nextPage !== DEFAULTS.page) next.set("page", String(nextPage));
    if (nextPageSize !== DEFAULTS.pageSize) next.set("pageSize", String(nextPageSize));

    setSearchParams(next, { replace: true });
  };

  const goHomeWith = (updates: Record<string, string>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
    }
    navigate({ pathname: "/", search: next.toString() ? `?${next.toString()}` : "" });
  };

  const showBootLoading = statusQuery.isLoading && !statusQuery.data;

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      {showBootLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0b0b]">
          <LoadingSpinner message="Loading favorites…" />
        </div>
      ) : null}
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 pt-10 pb-6">
        <div className="flex items-center gap-4">
          <img src={netflixN} alt="Netflix Recommender" className="size-12 shrink-0" />
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-[#E50914] sm:text-5xl">
              Favorites
            </h1>
            <p className="text-sm text-white/70">Your saved movies and shows.</p>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            to="/"
            className="relative px-3 py-2 text-base font-semibold tracking-wide text-white/85 hover:text-white focus-visible:ring-2 focus-visible:ring-[#E50914]/45 focus-visible:outline-hidden"
          >
            <span className="relative">
              Explore
              <span className="absolute -bottom-1.5 left-1/2 h-[3px] w-full -translate-x-1/2 rounded-full bg-[#E50914]" />
            </span>
          </Link>
        </nav>
      </header>

      <TooltipProvider delayDuration={200}>
        <main className="mx-auto max-w-7xl px-6 pb-16">
          {statusQuery.data && !statusQuery.data.ready && (
            <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-1 font-semibold">Index not ready</div>
              <div className="text-sm text-white/70">
                {statusQuery.data.error ?? "Waiting for seed to finish."}
              </div>
            </div>
          )}

          {favoritesQuery.error && (
            <div className="mb-6 rounded-xl border border-[#E50914]/30 bg-[#E50914]/10 p-4 text-sm">
              {favoritesQuery.error instanceof Error
                ? favoritesQuery.error.message
                : "Favorites failed."}
            </div>
          )}

          <div className="mb-4 flex items-center gap-3">
            <div className="h-8 w-1 rounded-full bg-[#E50914]" />
            <div>
              <div className="text-2xl font-bold">{total} favorites</div>
              <div className="text-sm text-white/70">Saved to your current session/user</div>
            </div>
          </div>

          <PaginationSection
            className="mb-6"
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            showingLabel={showingLabel}
            isLoading={favoritesQuery.isFetching}
            onPageChange={(next) => updateParams({ page: next })}
            onPageSizeChange={(next) => updateParams({ pageSize: next, page: 1 })}
          />

          {favoritesQuery.isLoading && !favoritesQuery.data ? (
            <div className="grid grid-cols-2 gap-6 pt-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: Math.min(20, pageSize) }).map((_, idx) => (
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
              ))}
            </div>
          ) : total === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-lg font-semibold">No favorites yet</div>
              <div className="mt-1 text-sm text-white/70">
                Tap the heart on any card to save it here.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6 pt-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {results.map((item) => (
                <NetflixCard
                  key={item.show_id}
                  item={item}
                  activeType="all"
                  activeRating="all"
                  activeGenre="all"
                  activeYear="all"
                  onToggleType={(value) => goHomeWith({ type: value, page: "1" })}
                  onToggleRating={(value) => goHomeWith({ rating: value, page: "1" })}
                  onToggleGenre={(value) => goHomeWith({ genre: value, page: "1" })}
                  onToggleYear={(value) => goHomeWith({ year: value, page: "1" })}
                />
              ))}
            </div>
          )}

          {total > 0 && (
            <div className="mt-10">
              <PaginationSection
                withPerPage
                page={page}
                totalPages={totalPages}
                pageSize={pageSize}
                showingLabel={showingLabel}
                isLoading={favoritesQuery.isFetching}
                onPageChange={(next) => updateParams({ page: next })}
                onPageSizeChange={(next) => updateParams({ pageSize: next, page: 1 })}
              />
            </div>
          )}
        </main>
      </TooltipProvider>
    </div>
  );
}

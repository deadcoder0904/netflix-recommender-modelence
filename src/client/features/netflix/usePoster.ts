import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { getPoster, type PosterResponse } from "@/client/lib/posterBatcher";

const refreshAttempted = new Set<string>();

type PosterItem = {
  show_id: string;
  title: string;
  type: string;
  release_year?: number | null;
};

export function usePoster(item: PosterItem) {
  const { ref, inView } = useInView({
    rootMargin: "0px 0px 160px 0px",
    threshold: 0,
    triggerOnce: true,
  });

  const query = useQuery<PosterResponse>({
    queryKey: [
      "netflix.poster",
      {
        showId: item.show_id,
        title: item.title,
        type: item.type,
        year: item.release_year ?? undefined,
      },
    ],
    queryFn: async () => {
      const baseReq = {
        showId: item.show_id,
        title: item.title,
        type: item.type,
        year: item.release_year ?? undefined,
      };

      const base = await getPoster(baseReq);
      if (
        base.status === "missing" &&
        base.source === "cache" &&
        !refreshAttempted.has(item.show_id)
      ) {
        refreshAttempted.add(item.show_id);
        return getPoster({ ...baseReq, refresh: true });
      }
      return base;
    },
    enabled: inView && Boolean(item.title),
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!inView) return;
    const status = query.data?.status;
    const cooldownUntil = query.data?.cooldownUntil;
    if (status !== "cooldown") return;
    if (!cooldownUntil) return;

    const ms = Date.parse(cooldownUntil) - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return;
    if (ms > 10 * 60_000) return;

    const t = window.setTimeout(() => {
      query.refetch().catch(() => {
        // ignore
      });
    }, ms + 50);

    return () => window.clearTimeout(t);
  }, [inView, query.data?.cooldownUntil, query.data?.status, query.refetch]);

  return {
    ref,
    posterUrl: query.data?.posterUrl ?? null,
    status: query.data?.status ?? null,
    isLoading: query.isLoading,
  };
}

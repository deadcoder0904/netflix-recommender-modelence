import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { modelenceMutation } from "@modelence/react-query";
import { Heart } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/client/components/ui/Tooltip";
import { ExternalLinks } from "@/client/components/ExternalLinks";
import { usePoster } from "./usePoster";
import { THUMB_NOT_FOUND_DATA_URI } from "@/client/lib/thumbNotFound";

type NetflixItem = {
  show_id: string;
  type: string;
  title: string;
  director: string;
  cast: string;
  country: string;
  date_added: string;
  release_year?: number | null;
  rating: string;
  duration: string;
  genres: string;
  description: string;
  is_favorite?: boolean;
};

function splitGenres(genres: string) {
  return genres
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function movieYearLabel(movie: NetflixItem) {
  if (movie.release_year) return String(movie.release_year);
  const match = movie.date_added?.match(/(19|20)\d{2}/);
  if (match) return match[0];
  return "—";
}

function earDecoration(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = h >>> 0 || 1;
  const palettes = [
    { bg: "#FFCC00", fg: "#0b0b0b" },
    { bg: "#34C759", fg: "#0b0b0b" },
    { bg: "#5AC8FA", fg: "#0b0b0b" },
    { bg: "#FF9500", fg: "#0b0b0b" },
    { bg: "#FF2D55", fg: "#ffffff" },
    { bg: "#5856D6", fg: "#ffffff" },
  ];
  const angles = [-4, -3, -2, 2, 3, 4];
  return {
    palette: palettes[h % palettes.length]!,
    angle: angles[(h >>> 3) % angles.length]!,
  };
}

function tagBaseClass(kind: "type" | "year" | "rating", value: string) {
  if (kind === "type") {
    return value === "Movie"
      ? "border-[#FF3B30]/75 bg-[#FF3B30]/28 text-white"
      : "border-[#34C759]/70 bg-[#34C759]/24 text-white";
  }

  if (kind === "year") {
    return "border-[#FFCC00]/75 bg-[#FFCC00]/24 text-white";
  }

  const v = value.toUpperCase();
  if (v === "G" || v === "TV-G" || v === "TV-Y" || v === "TV-Y7") {
    return "border-[#4CD964]/75 bg-[#4CD964]/24 text-white";
  }
  if (v.startsWith("PG")) return "border-[#FF9500]/75 bg-[#FF9500]/24 text-white";
  if (v === "R" || v === "NC-17" || v === "TV-MA")
    return "border-[#FF3B30]/70 bg-[#FF3B30]/22 text-white";
  if (v === "TV-14") return "border-[#FF5E3A]/75 bg-[#FF5E3A]/24 text-white";
  if (v === "TV-PG") return "border-[#FFCC00]/70 bg-[#FFCC00]/22 text-white";
  return "border-white/15 bg-white/5 text-white/85";
}

function tagHoverClass(kind: "type" | "year" | "rating", value: string) {
  if (kind === "type") {
    return value === "Movie"
      ? "hover:border-[#FF3B30]/95 hover:bg-[#FF3B30]/38"
      : "hover:border-[#34C759]/95 hover:bg-[#34C759]/34";
  }
  if (kind === "year") return "hover:border-[#FFCC00]/95 hover:bg-[#FFCC00]/34";

  const v = value.toUpperCase();
  if (v === "G" || v === "TV-G" || v === "TV-Y" || v === "TV-Y7")
    return "hover:border-[#4CD964]/95 hover:bg-[#4CD964]/34";
  if (v.startsWith("PG")) return "hover:border-[#FF9500]/95 hover:bg-[#FF9500]/34";
  if (v === "R" || v === "NC-17" || v === "TV-MA")
    return "hover:border-[#FF3B30]/95 hover:bg-[#FF3B30]/34";
  if (v === "TV-14") return "hover:border-[#FF5E3A]/95 hover:bg-[#FF5E3A]/34";
  if (v === "TV-PG") return "hover:border-[#FFCC00]/95 hover:bg-[#FFCC00]/34";
  return "hover:border-white/25 hover:bg-white/[0.07]";
}

function Tag({
  kind,
  value,
  active,
  tilt,
  onClick,
}: {
  kind: "type" | "year" | "rating";
  value: string;
  active: boolean;
  tilt?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] leading-none font-semibold shadow-xs shadow-black/30",
        "shrink-0 select-none cursor-pointer",
        "transition-[transform,filter,background-color,border-color] duration-150",
        "hover:brightness-110 hover:saturate-[1.35]",
        "active:brightness-100",
        tilt ? "-rotate-2 sm:rotate-0 hover:-rotate-1" : "hover:-rotate-1",
        active ? "ring-2 ring-white/15" : "",
        tagBaseClass(kind, value),
        tagHoverClass(kind, value),
      ].join(" ")}
    >
      {value}
    </button>
  );
}

export function NetflixCard({
  item,
  activeType,
  activeRating,
  activeGenre,
  activeYear,
  onToggleType,
  onToggleRating,
  onToggleGenre,
  onToggleYear,
}: {
  item: NetflixItem;
  activeType: string;
  activeRating: string;
  activeGenre: string;
  activeYear: string;
  onToggleType: (value: string) => void;
  onToggleRating: (value: string) => void;
  onToggleGenre: (value: string) => void;
  onToggleYear: (value: string) => void;
}) {
  const { ref, posterUrl, status: posterStatus } = usePoster(item);
  const queryClient = useQueryClient();
  const [isFavorite, setIsFavorite] = useState(Boolean(item.is_favorite));

  useEffect(() => {
    setIsFavorite(Boolean(item.is_favorite));
  }, [item.is_favorite]);

  const toggleFavoriteMutation = useMutation({
    ...modelenceMutation<{ show_id: string; is_favorite: boolean }>("netflix.toggleFavorite"),
    onMutate: async () => {
      const prev = isFavorite;
      setIsFavorite(!prev);
      return { prev };
    },
    onSuccess: (data) => {
      setIsFavorite(Boolean(data?.is_favorite));
      queryClient.setQueriesData({ queryKey: ["netflix.search"], exact: false }, (old: any) => {
        if (!old?.results || !Array.isArray(old.results)) return old;
        return {
          ...old,
          results: old.results.map((r: any) =>
            r?.show_id === item.show_id ? { ...r, is_favorite: Boolean(data?.is_favorite) } : r,
          ),
        };
      });
      queryClient.invalidateQueries({ queryKey: ["netflix.favorites"], exact: false });
    },
    onError: (_err, _vars, ctx) => {
      setIsFavorite(Boolean((ctx as any)?.prev));
    },
  });

  const yearLabel = movieYearLabel(item);
  const canFilterYear = yearLabel !== "—";
  const yearActive = canFilterYear && activeYear === yearLabel;
  const ear = earDecoration(`${item.show_id}::${yearLabel}`);

  return (
    <div ref={ref} className="relative">
      <div className="absolute top-0 right-3 z-20 -translate-y-1/2 sm:right-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!canFilterYear) return;
            onToggleYear(yearLabel);
          }}
          aria-pressed={yearActive}
          className={[
            "rounded-full",
            "px-4 py-1.5 text-sm sm:text-base font-extrabold tracking-tight",
            "shadow-lg shadow-black/50 border",
            "cursor-pointer select-none",
            "hover:brightness-105 active:brightness-95 transition-[filter,box-shadow] duration-150",
            yearActive ? "ring-2 ring-white/20" : "",
            canFilterYear ? "opacity-100" : "opacity-70 cursor-default",
          ].join(" ")}
          style={{
            transform: `rotate(${ear.angle}deg)`,
            backgroundColor: ear.palette.bg,
            color: ear.palette.fg,
            borderColor: "rgba(0,0,0,0.18)",
            textShadow: ear.palette.fg === "#ffffff" ? "0 1px 0 rgba(0,0,0,0.25)" : undefined,
          }}
        >
          {yearLabel}
        </button>
      </div>

      <article className="group relative flex h-[620px] cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-colors hover:border-white/20 hover:bg-white/6 sm:h-[640px]">
        <div className="relative h-[260px] overflow-hidden border-b border-white/10 sm:h-[290px] lg:h-[310px]">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={`${item.title} poster`}
              loading="lazy"
              className="absolute inset-0 size-full object-cover object-center"
            />
          ) : posterStatus === "missing" || posterStatus === "error" ? (
            <img
              src={THUMB_NOT_FOUND_DATA_URI}
              alt="Thumbnail not found"
              loading="lazy"
              className="absolute inset-0 size-full object-cover object-center"
            />
          ) : (
            <div className="absolute inset-0 bg-linear-to-br from-white/6 via-white/3 to-white/2" />
          )}
          <div className="absolute inset-0 bg-linear-to-b from-black/5 via-black/10 to-black/45" />
          <button
            type="button"
            aria-pressed={isFavorite}
            disabled={toggleFavoriteMutation.isPending}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavoriteMutation.mutate({ showId: item.show_id });
            }}
            className={[
              "absolute left-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border",
              "border-white/15 bg-black/40 backdrop-blur-xs text-white/85 shadow-lg shadow-black/40",
              "transition-[transform,background-color,border-color,filter] duration-150",
              "hover:-translate-y-0.5 hover:border-white/25 hover:bg-black/55 hover:brightness-110",
              "active:translate-y-0 active:brightness-100",
              "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0",
            ].join(" ")}
            title={isFavorite ? "Remove favorite" : "Add favorite"}
          >
            <Heart
              className={[
                "h-4 w-4",
                isFavorite ? "fill-[#E50914] text-[#E50914]" : "fill-transparent text-white/80",
              ].join(" ")}
            />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          <div className="space-y-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={[
                    "text-lg sm:text-xl font-extrabold leading-snug cursor-pointer",
                    "tracking-tight",
                    "clamp-2 break-words",
                    "bg-gradient-to-r from-white via-white to-[#E50914] bg-clip-text text-transparent",
                    "group-hover:to-[#FF3B30] transition-[filter] duration-150",
                  ].join(" ")}
                >
                  {item.title}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" align="center" sideOffset={10} className="max-w-[320px]">
                {item.title}
              </TooltipContent>
            </Tooltip>

            <div className="mt-2 flex flex-wrap gap-2">
              {item.type && (
                <Tag
                  kind="type"
                  value={item.type}
                  tilt
                  active={activeType === item.type}
                  onClick={() => onToggleType(item.type)}
                />
              )}
              {item.rating && (
                <Tag
                  kind="rating"
                  value={item.rating}
                  active={activeRating === item.rating}
                  onClick={() => onToggleRating(item.rating)}
                />
              )}
            </div>
          </div>

          <div className="scrollbar-netflix min-h-0 flex-1 overflow-auto text-[13px]/5 text-white/80">
            {item.description}
          </div>

          <div className="mt-auto space-y-3">
            <div className="scrollbar-hover mask-fade-right flex flex-nowrap gap-2 overflow-x-auto pb-2">
              {splitGenres(item.genres)
                .slice(0, 10)
                .map((tag) => (
                  <button
                    key={`${item.show_id}-${tag}`}
                    type="button"
                    onClick={() => onToggleGenre(tag)}
                    className={[
                      "shrink-0 cursor-pointer text-[11px] leading-6 px-3 rounded-full border bg-black/30 transition-colors",
                      activeGenre === tag
                        ? "border-[#FF3B30]/50 bg-[#FF3B30]/10 text-white"
                        : "border-white/10 text-white/75 hover:border-white/20 hover:bg-white/[0.08]",
                    ].join(" ")}
                  >
                    {tag}
                  </button>
                ))}
            </div>

            <ExternalLinks title={item.title} year={item.release_year} />
          </div>
        </div>
      </article>
    </div>
  );
}

export type { NetflixItem };

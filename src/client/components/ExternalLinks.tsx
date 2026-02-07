import { Tooltip, TooltipContent, TooltipTrigger } from "@/client/components/ui/Tooltip";
import type { ReactNode } from "react";

function encode(s: string) {
  return encodeURIComponent(s);
}

function LinkIcon({ href, label, children }: { href: string; label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={href}
          aria-label={label}
          title={label}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={[
            "inline-flex items-center justify-center",
            "h-9 w-full rounded-lg border border-white/10 bg-white/5",
            "hover:bg-white/[0.08] hover:border-white/20 transition-colors",
            "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#E50914]/40",
          ].join(" ")}
        >
          {children}
        </a>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function NetflixIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M18 12h10v40H18V12z" fill="#B20710" />
      <path d="M28 12h10l8 40H36L28 12z" fill="#E50914" />
      <path d="M38 12h10v40H38V12z" fill="#B20710" />
    </svg>
  );
}

function ImdbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="6" y="16" width="52" height="32" rx="6" fill="#F5C518" />
      <path
        d="M16.2 40V24.3h4V40h-4Zm6.6 0V24.3h6.1c3.2 0 5.4 2.1 5.4 5.4v4.9c0 3.3-2.2 5.4-5.4 5.4h-6.1Zm4-3.4h2c1.2 0 1.7-.7 1.7-1.9v-5.1c0-1.2-.6-1.9-1.7-1.9h-2v8.9ZM36.7 40V24.3h4l2.6 8.2 2.6-8.2h4V40h-3.6V31l-2 6.4h-2l-2-6.4v9h-3.6Z"
        fill="#111"
      />
    </svg>
  );
}

function LetterboxdIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="10" y="10" width="44" height="44" rx="10" fill="#1A1A1A" />
      <circle cx="26" cy="32" r="10" fill="#00D735" />
      <circle cx="32" cy="32" r="10" fill="#FFFFFF" fillOpacity="0.9" />
      <circle cx="38" cy="32" r="10" fill="#40BCF4" />
    </svg>
  );
}

function RottenTomatoesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path
        d="M40 18c3.5 0 6.2-2.8 6.2-6.2 0-.7-.1-1.3-.3-1.9-4.5 1.1-8.9 3.8-12.1 7.6.9.3 1.9.5 3 .5Z"
        fill="#22c55e"
        opacity="0.9"
      />
      <path
        d="M32 18c-12.2 0-20 7.9-20 18 0 10.3 8.2 18 20 18s20-7.7 20-18c0-10.1-7.8-18-20-18Z"
        fill="#ef4444"
      />
      <path
        d="M24 40.5c2.2-2.5 4.8-3.8 8-3.8s5.8 1.3 8 3.8"
        stroke="#111"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

function JustWatchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="10" y="10" width="44" height="44" rx="12" fill="#111827" />
      <path
        d="M22 38.5c2.2 2 4.8 3 7.8 3 6.6 0 12.2-5.2 12.2-12.2 0-1.2-.2-2.3-.5-3.4"
        stroke="#22d3ee"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M42 25.5c-2.2-2-4.8-3-7.8-3-6.6 0-12.2 5.2-12.2 12.2 0 1.2.2 2.3.5 3.4"
        stroke="#f97316"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ExternalLinks({ title, year }: { title: string; year?: number | null }) {
  const query = year ? `${title} ${year}` : title;
  const q = encode(query);

  const netflix = `https://www.netflix.com/search?q=${q}`;
  const imdb = `https://www.imdb.com/find/?q=${q}`;
  const letterboxd = `https://letterboxd.com/search/${q}/`;
  const rotten = `https://www.rottentomatoes.com/search?search=${q}`;
  const justwatch = `https://www.justwatch.com/us/search?q=${q}`;

  return (
    <div className="grid w-full grid-cols-5 gap-2">
      <LinkIcon href={netflix} label="Open on Netflix">
        <NetflixIcon />
      </LinkIcon>
      <LinkIcon href={imdb} label="Open on IMDb">
        <ImdbIcon />
      </LinkIcon>
      <LinkIcon href={letterboxd} label="Open on Letterboxd">
        <LetterboxdIcon />
      </LinkIcon>
      <LinkIcon href={rotten} label="Open on Rotten Tomatoes">
        <RottenTomatoesIcon />
      </LinkIcon>
      <LinkIcon href={justwatch} label="Open on JustWatch">
        <JustWatchIcon />
      </LinkIcon>
    </div>
  );
}

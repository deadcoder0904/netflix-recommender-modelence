function svgToDataUri(svg: string) {
  // Keep it simple + safe for URLs; avoid base64 so it's readable in devtools.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900" role="img" aria-label="Thumbnail not found">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#0b0b0b"/>
      <stop offset="1" stop-color="#141414"/>
    </linearGradient>
    <filter id="noise" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
      <feColorMatrix type="matrix" values="
        1 0 0 0 0
        0 1 0 0 0
        0 0 1 0 0
        0 0 0 0.25 0" />
    </filter>
    <filter id="glitch">
      <feColorMatrix type="matrix" values="
        1 0 0 0 0
        0 1 0 0 0
        0 0 1 0 0
        0 0 0 1 0" />
    </filter>
    <style>
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
      .sans { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; }
    </style>
  </defs>

  <rect width="600" height="900" fill="url(#bg)"/>

  <!-- Scanline noise -->
  <rect width="600" height="900" filter="url(#noise)" opacity="0.18"/>

  <!-- Glitch bars -->
  <g opacity="0.9">
    <rect x="20"  y="120" width="160" height="10" fill="#00D9FF" opacity="0.75"/>
    <rect x="240" y="170" width="220" height="8"  fill="#FF2D55" opacity="0.75"/>
    <rect x="90"  y="260" width="320" height="12" fill="#34C759" opacity="0.65"/>
    <rect x="380" y="320" width="170" height="7"  fill="#FFD600" opacity="0.7"/>
    <rect x="40"  y="410" width="240" height="9"  fill="#5E5CE6" opacity="0.65"/>
    <rect x="300" y="460" width="260" height="11" fill="#FF9500" opacity="0.7"/>
    <rect x="60"  y="630" width="190" height="8"  fill="#FF2D55" opacity="0.7"/>
    <rect x="280" y="690" width="260" height="10" fill="#00D9FF" opacity="0.7"/>
  </g>

  <!-- Big 404 with RGB offsets -->
  <g class="mono" font-weight="900" font-size="150" text-anchor="middle">
    <text x="300" y="520" fill="#00D9FF" opacity="0.65" transform="translate(-6,0)">404</text>
    <text x="300" y="520" fill="#FF2D55" opacity="0.65" transform="translate(6,0)">404</text>
    <text x="300" y="520" fill="#ffffff" filter="url(#glitch)">404</text>
  </g>

  <g class="mono" font-weight="800" text-anchor="middle">
    <text x="300" y="600" font-size="46" fill="#ffffff" opacity="0.92">THUMBNAIL</text>
    <text x="300" y="650" font-size="46" fill="#ffffff" opacity="0.92">NOT FOUND</text>
  </g>

  <g class="sans" text-anchor="middle" opacity="0.8" fill="#ffffff">
    <text x="300" y="735" font-size="16">TMDB did not return an image for this title</text>
    <text x="300" y="760" font-size="12" opacity="0.75">Try another query or wait for cooldown</text>
  </g>

  <!-- Side edge glitch columns -->
  <g opacity="0.7">
    <rect x="0" y="0" width="26" height="900" fill="#ffffff" opacity="0.06"/>
    <rect x="574" y="0" width="26" height="900" fill="#ffffff" opacity="0.06"/>
    <rect x="10" y="0" width="6" height="900" fill="#FF2D55" opacity="0.35"/>
    <rect x="18" y="0" width="5" height="900" fill="#00D9FF" opacity="0.35"/>
    <rect x="580" y="0" width="6" height="900" fill="#00D9FF" opacity="0.35"/>
    <rect x="588" y="0" width="5" height="900" fill="#FF2D55" opacity="0.35"/>
  </g>
</svg>
`.trim();

export const THUMB_NOT_FOUND_DATA_URI = svgToDataUri(SVG);

/**
 * Visual palettes — redesigned for professional motion graphics.
 * Default: paper-ink (warm editorial). Dark themes map to dark-lab.
 */
export type MotionPalette = {
  id: string;
  background: string;
  backgroundEdge: string;
  grid: string;
  surface: string;
  surfaceStrong: string;
  border: string;
  text: string;
  textSoft: string;
  muted: string;
  accents: string[];
};

// ── PRIMARY: paper-ink (warm editorial, default) ──────────────────────

const paperInk: MotionPalette = {
  id: "paper-ink",
  background: "#F5EFDC",
  backgroundEdge: "#FFF8EC",
  grid: "rgba(20,18,14,0.06)",
  surface: "#FFFDF6",
  surfaceStrong: "#FFF9EA",
  border: "rgba(20,18,14,0.88)",
  text: "#14120E",
  textSoft: "#2A2520",
  muted: "#6B6358",
  accents: ["#E8451E", "#F6D44D", "#E8568A", "#1E5CD8", "#0A0A0A"]
};

// ── BlockFrame (loud editorial, dark borders) ─────────────────────────

const blockframe: MotionPalette = {
  id: "od-blockframe",
  background: "#FFFDF3",
  backgroundEdge: "#FFFFFF",
  grid: "rgba(5,5,5,0.07)",
  surface: "#FFFFFF",
  surfaceStrong: "#FFFAE8",
  border: "rgba(5,5,5,0.92)",
  text: "#050505",
  textSoft: "#1A1A1A",
  muted: "#5F5A4F",
  accents: ["#F7E25B", "#FF6B9E", "#9CE7F2", "#111111", "#FF4E22"]
};

// ── Bold Poster (red editorial, dramatic) ─────────────────────────────

const boldPoster: MotionPalette = {
  id: "od-bold-poster",
  background: "#FEF7ED",
  backgroundEdge: "#FFFFFF",
  grid: "rgba(21,16,13,0.06)",
  surface: "#FFFFFF",
  surfaceStrong: "#FFF6EB",
  border: "rgba(21,16,13,0.9)",
  text: "#15100D",
  textSoft: "#231A15",
  muted: "#6F6258",
  accents: ["#D9151E", "#111111", "#F7C948", "#F26F5E"]
};

// ── Dark Lab (deep tech, fallback for old dark themes) ────────────────

const darkLab: MotionPalette = {
  id: "dark-lab",
  background: "#070B16",
  backgroundEdge: "#0D1930",
  grid: "rgba(99,179,237,0.06)",
  surface: "rgba(14,24,46,0.96)",
  surfaceStrong: "rgba(18,32,58,0.98)",
  border: "rgba(99,179,237,0.24)",
  text: "#E8F2FC",
  textSoft: "#B8CDE6",
  muted: "#7E95B0",
  accents: ["#63B3ED", "#9F7AEA", "#48BB78", "#F6E05E", "#ED8936"]
};

const palettes: Record<string, MotionPalette> = {
  "paper-ink": paperInk,
  "od-blockframe": blockframe,
  "od-bold-poster": boldPoster,
  "od-biennale-yellow": paperInk,
  "tech-signal": darkLab,
  "news-rank": darkLab,
  "product-deep": darkLab,
  "minimal-visual": darkLab,
  "od-data-drift": darkLab,
};

/** Default to paper-ink for best visual quality. */
export function paletteFor(themeId: string | undefined): MotionPalette {
  if (themeId && palettes[themeId]) return palettes[themeId]!;
  return paperInk;
}

export function accentFor(palette: MotionPalette, colorIndex: number): string {
  const list = palette.accents;
  if (list.length === 0) return palette.text;
  const index = ((Math.round(colorIndex) % list.length) + list.length) % list.length;
  return list[index]!;
}

export function isPaperStyle(p: MotionPalette): boolean {
  return ["paper-ink","od-blockframe","od-bold-poster","od-biennale-yellow"].includes(p.id);
}

export const motionPalettes = palettes;

export const isPaper = isPaperStyle;  // backward compat

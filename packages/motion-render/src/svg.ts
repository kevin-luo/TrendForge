import type { Box, MotionCaptionTrack, MotionGraph, MotionLayer } from "@trendforge/motion-core";
import { sampleTransform, type LayerTransform } from "./interp.js";
import { accentFor, isPaperStyle, paletteFor, type MotionPalette } from "./palette.js";

export type RenderSvgOptions = { palette?: MotionPalette; debug?: boolean };

// ── Font stacks ───────────────────────────────────────────────────────
const SERIF = "'Noto Serif CJK SC','Source Han Serif SC','SimSun','Songti SC','Georgia',serif";
const SANS  = "'Microsoft YaHei','PingFang SC','Hiragino Sans GB','Noto Sans CJK SC','Segoe UI',sans-serif";

export function renderMotionGraphFrameSvg(
  graph: MotionGraph, frame: number, options: RenderSvgOptions = {}
): string {
  const palette = options.palette ?? paletteFor(themeIdOf(graph));
  const paper = isPaperStyle(palette);
  const w = graph.width, h = graph.height;

  const body = [
    paper ? renderPaperBg(graph, palette) : renderDarkBg(graph, palette),
    graph.layers.map(l => renderLayer(l, frame, palette, paper)).join(""),
    (graph.captions ?? []).map(t => renderCaptionTrack(t, frame, palette, paper)).join(""),
    options.debug ? debugStamp(graph, frame, palette) : ""
  ].join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs(palette, paper)}${body}</svg>`;
}

function themeIdOf(g: MotionGraph): string | undefined { return typeof g.background.style?.themeId === "string" ? g.background.style.themeId : undefined; }

// ═══════════════════════════════════════════════════════════════════════
// BACKGROUNDS
// ═══════════════════════════════════════════════════════════════════════

function renderPaperBg(g: MotionGraph, p: MotionPalette): string {
  const {width:w, height:h} = g;
  const step = 54;
  let dots = "";
  for (let x = step; x < w; x += step)
    for (let y = step; y < h; y += step)
      dots += `<circle cx="${x}" cy="${y}" r="1.2" fill="${p.grid}" />`;
  
  const L = Math.round(w*0.06), T = Math.round(h*0.05), M = Math.round(w*0.88);
  const accent0 = p.accents[0] ?? p.text;
  const accent1 = p.accents[1] ?? accent0;

  return [
    `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#paperBgGrad)" />`,
    dots,
    // Decorative outer frame
    `<rect x="${L}" y="${T}" width="${M}" height="${h-T-Math.round(h*0.06)}" fill="none" stroke="${p.border}" stroke-width="2" opacity="0.22" rx="2" />`,
    // Accent corner sticker
    `<g transform="rotate(3,${Math.round(w*0.72)},${Math.round(h*0.055)})">
      <rect x="${Math.round(w*0.72)}" y="${Math.round(h*0.03)}" width="${Math.round(w*0.2)}" height="44" fill="${accent0}" stroke="${p.border}" stroke-width="2.5" rx="4" filter="url(#shadow)" />
    </g>`,
    // Bottom accent strip
    `<rect x="${L+4}" y="${Math.round(h*0.92)}" width="${Math.round(w*0.35)}" height="5" fill="${accent1}" opacity="0.7" rx="2" />`,
    `<rect x="${Math.round(w*0.75)}" y="${Math.round(h*0.91)}" width="${Math.round(w*0.18)}" height="8" fill="${accent0}" opacity="0.5" rx="2" />`
  ].join("");
}

function renderDarkBg(g: MotionGraph, p: MotionPalette): string {
  const {width:w, height:h} = g;
  const step = Math.max(80, Math.round(w/12));
  let lines = "";
  for (let x = step; x < w; x += step) lines += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${p.grid}" stroke-width="1"/>`;
  for (let y = step; y < h; y += step) lines += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${p.grid}" stroke-width="1"/>`;
  const a0 = p.accents[0] ?? p.text, a1 = p.accents[1] ?? a0;
  return [
    `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#darkBgGrad)"/>`,
    lines,
    `<ellipse cx="${Math.round(w*0.2)}" cy="${Math.round(h*0.2)}" rx="${Math.round(w*0.5)}" ry="${Math.round(h*0.3)}" fill="url(#glowA)"/>`,
    `<ellipse cx="${Math.round(w*0.8)}" cy="${Math.round(h*0.8)}" rx="${Math.round(w*0.5)}" ry="${Math.round(h*0.3)}" fill="url(#glowB)"/>`
  ].join("");
}

// ═══════════════════════════════════════════════════════════════════════
// LAYERS
// ═══════════════════════════════════════════════════════════════════════

function renderLayer(layer: MotionLayer, frame: number, p: MotionPalette, paper: boolean): string {
  if (String(layer.style?.tone ?? "") === "reserved-caption") return "";
  const t = sampleTransform(layer.keyframes, frame);
  const baseOp = Number(layer.style?.opacity ?? 1);
  const opacity = clamp01(baseOp * t.opacity);
  if (opacity <= 0.003) return "";

  let inner = "";
  if (layer.kind === "group") {
    inner = (layer.children ?? []).map(c => renderLayer(c, frame, p, paper)).join("");
  } else if (layer.kind === "text") {
    inner = renderText(layer, p);
  } else {
    inner = renderShape(layer, p, paper);
  }
  if (!inner) return "";

  const tx = t.translateX !== 0 || t.translateY !== 0 ? ` translate(${n(t.translateX)},${n(t.translateY)})` : "";
  const sc = t.scale !== 1 ? ` scale(${n(t.scale)})` : "";
  const rot = t.rotate !== 0 ? ` rotate(${n(t.rotate)},${n(layer.frame.x+layer.frame.width/2)},${n(layer.frame.y+layer.frame.height/2)})` : "";
  const tr = (tx + sc + rot).trim();
  return `<g${tr ? ` transform="${tr}"` : ""}${opacity < 0.999 ? ` opacity="${n(opacity)}"` : ""}>${inner}</g>`;
}

// ═══════════════════════════════════════════════════════════════════════
// SHAPES
// ═══════════════════════════════════════════════════════════════════════

function renderShape(layer: MotionLayer, p: MotionPalette, paper: boolean): string {
  const f = layer.frame;
  const tone = String(layer.style?.tone ?? "solid");
  const ci = Number(layer.style?.colorIndex ?? 0);
  const ac = accentFor(p, ci);
  const r = Math.min(Number(layer.style?.radius ?? 16), f.width/2, f.height/2);

  switch (tone) {
    case "panel":
      return rrect(f, p.surface, { stroke: p.border, sw: paper ? 2.5 : 1.5, r, filter: paper ? "url(#shadow)" : undefined });
    case "paper":
      return rrect(f, p.surfaceStrong, { stroke: p.border, sw: 2.8, r: Math.min(r, 10), filter: "url(#shadow)" });
    case "sticker":
      return rrect(f, ac, { stroke: p.border, sw: 2.5, r: Math.min(r, 8), filter: "url(#shadow)" });
    case "label":
      return rrect(f, ac + "14", { stroke: ac, sw: 1.8, r: Math.min(r, 8) });
    case "bar":
      return [
        rrect(f, ac, { r: f.height/2 }),
        rrect({x:f.x, y:f.y, w:f.width, height:Math.max(3,f.height*0.3)}, ac+"55", { r: f.height/2, sw: 0 })
      ].join("");
    case "rail": return rrect(f, p.muted, { r: 999, opacity: 0.45 });
    case "scan": return rrect(f, ac+"15", { r: 0 });
    case "core":
      return `<circle cx="${cx(f)}" cy="${cy(f)}" r="${Math.min(f.width,f.height)/2}" fill="url(#coreGlow)"/><circle cx="${cx(f)}" cy="${cy(f)}" r="${Math.min(f.width,f.height)/2.6}" fill="${ac}"/>`;
    case "ring":
      return `<circle cx="${cx(f)}" cy="${cy(f)}" r="${Math.min(f.width,f.height)/2}" fill="none" stroke="${ac}" stroke-width="5" opacity="0.88"/>`;
    case "phone":
      return rrect(f, p.surfaceStrong, { stroke: p.border, sw: 2.5, r: Math.min(36, f.width*0.11) }) +
        rrect({x:f.x+f.width*0.3, y:f.y+12, w:f.width*0.4, h:10}, p.muted, { r: 5 });
    case "cursor":
      return `<polygon points="${n(f.x)},${n(f.y)} ${n(f.x)},${n(f.y+f.height)} ${n(f.x+f.width*0.35)},${n(f.y+f.height*0.7)} ${n(f.x+f.width*0.55)},${n(f.y+f.height*0.5)}" fill="${p.text}" stroke="${p.background}" stroke-width="2"/>`;
    default: return rrect(f, ac, { r });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TEXT
// ═══════════════════════════════════════════════════════════════════════

function renderText(layer: MotionLayer, p: MotionPalette): string {
  const content = (layer.content ?? "").trim();
  if (!content) return "";
  const f = layer.frame;
  const isTitle = layer.safeAreaRole === "title";
  const fontSize = Number(layer.style?.fontSize ?? 32);
  const fontWeight = Number(layer.style?.fontWeight ?? 700);
  const fontFamily = layer.style?.fontFamily === "serif" || isTitle ? SERIF : SANS;
  const fill = typeof layer.style?.fill === "string" ? layer.style.fill : isTitle ? p.text : p.textSoft;

  const lh = fontSize * 1.18;
  const maxLines = Math.max(1, Math.floor((f.height + fontSize*0.2) / lh));
  const lines = truncateLines(wrap(content, f.width, fontSize), maxLines);

  const tspans = lines.map((line, i) =>
    `<tspan x="${n(f.x)}" y="${n(f.y + fontSize + i*lh)}">${esc(line)}</tspan>`
  ).join("");

  return `<text font-family="${fontFamily}" font-size="${n(fontSize)}" font-weight="${fontWeight}" fill="${fill}" letter-spacing="0">${tspans}</text>`;
}

function wrap(text: string, maxW: number, fontSize: number): string[] {
  const lines: string[] = [];
  let cur = "", curW = 0;
  for (const ch of text) {
    if (ch === "\n") { lines.push(cur); cur = ""; curW = 0; continue; }
    const charW = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? fontSize * 0.94 : ch === " " ? fontSize * 0.3 : fontSize * 0.54;
    if (cur && curW + charW > maxW) { lines.push(cur); cur = ch; curW = charW; }
    else { cur += ch; curW += charW; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function truncateLines(lines: string[], max: number): string[] {
  if (lines.length <= max) return lines;
  const last = lines[max-1] ?? "";
  return [...lines.slice(0, max-1), last.length > 1 ? last.slice(0,-1) + "\u2026" : last];
}

// ═══════════════════════════════════════════════════════════════════════
// CAPTIONS
// ═══════════════════════════════════════════════════════════════════════

function renderCaptionTrack(track: MotionCaptionTrack, frame: number, p: MotionPalette, paper: boolean): string {
  const cue = track.cues.find(c => frame >= c.startFrame && frame <= c.endFrame);
  if (!cue?.text.trim()) return "";
  const area = track.safeArea;
  const fz = Math.round(Math.min(area.height*0.4, area.width/11));
  const lh = fz * 1.2;
  const lines = wrap(cue.text.trim(), area.width, fz).slice(0, 2);
  const bh = lines.length * lh;
  const by = area.y + Math.max(0, (area.height - bh)/2);
  const cx = area.x + area.width/2;

  const bg = paper ? "rgba(255,253,240,0.9)" : "rgba(8,12,24,0.82)";
  const tc = paper ? p.text : p.text;

  return [
    rrect({x:area.x, y:by-fz*0.3, width:area.width, height:bh+fz*0.4}, bg, { r: 12, sw: paper ? 2 : 0, stroke: paper ? p.border : "none" }),
    `<text font-family="${SANS}" font-size="${n(fz)}" font-weight="800" fill="${tc}" text-anchor="middle">${
      lines.map((l,i) => `<tspan x="${n(cx)}" y="${n(by+fz+i*lh)}">${esc(l)}</tspan>`).join("")
    }</text>`
  ].join("");
}

// ═══════════════════════════════════════════════════════════════════════
// DEFS
// ═══════════════════════════════════════════════════════════════════════


// ── Image rendering (Sharp-compatible: local paths or data URIs) ─────
function renderImage(layer: MotionLayer): string {
  const href = (layer.content ?? "").trim();
  if (!href) return "";
  const f = layer.frame;
  return `<image href="${esc(href)}" x="${n(f.x)}" y="${n(f.y)}" width="${n(f.width)}" height="${n(f.height)}" preserveAspectRatio="xMidYMid slice"/>`;
}

function defs(p: MotionPalette, paper: boolean): string {
  const a0 = p.accents[0] ?? p.text, a1 = p.accents[1] ?? a0;
  return `<defs>
    <linearGradient id="paperBgGrad" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="${p.backgroundEdge}"/><stop offset="50%" stop-color="${p.background}"/><stop offset="100%" stop-color="${p.background}"/>
    </linearGradient>
    <linearGradient id="darkBgGrad" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="${p.backgroundEdge}"/><stop offset="60%" stop-color="${p.background}"/><stop offset="100%" stop-color="${p.background}"/>
    </linearGradient>
    <radialGradient id="glowA" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${a0}" stop-opacity="0.25"/><stop offset="100%" stop-color="${a0}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${a1}" stop-opacity="0.2"/><stop offset="100%" stop-color="${a1}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="coreGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${a0}" stop-opacity="0.6"/><stop offset="100%" stop-color="${a0}" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-8%" y="-8%" width="116%" height="116%">
      <feDropShadow dx="5" dy="7" stdDeviation="2" flood-color="${p.text}" flood-opacity="0.18"/>
    </filter>
  </defs>`;
}

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

interface RectStyle { stroke?: string; sw?: number; r?: number; opacity?: number; filter?: string; }

function rrect(f: any, fill: string, s: RectStyle = {}): string {
  const r = Math.max(0, s.r ?? 0);
  const st = s.stroke && s.stroke !== "none" ? ` stroke="${s.stroke}" stroke-width="${s.sw ?? 1}"` : "";
  const o = s.opacity !== undefined && s.opacity < 0.999 ? ` opacity="${n(s.opacity)}"` : "";
  const fi = s.filter ? ` filter="${s.filter}"` : "";
  return `<rect x="${n(f.x)}" y="${n(f.y)}" width="${n(Math.max(0, f.width))}" height="${n(Math.max(0,f.height))}" rx="${n(r)}" fill="${fill}"${st}${o}${fi}/>`;
}

function cx(f: Box): number { return f.x + f.width/2; }
function cy(f: Box): number { return f.y + f.height/2; }
function n(v: number): number { const r = Math.round(v*100)/100; return Object.is(r,-0) ? 0 : r; }
function clamp01(v: number): number { return v <= 0 ? 0 : v >= 1 ? 1 : v; }
function esc(s: string): string { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }


// ── Product Card Generator (renders as SVG shapes, Sharp-compatible) ──
export function productCardLayers(
  product: { name?: string; tagline?: string; rank?: number; category?: string } | undefined,
  frame: { x: number; y: number; width: number; height: number },
  palette: MotionPalette,
  idPrefix: string
): MotionLayer[] {
  if (!product?.name) return [];
  const f = frame;
  const accent = palette.accents[0] ?? palette.text;
  const accent2 = palette.accents[1] ?? accent;
  const initial = product.name.charAt(0).toUpperCase();
  const name = product.name.length > 16 ? product.name.slice(0, 15) + "\u2026" : product.name;

  return [
    // Card background
    { id: idPrefix + "_bg", kind: "shape" as const, frame: f, style: { tone: "panel", colorIndex: 0 }, safeAreaRole: "visual" as const },
    // Accent top strip
    { id: idPrefix + "_strip", kind: "shape" as const, frame: { x: f.x, y: f.y, width: f.width, height: Math.round(f.height * 0.12) }, style: { tone: "bar", colorIndex: 0, radius: 0 }, safeAreaRole: "visual" as const },
    // Large initial letter
    { id: idPrefix + "_init", kind: "text" as const, frame: { x: f.x + Math.round(f.width * 0.08), y: f.y + Math.round(f.height * 0.18), width: Math.round(f.width * 0.3), height: Math.round(f.height * 0.4) }, content: initial, style: { fontSize: Math.round(Math.min(f.width, f.height) * 0.22), fontWeight: 950, fontFamily: "serif", fill: accent }, safeAreaRole: "title" as const },
    // Product name
    { id: idPrefix + "_name", kind: "text" as const, frame: { x: f.x + Math.round(f.width * 0.08), y: f.y + Math.round(f.height * 0.55), width: Math.round(f.width * 0.84), height: Math.round(f.height * 0.2) }, content: name, style: { fontSize: Math.round(f.width * 0.08), fontWeight: 800 }, safeAreaRole: "ui" as const },
    // Tagline / category
    ...(product.tagline ? [{ id: idPrefix + "_tag", kind: "text" as const, frame: { x: f.x + Math.round(f.width * 0.08), y: f.y + Math.round(f.height * 0.74), width: Math.round(f.width * 0.84), height: Math.round(f.height * 0.14) }, content: product.tagline.length > 28 ? product.tagline.slice(0, 27) + "\u2026" : product.tagline, style: { fontSize: Math.round(f.width * 0.05), fontWeight: 600, fill: palette.muted }, safeAreaRole: "ui" as const }] : []),
    // Rank badge (if available)
    ...(product.rank ? [{ id: idPrefix + "_rank", kind: "shape" as const, frame: { x: f.x + Math.round(f.width * 0.76), y: f.y + Math.round(f.height * 0.04), width: Math.round(f.width * 0.18), height: Math.round(f.height * 0.1) }, style: { tone: "sticker", colorIndex: 1 }, safeAreaRole: "visual" as const }, { id: idPrefix + "_rankTxt", kind: "text" as const, frame: { x: f.x + Math.round(f.width * 0.76), y: f.y + Math.round(f.height * 0.04), width: Math.round(f.width * 0.18), height: Math.round(f.height * 0.1) }, content: "#" + product.rank, style: { fontSize: Math.round(f.width * 0.05), fontWeight: 900 }, safeAreaRole: "ui" as const }] : []),
  ];
}

function debugStamp(g: MotionGraph, frame: number, p: MotionPalette): string {
  return `<text x="18" y="${g.height-18}" font-family="${SANS}" font-size="22" fill="${p.muted}" opacity="0.6">f ${frame}/${g.durationFrames}</text>`;
}
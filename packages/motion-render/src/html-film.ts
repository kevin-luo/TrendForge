import type { AssetSlot, MotionFrameDesignSystem, VisualSceneSpec } from "@trendforge/motion-core";

type Palette = {
  bg: string;
  bg2: string;
  sfc: string;
  bd: string;
  ink: string;
  mu: string;
  a: string;
  a2: string;
  a3: string;
  fn: string;
  fu: string;
  accents: string[];
};

type TemplateContext = {
  scene: VisualSceneSpec;
  palette: Palette;
  headline: string;
  src: string;
  img: string;
  hasImage: boolean;
  idx: number;
  templateId: string;
  body: string;
  chips: string[];
  metrics: Array<{ label: string; value: string }>;
};

type TemplateEntry = {
  id: string;
  className: string;
  match: (ctx: TemplateContext) => boolean;
  render: (ctx: TemplateContext) => string;
};

// Static fallback themes (used when no DeepSeek/local design system is supplied).
const DS: Record<"paper-ink" | "d", Palette> = {
  "paper-ink": {
    bg: "#F6F0DF",
    bg2: "#FFF8E8",
    sfc: "#FFFDF4",
    bd: "rgba(20,20,20,0.85)",
    ink: "#121212",
    mu: "#555048",
    a: "#F05A28",
    a2: "#F7E25B",
    a3: "#1B3A8A",
    fn: "'Noto Serif CJK SC','SimSun',serif",
    fu: "'Microsoft YaHei','PingFang SC',sans-serif",
    accents: ["#F05A28", "#F7E25B", "#1B3A8A"]
  },
  d: {
    bg: "#080C18",
    bg2: "#0E162A",
    sfc: "rgba(16,24,44,0.96)",
    bd: "rgba(99,179,237,0.22)",
    ink: "#EBF4FF",
    mu: "#8AA4C2",
    a: "#63B3ED",
    a2: "#9F7AEA",
    a3: "#48BB78",
    fn: "'Inter','Microsoft YaHei',sans-serif",
    fu: "'Microsoft YaHei','PingFang SC',sans-serif",
    accents: ["#63B3ED", "#9F7AEA", "#48BB78"]
  }
};

function paletteFromSystem(sys: MotionFrameDesignSystem): Palette {
  const acc = sys.palette.accents?.length ? sys.palette.accents : ["#F05A28", "#F7E25B", "#1B3A8A"];
  return {
    bg: sys.palette.background,
    bg2: sys.palette.surface,
    sfc: sys.palette.surface,
    bd: `${sys.palette.ink}33`,
    ink: sys.palette.ink,
    mu: sys.palette.muted,
    a: acc[0]!,
    a2: acc[1] ?? acc[0]!,
    a3: acc[2] ?? acc[0]!,
    fn: sys.typography.display || "'Microsoft YaHei',sans-serif",
    fu: sys.typography.body || "'Microsoft YaHei',sans-serif",
    accents: acc
  };
}

function rotateAccents(d: Palette, accentIndex: number): Palette {
  const acc = d.accents;
  const n = acc.length;
  if (n < 2) return d;
  const i = ((accentIndex % n) + n) % n;
  return { ...d, a: acc[i]!, a2: acc[(i + 1) % n]!, a3: acc[(i + 2) % n]! };
}

function e(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sceneImg(s: VisualSceneSpec): string {
  const asset = pickSceneAsset(s);
  if (asset) return asset.src;
  return s.contentSlots.product?.screenshotPath || s.contentSlots.product?.thumbnailPath || s.contentSlots.image || "";
}

function hasImage(s: VisualSceneSpec): boolean {
  return Boolean(sceneImg(s));
}

function pickSceneAsset(s: VisualSceneSpec) {
  const assets = s.contentSlots.assets ?? [];
  const priority: AssetSlot["role"][] = ["hero", "screenshot", "illustration", "background", "thumbnail"];
  for (const role of priority) {
    const match = assets.find((asset) => asset.role === role && asset.src.trim());
    if (match) return match;
  }
  return assets.find((asset) => asset.role === "logo" && asset.src.trim()) ?? undefined;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function deco(d: Palette, ghost: string): string {
  return `<div class="deco"><span class="blob" style="background:${d.a}"></span><span class="blob blob2" style="background:${d.a2}"></span><b class="ghost" style="color:${d.a}">${e(ghost)}</b></div>`;
}

function textureLayer(kind: string, tone: string): string {
  return `<div class="texture texture--${kind}" data-anim="texture-drift" data-depth="0.04" data-d="-0.08" style="background-color:${tone}22"></div>`;
}

function motionAttr(anim: string, depth = 0, delay?: number): string {
  return `data-anim="${anim}" data-depth="${depth.toFixed(2)}"${typeof delay === "number" ? ` data-d="${delay.toFixed(2)}"` : ""}`;
}

function fitStyle(maxLines: number, minFont: number): string {
  return `--fit-max-lines:${maxLines};--fit-min-font:${minFont}px;`;
}

function fitAttr(role: string, maxLines: number, minFont: number): string {
  return `data-fit="1" data-fit-role="${e(role)}" data-max-lines="${maxLines}" data-min-font="${minFont}"`;
}

function normalizeTemplateId(templateId: string): string {
  return templateId.trim().toLowerCase();
}

function templateContext(scene: VisualSceneSpec, palette: Palette, idx: number): TemplateContext {
  const templateId = scene.templateId?.trim() || `trendforge.${scene.visualType}`;
  const body = scene.contentSlots.body?.trim() ?? "";
  const chips = unique([
    ...(scene.contentSlots.chips ?? []),
    ...(scene.contentSlots.entities ?? []),
    ...(scene.contentSlots.metrics ?? []).map((metric) => `${metric.label} ${metric.value}`)
  ]).slice(0, 6);
  return {
    scene,
    palette,
    headline: scene.contentSlots.headline?.trim() ?? "",
    src: scene.contentSlots.sourceLabel?.trim() ?? "PROMO",
    img: sceneImg(scene),
    hasImage: hasImage(scene),
    idx,
    templateId,
    body,
    chips,
    metrics: scene.contentSlots.metrics?.slice(0, 4) ?? []
  };
}

function templateBadge(ctx: TemplateContext): string {
  return `<div class="kr su" data-d="0">${e(ctx.src)}</div>`;
}

function chipRow(values: string[], accent: string, startDelay = 0.32): string {
  const items = values.slice(0, 6);
  if (!items.length) return "";
  return `<div class="pillrow">${items
    .map((value, index) => `<span class="pill su" data-d="${(startDelay + index * 0.08).toFixed(2)}" style="background:${accent}">${e(value)}</span>`)
    .join("")}</div>`;
}

function metricCards(metrics: Array<{ label: string; value: string }>, d: Palette, fallback: string[]): string {
  const rows = metrics.length
    ? metrics
    : fallback.slice(0, 3).map((value, index) => ({
        label: index === 0 ? "Focus" : index === 1 ? "Signal" : "Angle",
        value
      }));
  return rows
    .map(
      (row, index) => `<div class="metric-card su" data-d="${(0.22 + index * 0.08).toFixed(2)}">
        <span class="metric-label">${e(row.label)}</span>
        <strong class="metric-value" ${fitAttr("metric", 1, 24)} style="${fitStyle(1, 24)}color:${index === 0 ? d.a : index === 1 ? d.a2 : d.a3}">${e(row.value)}</strong>
      </div>`
    )
    .join("");
}

function listCards(values: string[], d: Palette, tone: string, base = 0.2): string {
  return values
    .slice(0, 4)
    .map(
      (value, index) => `<div class="stack-card su" data-d="${(base + index * 0.08).toFixed(2)}" style="border-color:${tone};background:${tone}18">
        <span class="stack-card-copy" ${fitAttr("card", 2, 24)} style="${fitStyle(2, 24)}">${e(value)}</span>
      </div>`
    )
    .join("");
}

function renderImageHero(ctx: TemplateContext): string {
  const body = ctx.body ? `<div class="para on-img su" data-d="0.2" ${fitAttr("body", 3, 24)} style="${fitStyle(3, 24)}">${e(ctx.body)}</div>` : "";
  const metrics = ctx.metrics.length ? `<div class="metric-strip">${metricCards(ctx.metrics, ctx.palette, ctx.chips)}</div>` : "";
  return `<div class="template template--image-hero" data-template="image-hero" data-template-id="${e(ctx.templateId)}">
    ${textureLayer("hero", ctx.palette.a)}
    <div class="bgfill" ${motionAttr("hero-zoom", 0.18, -0.12)}>${ctx.img ? `<img class="bgimg" src="${e(ctx.img)}" alt="" ${motionAttr("hero-pan", 0.12, -0.08)}>` : ""}<div class="scrim"></div></div>
    ${deco(ctx.palette, "#")}
    ${templateBadge(ctx)}
    <div class="hero-mid" ${motionAttr("hero-rise", 0.1, 0.04)}>
      ${ctx.chips.length ? chipRow(ctx.chips.slice(0, 3), ctx.palette.a) : ""}
      <div class="hl on-img su" data-d="0.1" ${fitAttr("headline", 2, 52)} style="${fitStyle(2, 52)}">${e(ctx.headline)}</div>
      ${body}
      ${metrics}
    </div>
  </div>`;
}

function renderFeatureStack(ctx: TemplateContext): string {
  const leftCards = listCards([ctx.body, ...ctx.chips].filter(Boolean) as string[], ctx.palette, ctx.palette.a2, 0.26);
  const rightCards = listCards(
    [
      ctx.metrics.map((metric) => `${metric.label} ${metric.value}`).join(" · "),
      ctx.scene.contentSlots.entities?.[0] ?? ctx.chips[0] ?? ctx.headline,
      ctx.scene.contentSlots.entities?.[1] ?? ctx.chips[1] ?? ctx.body
    ].filter(Boolean) as string[],
    ctx.palette,
    ctx.palette.a3,
    0.34
  );
  const media = ctx.hasImage
    ? `<div class="feature-media" ${motionAttr("media-pan", 0.18, -0.06)}><img src="${e(ctx.img)}" alt="" ${motionAttr("media-pan", 0.2, -0.02)}><span class="media-tag">${e(ctx.src)}</span></div>`
    : `<div class="feature-media feature-media--empty" ${motionAttr("media-pan", 0.18, -0.06)}><span class="media-tag">${e(ctx.src)}</span><strong ${fitAttr("headline", 2, 48)} style="${fitStyle(2, 48)}">${e(ctx.headline)}</strong></div>`;
  return `<div class="template template--feature-stack" data-template="feature-stack" data-template-id="${e(ctx.templateId)}">
    ${textureLayer("grid", ctx.palette.a2)}
    ${deco(ctx.palette, String(ctx.idx + 1).padStart(2, "0"))}
    ${templateBadge(ctx)}
    <div class="template-grid template-grid--feature" ${motionAttr("stack-sway", 0.08, 0.02)}>
      <div class="template-copy" ${motionAttr("stack-sway", 0.12, 0.02)}>
        <div class="hl su" data-d="0.08" ${fitAttr("headline", 2, 50)} style="${fitStyle(2, 50)}">${e(ctx.headline)}</div>
        ${ctx.body ? `<div class="para su" data-d="0.18" ${fitAttr("body", 3, 24)} style="${fitStyle(3, 24)}">${e(ctx.body)}</div>` : ""}
        ${chipRow(ctx.chips, ctx.palette.a, 0.32)}
      </div>
      ${media}
    </div>
    <div class="template-stack">${leftCards}${rightCards}</div>
  </div>`;
}

function renderMetricRank(ctx: TemplateContext): string {
  const metricValues = ctx.metrics.length
    ? ctx.metrics
    : [
        { label: "Rank", value: `#${ctx.idx + 1}` },
        { label: "Signal", value: ctx.chips[0] ?? ctx.headline },
        { label: "Angle", value: ctx.chips[1] ?? ctx.body }
      ].filter((item) => item.value) as Array<{ label: string; value: string }>;
  const ranked = metricValues
    .slice(0, 4)
    .map(
      (metric, index) => `<div class="rank-row su" data-d="${(0.22 + index * 0.08).toFixed(2)}" ${motionAttr("rank-rise", 0.14 + index * 0.03, 0.02 + index * 0.02)}>
        <span class="rank-index" ${motionAttr("rank-pop", 0.18, 0.06)} style="background:${index === 0 ? ctx.palette.a : index === 1 ? ctx.palette.a2 : ctx.palette.a3}">${String(index + 1)}</span>
        <div class="rank-body">
          <span class="metric-label">${e(metric.label)}</span>
          <strong ${fitAttr("rank", 2, 24)} style="${fitStyle(2, 24)}">${e(metric.value)}</strong>
        </div>
      </div>`
    )
    .join("");
  const visual = ctx.hasImage
    ? `<div class="rank-media" ${motionAttr("media-pan", 0.16, -0.04)}><img src="${e(ctx.img)}" alt="" ${motionAttr("media-pan", 0.2, -0.02)}><span class="rank-media-badge">${e(ctx.src)}</span></div>`
    : `<div class="rank-media rank-media--empty" ${motionAttr("media-pan", 0.16, -0.04)}><span class="rank-media-badge">${e(ctx.src)}</span><strong ${fitAttr("headline", 2, 48)} style="${fitStyle(2, 48)}">${e(ctx.headline)}</strong></div>`;
  return `<div class="template template--metric-rank" data-template="metric-rank" data-template-id="${e(ctx.templateId)}">
    ${textureLayer("pulse", ctx.palette.a3)}
    ${deco(ctx.palette, "01")}
    ${templateBadge(ctx)}
    <div class="template-grid template-grid--metric">
      <div class="template-copy" ${motionAttr("rank-rise", 0.1, 0.04)}>
        <div class="hl su" data-d="0.06" ${fitAttr("headline", 2, 50)} style="${fitStyle(2, 50)}">${e(ctx.headline)}</div>
        ${ctx.body ? `<div class="para su" data-d="0.16" ${fitAttr("body", 3, 24)} style="${fitStyle(3, 24)}">${e(ctx.body)}</div>` : ""}
      </div>
      ${visual}
    </div>
    <div class="rank-list">${ranked}</div>
  </div>`;
}

function renderSplitCompare(ctx: TemplateContext): string {
  const left = ctx.chips.slice(0, 3);
  const right = ctx.chips.slice(3, 6);
  const leftValues = left.length ? left : ([ctx.headline, ctx.body].filter(Boolean) as string[]);
  const rightValues = right.length ? right : ([ctx.body, ctx.scene.contentSlots.entities?.[0] ?? ""].filter(Boolean) as string[]);
  const leftStack = listCards(leftValues, ctx.palette, ctx.palette.a2, 0.22);
  const rightStack = listCards(
    [
      ctx.metrics.map((metric) => `${metric.label} ${metric.value}`).join(" · "),
      ctx.scene.contentSlots.entities?.[0] ?? ctx.chips[0] ?? ctx.headline,
      ctx.scene.contentSlots.entities?.[1] ?? ctx.chips[1] ?? ctx.body,
      ...rightValues
    ].filter(Boolean) as string[],
    ctx.palette,
    ctx.palette.a3,
    0.3
  );
  const imagePanel = ctx.hasImage
    ? `<div class="split-image" ${motionAttr("pane-drift", 0.14, -0.04)}><img src="${e(ctx.img)}" alt="" ${motionAttr("split-zoom", 0.2, -0.02)}></div>`
    : `<div class="split-image split-image--empty" ${motionAttr("pane-drift", 0.14, -0.04)}><strong ${fitAttr("headline", 2, 48)} style="${fitStyle(2, 48)}">${e(ctx.headline)}</strong><span>${e(ctx.src)}</span></div>`;
  return `<div class="template template--split-compare" data-template="split-compare" data-template-id="${e(ctx.templateId)}">
    ${textureLayer("split", ctx.palette.a)}
    ${deco(ctx.palette, "VS")}
    ${templateBadge(ctx)}
    <div class="hl su" data-d="0.05" ${motionAttr("compare-scan", 0.08, 0.02)} ${fitAttr("headline", 2, 50)} style="${fitStyle(2, 50)}">${e(ctx.headline)}</div>
    ${ctx.body ? `<div class="para su" data-d="0.16" ${fitAttr("body", 3, 24)} style="${fitStyle(3, 24)}">${e(ctx.body)}</div>` : ""}
    <div class="split-grid">
      <div class="split-pane" ${motionAttr("pane-drift", 0.12, 0.04)}>
        ${imagePanel}
        ${leftStack}
      </div>
      <div class="split-pane" ${motionAttr("pane-drift", 0.2, 0.08)}>
        ${rightStack}
        ${chipRow(ctx.metrics.map((metric) => `${metric.label} ${metric.value}`), ctx.palette.a, 0.36)}
      </div>
    </div>
  </div>`;
}

function renderOutroCta(ctx: TemplateContext): string {
  const label = ctx.scene.visualType === "whiteboard-explain" ? "Next step" : "Call to action";
  const body = ctx.body ? `<div class="para su" data-d="0.18" ${fitAttr("body", 3, 24)} style="${fitStyle(3, 24)}">${e(ctx.body)}</div>` : "";
  const media = ctx.hasImage
    ? `<div class="cta-media" ${motionAttr("cta-glow", 0.16)}><img src="${e(ctx.img)}" alt="" ${motionAttr("cta-glow", 0.22)}></div>`
    : "";
  return `<div class="template template--outro-cta" data-template="outro-cta" data-template-id="${e(ctx.templateId)}">
    ${textureLayer("halo", ctx.palette.a)}
    ${ctx.hasImage ? `<div class="bgfill" ${motionAttr("cta-glow", 0.12, -0.08)}>${media}<div class="scrim scrim--cta"></div></div>` : ""}
    ${deco(ctx.palette, "END")}
    ${templateBadge(ctx)}
    <div class="cta-shell" ${motionAttr("cta-rise", 0.08, 0.04)}>
      <div class="kr su" data-d="0">${e(label)}</div>
      <div class="hl su" data-d="0.06" ${fitAttr("headline", 2, 50)} style="${fitStyle(2, 50)}">${e(ctx.headline)}</div>
      ${body}
      <div class="cta-pill su" data-d="0.28" ${motionAttr("cta-glow", 0.2, 0.12)} style="background:${ctx.palette.a}">${e(ctx.src)}</div>
      ${chipRow(ctx.chips.slice(0, 3), ctx.palette.a2, 0.34)}
    </div>
  </div>`;
}

function resolveTemplate(ctx: TemplateContext): TemplateEntry {
  const t = normalizeTemplateId(ctx.templateId);
  const byId = TEMPLATE_REGISTRY.find((entry) => entry.match(ctx) && t.includes(entry.id));
  if (byId) return byId;
  return TEMPLATE_REGISTRY.find((entry) => entry.match(ctx)) ?? TEMPLATE_REGISTRY[0]!;
}

const TEMPLATE_REGISTRY: TemplateEntry[] = [
  {
    id: "outro-cta",
    className: "template--outro-cta",
    match: (ctx) => /outro|cta|end|closing|summary/.test(normalizeTemplateId(ctx.templateId)),
    render: renderOutroCta
  },
  {
    id: "split-compare",
    className: "template--split-compare",
    match: (ctx) => /split|compare/.test(normalizeTemplateId(ctx.templateId)) || ctx.scene.visualType === "split-compare",
    render: renderSplitCompare
  },
  {
    id: "metric-rank",
    className: "template--metric-rank",
    match: (ctx) =>
      /rank|metric|pulse|timeline/.test(normalizeTemplateId(ctx.templateId))
      || ctx.scene.visualType === "rank-race"
      || ctx.scene.visualType === "data-pulse"
      || ctx.scene.visualType === "timeline-rail",
    render: renderMetricRank
  },
  {
    id: "feature-stack",
    className: "template--feature-stack",
    match: (ctx) =>
      /feature|stack|workflow|whiteboard|evidence/.test(normalizeTemplateId(ctx.templateId))
      || ctx.scene.visualType === "workflow-orbit"
      || ctx.scene.visualType === "whiteboard-explain"
      || ctx.scene.visualType === "news-evidence-wall",
    render: renderFeatureStack
  },
  {
    id: "image-hero",
    className: "template--image-hero",
    match: (ctx) =>
      ctx.hasImage
      && (
        /hero|product|creator/.test(normalizeTemplateId(ctx.templateId))
        || ctx.scene.visualType === "product-workspace"
        || ctx.scene.visualType === "creator-desk"
      ),
    render: renderImageHero
  }
];

function rScene(s: VisualSceneSpec, d: Palette, idx: number): string {
  const ctx = templateContext(s, d, idx);
  const template = resolveTemplate(ctx);
  return `<div class="template-shell ${template.className}" data-template="${template.id}" data-template-id="${e(ctx.templateId)}">${template.render(ctx)}</div>`;
}

const CAPTION_HARD_BREAK = /([。！？!?；;])/;
const CAPTION_SOFT_BREAK = /([，,、：:])/;
const CAPTION_MAX_LEN = 20;
const CAPTION_TARGET_LEN = 16;
const CAPTION_CONJUNCTIONS = [
  "然后",
  "所以",
  "但是",
  "不过",
  "同时",
  "而且",
  "另外",
  "接着",
  "最后",
  "并且",
  "如果",
  "因为",
  "为了",
  "and",
  "but",
  "so",
  "then",
  "or",
  "for",
  "to",
  "with"
];

// Split a long narration into short, time-phased subtitle cues so it never loads
// all at once (and never truncates to an ellipsis).
export function splitCaption(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const segs = normalized.match(/[^。！？!?；;]+[。！？!?；;]?/g) ?? [];
  const out: string[] = [];
  for (let seg of segs) {
    seg = seg.trim();
    if (!seg) continue;
    out.push(...splitCaptionSegment(seg));
  }
  return out.length ? out : [normalized];
}

function splitCaptionSegment(text: string): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > CAPTION_MAX_LEN) {
    const cut = pickCaptionBreak(rest);
    if (cut <= 0 || cut >= rest.length) {
      out.push(rest.slice(0, CAPTION_MAX_LEN).trim());
      rest = rest.slice(CAPTION_MAX_LEN).trim();
      continue;
    }
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

function pickCaptionBreak(text: string): number {
  const preferred = Math.min(CAPTION_TARGET_LEN, text.length - 1);
  let bestCut = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let i = 1; i < text.length; i++) {
    if (!isCaptionBoundary(text, i)) continue;
    const score = captionBreakScore(text, i, preferred);
    if (score > bestScore) {
      bestScore = score;
      bestCut = i;
    }
  }
  return bestCut;
}

function isCaptionBoundary(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) return false;
  const left = text[index - 1]!;
  const right = text[index]!;
  if (/\s/.test(left) || /\s/.test(right)) return true;
  if (CAPTION_SOFT_BREAK.test(left) || CAPTION_SOFT_BREAK.test(right)) return true;
  if (CAPTION_HARD_BREAK.test(left) || CAPTION_HARD_BREAK.test(right)) return true;
  if (/[A-Za-z0-9]/.test(left) && /[A-Za-z0-9]/.test(right)) return false;
  if (/[A-Za-z0-9]/.test(left) && /[-_.%+]/.test(right)) return false;
  if (/[-_.%+]/.test(left) && /[A-Za-z0-9]/.test(right)) return false;
  if (/[A-Za-z0-9]/.test(left) && /[\u4e00-\u9fff]/.test(right)) return false;
  if (/[\u4e00-\u9fff]/.test(left) && /[A-Za-z0-9]/.test(right)) return false;
  return true;
}

function captionBreakScore(text: string, index: number, preferred: number): number {
  const left = text[index - 1]!;
  const right = text[index]!;
  let score = 0;
  if (CAPTION_HARD_BREAK.test(left)) score += 120;
  if (CAPTION_SOFT_BREAK.test(left)) score += 90;
  if (/\s/.test(left) || /\s/.test(right)) score += 70;
  if (isConjunctionBoundary(text, index)) score += 80;
  if (/[\u4e00-\u9fff]/.test(left) && /[\u4e00-\u9fff]/.test(right)) score += 24;
  if (/[A-Za-z0-9]/.test(left) || /[A-Za-z0-9]/.test(right)) score += 12;
  score -= Math.abs(index - preferred) * 3;
  return score;
}

function isConjunctionBoundary(text: string, index: number): boolean {
  const before = text.slice(0, index);
  const after = text.slice(index);
  for (const word of CAPTION_CONJUNCTIONS) {
    const tail = before.slice(-word.length - 1);
    const head = after.slice(0, word.length + 1);
    if (new RegExp(`(^|[\\s，,、：:；;])${word}$`, "i").test(before)) return true;
    if (new RegExp(`^${word}(?=$|[\\s，,、：:；;])`, "i").test(after)) return true;
    if (tail.endsWith(` ${word}`) || head.startsWith(`${word} `)) return true;
  }
  return false;
}

export function makeFilmHtml(
  specs: VisualSceneSpec[],
  opts: { themeId?: string; fps?: number; designSystem?: MotionFrameDesignSystem; width?: number; height?: number } = {}
): string {
  const fps = opts.fps ?? 30;
  const width = opts.width ?? 1080;
  const height = opts.height ?? 1920;
  const ds = opts.designSystem ? paletteFromSystem(opts.designSystem) : (DS[(opts.themeId ?? specs[0]?.style?.themeId ?? "paper-ink") as keyof typeof DS] ?? DS.d);
  let total = 0;
  let sc = "";
  let idx = 0;
  for (const s of specs) {
    const df = Math.max(1, Math.round(s.duration * fps));
    const st = total;
    total += df;
    const dScene = rotateAccents(ds, s.design?.accentIndex ?? idx);
    const ts = (s.design?.typographyScale ?? 1).toFixed(3);
    let capHtml = "";
    const capText = s.contentSlots.caption?.trim();
    if (capText) {
      const cues = splitCaption(capText);
      const totalChars = cues.reduce((sum, c) => sum + c.length, 0) || 1;
      let cs = st;
      capHtml =
        `<div class="cap">` +
        cues
          .map((c, k) => {
            const w = k === cues.length - 1 ? total - cs : Math.max(1, Math.round((df * c.length) / totalChars));
            const cStart = cs;
            cs = Math.min(total, cs + w);
            return `<span class="cue" data-cs="${cStart}" data-ce="${cs}">${e(c)}</span>`;
          })
          .join("") +
        `</div>`;
    }
    sc += `<div class="scene${capHtml ? " has-cap" : ""}" style="--ts:${ts}" data-st="${st}" data-en="${total}">${rScene(s, dScene, idx)}${capHtml}</div>\n`;
    idx++;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${width},height=${height}">
<style>*{margin:0;padding:0;box-sizing:border-box}body{width:${width}px;height:${height}px;overflow:hidden;background:${ds.bg};font-family:${ds.fu};color:${ds.ink};-webkit-font-smoothing:antialiased}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;padding:72px 60px 60px;background:linear-gradient(160deg,${ds.bg2},${ds.bg} 50%);opacity:0;visibility:hidden;overflow:hidden;will-change:transform;backface-visibility:hidden}
.scene > :not(.deco){position:relative;z-index:1}
.template-shell{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;gap:18px}
.template{position:relative;flex:1;min-height:0;display:flex;flex-direction:column;gap:18px}
.deco{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.texture{position:absolute;inset:-10%;pointer-events:none;z-index:0;opacity:.16;mix-blend-mode:soft-light;filter:blur(0.2px) saturate(1.1)}
.texture--hero{background-image:radial-gradient(circle at 20% 20%,rgba(255,255,255,.18) 0 2px,transparent 2px),radial-gradient(circle at 70% 65%,rgba(255,255,255,.1) 0 1px,transparent 1px);background-size:24px 24px,18px 18px}
.texture--grid{background-image:linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px);background-size:42px 42px,42px 42px}
.texture--pulse{background-image:radial-gradient(circle at 50% 50%,rgba(255,255,255,.18) 0 14%,transparent 58%),radial-gradient(circle at 20% 70%,rgba(255,255,255,.08) 0 10%,transparent 52%)}
.texture--split{background-image:linear-gradient(135deg,rgba(255,255,255,.08) 0 1px,transparent 1px 18px),linear-gradient(45deg,rgba(255,255,255,.05) 0 1px,transparent 1px 20px)}
.texture--halo{background-image:radial-gradient(circle at 60% 32%,rgba(255,255,255,.2) 0 12%,transparent 52%),radial-gradient(circle at 40% 60%,rgba(255,255,255,.08) 0 10%,transparent 48%)}
.blob{position:absolute;width:760px;height:760px;border-radius:50%;filter:blur(120px);opacity:.16;top:-220px;right:-260px}
.blob2{top:auto;bottom:-300px;left:-280px;opacity:.12}
.ghost{position:absolute;right:24px;bottom:-60px;font-size:520px;font-weight:950;font-family:${ds.fn};line-height:.8;opacity:.05;letter-spacing:-12px}
.bgfill{position:absolute;inset:0;z-index:0}
.bgimg{width:100%;height:100%;object-fit:cover;display:block}
.scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.42) 0%,rgba(0,0,0,0.05) 32%,rgba(0,0,0,0.55) 78%,rgba(0,0,0,0.82) 100%)}
.scrim--cta{background:linear-gradient(180deg,rgba(2,6,18,0.22) 0%,rgba(2,6,18,0.68) 78%,rgba(2,6,18,0.88) 100%)}
.template>:not(.deco):not(.bgfill):not(.texture){position:relative;z-index:1}
.hero-mid{flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:18px}
.kr{font-size:22px;font-weight:800;letter-spacing:4px;color:${ds.a};text-transform:uppercase;margin-bottom:10px}
.hl{font-size:calc(82px*var(--ts,1));font-weight:950;font-family:${ds.fn};line-height:1.05;letter-spacing:-1px;color:${ds.ink}}
.hl.on-img{color:#fff;text-shadow:0 3px 28px rgba(0,0,0,0.55)}
.para{font-size:32px;font-weight:600;line-height:1.5;color:${ds.mu}}
.para.on-img{color:rgba(255,255,255,0.94);text-shadow:0 2px 18px rgba(0,0,0,0.6)}
.rule{width:88px;height:8px;border-radius:8px}
.fl{flex:1;display:flex;flex-direction:column;gap:16px}
.fill{flex:1;min-height:0}
.fl.fill{justify-content:center;margin-top:24px}
.pillrow{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px}
.pill{padding:10px 22px;border-radius:30px;color:#fff;font-size:26px;font-weight:800;box-shadow:0 6px 20px rgba(0,0,0,0.2)}
.metric-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:8px}
.metric-card{padding:18px 20px;border-radius:18px;background:${ds.sfc};border:2px solid ${ds.bd};display:flex;flex-direction:column;gap:8px}
.metric-label{font-size:18px;letter-spacing:2px;text-transform:uppercase;color:${ds.mu};font-weight:800}
.metric-value{font-size:30px;font-weight:900;line-height:1.1}
.template-grid{display:grid;gap:22px;align-items:stretch}
.template-grid--feature{grid-template-columns:1.05fr .95fr}
.template-grid--metric{grid-template-columns:1.1fr .9fr}
.template-copy{display:flex;flex-direction:column;gap:14px;justify-content:flex-end}
.template-stack{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:8px}
.stack-card{border-radius:18px;padding:18px 20px;border:2px solid transparent;font-size:26px;font-weight:800;line-height:1.35;color:${ds.ink};background:${ds.sfc}}
.stack-card-copy,.hl[data-fit],.para[data-fit],.metric-value[data-fit],.rank-body strong[data-fit]{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.hl[data-fit],.para[data-fit],.stack-card-copy[data-fit],.metric-value[data-fit],.rank-body strong[data-fit]{overflow-wrap:anywhere;word-break:break-word;hyphens:auto;line-break:auto;max-width:100%;-webkit-line-clamp:var(--fit-max-lines,2);text-wrap:balance}
.para[data-fit],.stack-card-copy[data-fit],.metric-value[data-fit],.rank-body strong[data-fit]{text-wrap:pretty}
.hl[data-fit]{line-height:1.03}
.para[data-fit]{line-height:1.42}
.stack-card-copy[data-fit]{font-size:inherit;line-height:1.28;align-self:stretch}
.metric-value[data-fit]{line-height:1.08;width:100%}
.rank-body strong[data-fit]{line-height:1.12;width:100%}
.feature-media,.rank-media,.split-image,.cta-media{position:relative;overflow:hidden;border-radius:24px;border:2px solid ${ds.bd};background:${ds.sfc};min-height:300px;box-shadow:0 20px 60px rgba(0,0,0,0.18)}
.feature-media img,.rank-media img,.split-image img,.cta-media img{width:100%;height:100%;object-fit:cover;display:block}
.feature-media::after,.rank-media::after,.split-image::after,.cta-media::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0));pointer-events:none}
.feature-media--empty,.rank-media--empty,.split-image--empty{display:flex;flex-direction:column;justify-content:flex-end;padding:28px}
.media-tag,.rank-media-badge{position:absolute;left:18px;top:18px;padding:10px 16px;border-radius:999px;background:rgba(0,0,0,0.56);color:#fff;font-size:18px;font-weight:800;letter-spacing:1px;text-transform:uppercase}
.rank-list{display:flex;flex-direction:column;gap:14px;margin-top:6px}
.rank-row{display:flex;align-items:stretch;gap:16px}
.rank-row[data-anim]{will-change:transform}
.rank-index{width:76px;height:76px;border-radius:18px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:34px;font-weight:950;flex-shrink:0;box-shadow:0 10px 26px rgba(0,0,0,0.16)}
.rank-body{flex:1;min-height:76px;border-radius:18px;background:${ds.sfc};border:2px solid ${ds.bd};display:flex;flex-direction:column;justify-content:center;padding:10px 22px;gap:6px}
.rank-body strong{font-size:30px;line-height:1.15}
.split-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:18px}
.split-pane{display:flex;flex-direction:column;gap:12px}
.split-image{min-height:250px}
.cta-shell{display:flex;flex-direction:column;justify-content:flex-end;gap:16px;flex:1;max-width:760px}
.cta-pill{align-self:flex-start;padding:14px 24px;border-radius:999px;color:#fff;font-size:28px;font-weight:900;box-shadow:0 12px 30px rgba(0,0,0,0.24)}
.cta-pill[data-fit]{overflow-wrap:anywhere;word-break:break-word;hyphens:auto;line-break:auto;white-space:normal}
.scene.has-cap{padding-bottom:170px}
.scene>.cap{position:absolute;left:48px;right:48px;bottom:44px;z-index:5;min-height:92px}
.cap .cue{position:absolute;left:0;right:0;bottom:0;background:rgba(8,10,16,0.74);color:#fff;font-size:34px;font-weight:800;line-height:1.32;padding:18px 28px;border-radius:16px;text-align:center;letter-spacing:.3px;opacity:0}
.su{opacity:0}
</style></head><body>
${sc}
<script>
var FPS=${fps};var TOTAL=${total};var ENTER=0.5;
var scenes=Array.prototype.slice.call(document.querySelectorAll(".scene"));
var elemCache=scenes.map(function(s){return Array.prototype.slice.call(s.querySelectorAll(".su"));});
var motionCache=scenes.map(function(s){return Array.prototype.slice.call(s.querySelectorAll("[data-anim]"));});
var cueCache=scenes.map(function(s){return Array.prototype.slice.call(s.querySelectorAll(".cue"));});
var fitCache=scenes.map(function(s){return Array.prototype.slice.call(s.querySelectorAll("[data-fit]"));});
var currentFrame=0;
function easeOut(t){return 1-Math.pow(1-t,3);}
function clamp01(v){return Math.max(0,Math.min(1,v));}
function motionTransform(kind, pc, local, frame, depth){
  var lift=(1-pc)*22;
  var x=0,y=0,scale=1,rot=0;
  if(kind==="hero-zoom"){scale=1.06+pc*0.08;y=-14*(1-pc);x=(0.5-pc)*depth*40;}
  else if(kind==="hero-pan"){scale=1.02+pc*0.04;x=(pc-0.5)*depth*36;y=(0.5-pc)*depth*24;}
  else if(kind==="hero-rise"){y=-28*(1-pc);scale=0.99+pc*0.04;}
  else if(kind==="media-pan"){scale=1.04+pc*0.06;x=(pc*18)-9;y=(0.5-pc)*18;}
  else if(kind==="stack-sway"){x=(pc-0.5)*depth*30;y=(1-pc)*14;rot=(0.5-pc)*1.2;}
  else if(kind==="rank-rise"){y=(1-pc)*24;x=(1-pc)*18;scale=0.97+pc*0.03;}
  else if(kind==="rank-pop"){scale=0.92+pc*0.12;rot=(pc-0.5)*1.1;}
  else if(kind==="pane-drift"){x=(0.5-pc)*depth*64;y=(1-pc)*12;}
  else if(kind==="split-zoom"){scale=1.03+pc*0.05;x=(pc-0.5)*depth*24;y=(0.5-pc)*depth*16;}
  else if(kind==="compare-scan"){scale=1.0+pc*0.02;rot=(pc-0.5)*0.4;x=(0.5-pc)*8;}
  else if(kind==="cta-rise"){y=(1-pc)*20;scale=0.98+pc*0.04;}
  else if(kind==="cta-glow"){scale=1.0+pc*0.03+0.012*Math.sin(frame/5);y=(0.5-pc)*8;rot=0.2*Math.sin(frame/9);}
  else if(kind==="texture-drift"){x=(pc-0.5)*depth*32;y=(0.5-pc)*depth*22;rot=(pc-0.5)*1.6;}
  return "translate3d("+x.toFixed(2)+"px,"+(y+lift).toFixed(2)+"px,0) scale("+scale.toFixed(4)+") rotate("+rot.toFixed(3)+"deg)";
}
function fitTextBlocks(){
  var doc=document;
  var probeRoot=doc.getElementById("__fit_probe_root");
  if(!probeRoot){
    probeRoot=doc.createElement("div");
    probeRoot.id="__fit_probe_root";
    probeRoot.style.cssText="position:absolute;left:-100000px;top:0;width:0;height:0;overflow:visible;visibility:hidden;pointer-events:none;z-index:-1";
    doc.body.appendChild(probeRoot);
  }
  for(var i=0;i<fitCache.length;i++){
    var list=fitCache[i];
    for(var j=0;j<list.length;j++){
      var el=list[j];
      var rect=el.getBoundingClientRect();
      if(!(rect.width>0&&rect.height>0)) continue;
      var computed=getComputedStyle(el);
      var maxLines=parseInt(el.dataset.maxLines||"1",10);
      if(!(maxLines>0)) maxLines=1;
      var minFont=parseFloat(el.dataset.minFont||"0");
      var startFont=parseFloat(computed.fontSize);
      if(!(startFont>0)) continue;
      if(!(minFont>0)) minFont=Math.max(12,startFont*0.72);
      if(minFont>startFont) minFont=startFont;
      var ratio=startFont>0?(parseFloat(computed.lineHeight)||startFont*1.2)/startFont:1.2;
      var probe=el.cloneNode(true);
      probe.removeAttribute("data-fit-state");
      probe.style.cssText+=";position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;transform:none;animation:none;filter:none;margin:0;max-width:none;max-height:none;overflow:visible;width:"+Math.ceil(rect.width)+"px";
      probe.style.fontSize=startFont.toFixed(2)+"px";
      probe.style.lineHeight=(ratio*startFont).toFixed(2)+"px";
      probe.style.height="auto";
      probe.style.webkitLineClamp="unset";
      probe.style.display="block";
      probeRoot.appendChild(probe);
      function fitsAt(size){
        probe.style.fontSize=size.toFixed(2)+"px";
        probe.style.lineHeight=(ratio*size).toFixed(2)+"px";
        return probe.scrollHeight<=(ratio*size*maxLines)+1;
      }
      var best=startFont;
      if(!fitsAt(startFont)){
        var low=minFont;
        var high=startFont;
        for(var step=0;step<8;step++){
          var mid=(low+high)/2;
          if(fitsAt(mid)){best=mid;low=mid;}else{high=mid;}
        }
      }
      el.style.fontSize=best.toFixed(2)+"px";
      if(best<startFont){
        if(best<=minFont+0.2&& !fitsAt(best)) el.setAttribute("data-fit-state","clamped");
        else el.removeAttribute("data-fit-state");
      } else {
        el.removeAttribute("data-fit-state");
      }
      probe.remove();
    }
  }
  if(probeRoot.childNodes.length===0) probeRoot.remove();
}
function renderFrame(frame){
  currentFrame=frame;
  for(var i=0;i<scenes.length;i++){
    var sc=scenes[i];var st=+sc.dataset.st,en=+sc.dataset.en;
    var active=frame>=st&&frame<en;
    sc.style.opacity=active?"1":"0";sc.style.visibility=active?"visible":"hidden";
    if(!active)continue;
    var local=(frame-st)/FPS;var span=(en-st)/FPS;var pc=span>0?Math.min(1,Math.max(0,local/span)):0;
    sc.style.transformOrigin="50% 45%";
    sc.style.transform="translateY("+(-12*pc).toFixed(2)+"px) scale("+(1+0.028*pc).toFixed(4)+")";
    var els=elemCache[i];
    for(var j=0;j<els.length;j++){
      var el=els[j];var d=parseFloat(el.dataset.d)||0;
      var ev=easeOut(clamp01((local-d)/ENTER));
      el.style.opacity=String(ev);
      el.style.transform="translateY("+((1-ev)*22).toFixed(2)+"px)";
    }
    var motions=motionCache[i];
    for(var m=0;m<motions.length;m++){
      var node=motions[m];var anim=node.dataset.anim||"";var depth=parseFloat(node.dataset.depth)||0;var delay=parseFloat(node.dataset.d)||0;
      var ev2=easeOut(clamp01((local-delay)/ENTER));
      node.style.opacity=String(ev2);
      node.style.transform=motionTransform(anim, ev2, local, frame, depth);
      node.style.transformOrigin=anim==="pane-drift"?"50% 50%":"50% 45%";
    }
    var cues=cueCache[i];
    for(var k=0;k<cues.length;k++){
      var cs=+cues[k].dataset.cs,ce=+cues[k].dataset.ce;
      cues[k].style.opacity=(frame>=cs&&frame<ce)?"1":"0";
    }
  }
}
var rafId=null,startTs=null,autoplay=true;
function tick(ts){if(startTs===null)startTs=ts;var f=Math.round((ts-startTs)/1000*FPS);if(TOTAL>0&&f>=TOTAL){startTs=ts;f=0;}renderFrame(f);rafId=requestAnimationFrame(tick);}
window.seek=function(frame){if(autoplay){autoplay=false;if(rafId!==null)cancelAnimationFrame(rafId);}renderFrame(frame);};
window.__totalFrames=TOTAL;
fitTextBlocks();
renderFrame(0);
if(document.fonts&&document.fonts.ready&&typeof document.fonts.ready.then==="function"){document.fonts.ready.then(function(){fitTextBlocks();renderFrame(currentFrame);});}
window.addEventListener("resize",function(){fitTextBlocks();renderFrame(currentFrame);});
rafId=requestAnimationFrame(tick);
</script></body></html>`;
}

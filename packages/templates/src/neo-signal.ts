import type { RenderPayload, TemplateDefinition, TrendItem } from "@trendforge/core";

export const neoSignalTemplate: TemplateDefinition = {
  id: "neo-signal",
  name: "Neo Signal",
  description: "Dark sci-fi workstation style with glass panels, HUD lines, rank numbers, and restrained cyan light.",
  ratios: ["9:16", "16:9", "1:1", "4:5"],
  defaultTheme: {
    accent: "#67E8F9",
    secondary: "#8B5CF6",
    background: "#080B12",
    density: "balanced",
    sciFiIntensity: 0.62,
    subtitlePosition: "bottom-safe",
    logoEnabled: true
  }
};

export function renderNeoSignalHtml(payload: RenderPayload): string {
  const scenes = payload.script.scenes;
  const accent = String(payload.theme?.accent ?? neoSignalTemplate.defaultTheme.accent);
  const secondary = String(payload.theme?.secondary ?? neoSignalTemplate.defaultTheme.secondary);
  const isPortrait = payload.height > payload.width;
  const boardItems = uniqueItems(scenes.flatMap((scene) => scene.items ?? [])).slice(0, 5);
  const sceneMarkup = scenes
    .map((scene, index) => {
      const item = scene.items?.[0];
      const rank = item?.rank ?? index + 1;
      const metric = item?.score ?? (index + 1) * 17;
      const thumbnail = item?.thumbnail;
      const metadata = readMetadata(scene.metadata);
      const layout = readChoice(metadata.layout, ["hero-image-left", "hero-image-right", "image-top", "split-brief", "metric-focus"], index % 2 === 0 ? "hero-image-right" : "hero-image-left");
      const motion = readChoice(metadata.motion, ["push-in", "drift-left", "drift-right", "reveal-up", "scanline"], index % 2 === 0 ? "push-in" : "drift-left");
      const highlights = readStringArray(metadata.highlights).slice(0, isPortrait && scene.type === "item" ? 2 : 4);
      const modelMetrics = readStringArray(metadata.metrics).slice(0, 3);
      const meta = [
        item?.source ? String(item.source).replace(/-/g, " ") : "",
        item?.score ? `${item.score} upvotes` : "",
        item?.comments ? `${item.comments} comments` : ""
      ].filter(Boolean);
      const metrics = modelMetrics.length ? modelMetrics : meta;
      const bodyLines = splitDisplayText(scene.screenText, isPortrait && scene.type === "item" ? 2 : isPortrait ? 3 : 2);
      const subtitleText = payload.subtitles?.[index]?.text ?? scene.voiceText;
      const panelMarkup = scene.type === "item"
        ? `<div class="product-panel ${thumbnail ? "has-image" : "fallback-panel"}">
            ${thumbnail ? `<img src="${escapeAttr(thumbnail)}" alt="${escapeAttr(scene.title)}" crossorigin="anonymous" />` : `<div class="product-mark">${escapeHtml(initials(scene.title))}</div>`}
            <div class="product-caption">
              <span>#${rank}</span>
              <strong>${escapeHtml(item?.title ?? scene.title)}</strong>
              ${isPortrait && metrics.length ? `<em>${escapeHtml(metrics.slice(0, 2).join(" · "))}</em>` : ""}
            </div>
          </div>`
        : renderSignalBoard(boardItems, scene.title);
      return `<section class="scene scene-${scene.type} layout-${layout} motion-${motion}" style="--i:${index}">
        <div class="hud-top">
          <span>TRENDFORGE / ${payload.composition}</span>
          <span>${String(scene.type).toUpperCase()}</span>
        </div>
        <div class="rank">${scene.type === "item" ? String(rank).padStart(2, "0") : "TF"}</div>
        <div class="scene-layout">
          <div class="scene-body">
            <p class="kicker">${escapeHtml(scene.visualHint ?? "LOCAL AI VIDEO WORKSTATION")}</p>
            <h1>${escapeHtml(scene.title)}</h1>
            <div class="screen-lines">${bodyLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>
            ${highlights.length ? `<div class="highlight-list">${highlights.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div>` : ""}
            ${isPortrait && scene.type === "item" ? "" : `<div class="data-bar"><span style="width:${Math.min(96, Math.max(24, metric))}%"></span></div>`}
            ${metrics.length && !(isPortrait && scene.type === "item") ? `<div class="meta-row">${metrics.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div>` : ""}
          </div>
          ${panelMarkup}
        </div>
        <div class="subtitle-safe">${escapeHtml(truncateText(subtitleText, isPortrait && scene.type === "item" ? 54 : isPortrait ? 86 : 116))}</div>
      </section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(payload.script.title)}</title>
  <style>
    :root {
      --accent: ${accent};
      --secondary: ${secondary};
      --bg: #080B12;
      --panel: rgba(13, 19, 33, 0.72);
      --line: rgba(148, 163, 184, 0.18);
      --text: #F4F8FF;
      --muted: #9CA3AF;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif; }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      background:
        linear-gradient(rgba(103, 232, 249, 0.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(103, 232, 249, 0.055) 1px, transparent 1px),
        radial-gradient(circle at 75% 20%, rgba(139, 92, 246, 0.22), transparent 34%),
        radial-gradient(circle at 20% 78%, rgba(34, 211, 238, 0.13), transparent 36%),
        #080B12;
      background-size: 48px 48px, 48px 48px, auto, auto, auto;
    }
    body::after {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background: repeating-linear-gradient(0deg, rgba(255,255,255,0.035), rgba(255,255,255,0.035) 1px, transparent 1px, transparent 5px);
      mix-blend-mode: soft-light;
    }
    .composition {
      position: relative;
      width: ${payload.width}px;
      height: ${payload.height}px;
      transform-origin: top left;
    }
    .scene {
      position: absolute;
      inset: 0;
      opacity: 0;
      padding: ${payload.height > payload.width ? "92px 74px 130px" : "74px 110px 104px"};
      animation: scene ${payload.duration}s linear forwards;
      animation-delay: calc(var(--i) * ${payload.duration / Math.max(1, scenes.length)}s);
    }
    .scene::before {
      content: "";
      position: absolute;
      inset: 50px;
      border: 1px solid var(--line);
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.5), rgba(15, 23, 42, 0.18));
      backdrop-filter: blur(18px);
      clip-path: polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 28px 100%, 0 calc(100% - 28px));
    }
    .hud-top {
      position: relative;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      color: var(--muted);
      font-size: 16px;
      letter-spacing: 0;
    }
    .rank {
      position: absolute;
      z-index: 2;
      right: ${payload.height > payload.width ? "76px" : "116px"};
      top: ${payload.height > payload.width ? "150px" : "130px"};
      font-size: ${payload.height > payload.width ? "130px" : "104px"};
      line-height: 1;
      font-weight: 800;
      color: transparent;
      -webkit-text-stroke: 1px rgba(103, 232, 249, 0.65);
      text-shadow: 0 0 34px rgba(103, 232, 249, 0.32);
    }
    .scene-layout {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: ${payload.height > payload.width ? "1fr" : "minmax(0, 1fr) 420px"};
      gap: ${payload.height > payload.width ? "42px" : "56px"};
      align-items: center;
      margin-top: ${payload.height > payload.width ? "230px" : "220px"};
    }
    .layout-hero-image-left .scene-layout {
      grid-template-columns: ${payload.height > payload.width ? "1fr" : "420px minmax(0, 1fr)"};
    }
    .layout-hero-image-left .product-panel {
      order: ${payload.height > payload.width ? "0" : "-1"};
    }
    .layout-image-top .scene-layout {
      grid-template-columns: 1fr;
      margin-top: ${payload.height > payload.width ? "172px" : "150px"};
    }
    .layout-image-top .product-panel {
      width: 100%;
      height: ${payload.height > payload.width ? "420px" : "360px"};
      order: -1;
    }
    .layout-image-top .signal-board {
      order: -1;
    }
    .layout-metric-focus .scene-layout {
      grid-template-columns: ${payload.height > payload.width ? "1fr" : "minmax(0, 1fr) 380px"};
    }
    .scene-body {
      min-width: 0;
      max-width: ${payload.height > payload.width ? "820px" : "880px"};
    }
    .scene-item .scene-layout {
      margin-top: ${payload.height > payload.width ? "168px" : "220px"};
      gap: ${payload.height > payload.width ? "24px" : "56px"};
    }
    .scene-item .product-panel {
      order: ${payload.height > payload.width ? "-1" : "0"};
    }
    .scene-cover .scene-layout {
      margin-top: ${payload.height > payload.width ? "156px" : "150px"};
      gap: ${payload.height > payload.width ? "24px" : "56px"};
    }
    .scene-cover .signal-board {
      height: ${payload.height > payload.width ? "230px" : "360px"};
    }
    .scene-cover h1 {
      font-size: ${payload.height > payload.width ? "48px" : "66px"};
      line-height: 1.08;
      word-break: keep-all;
      overflow-wrap: break-word;
    }
    .scene-cover .screen-lines p {
      font-size: ${payload.height > payload.width ? "24px" : "28px"};
      line-height: 1.38;
    }
    .scene-cover .subtitle-safe {
      display: none;
    }
    .kicker {
      color: var(--accent);
      font-size: 18px;
      text-transform: uppercase;
      margin: 0 0 24px;
    }
    h1 {
      font-size: ${payload.height > payload.width ? "56px" : "66px"};
      line-height: 1.05;
      margin: 0;
      max-width: 880px;
      letter-spacing: 0;
    }
    .screen-lines {
      display: grid;
      gap: 14px;
      margin-top: 28px;
      max-width: 860px;
    }
    .screen-lines p {
      margin: 0;
      color: #D8E4F8;
      font-size: ${payload.height > payload.width ? "34px" : "28px"};
      line-height: 1.48;
    }
    .scene-item .screen-lines p {
      font-size: ${payload.height > payload.width ? "21px" : "28px"};
      line-height: 1.38;
      white-space: ${payload.height > payload.width ? "nowrap" : "normal"};
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .scene-item .screen-lines {
      max-height: ${payload.height > payload.width ? "34px" : "none"};
      overflow: hidden;
    }
    .scene-item .highlight-list {
      grid-template-columns: ${payload.height > payload.width ? "1fr 1fr" : "repeat(2, minmax(0, 1fr))"};
      margin-top: ${payload.height > payload.width ? "16px" : "26px"};
    }
    .scene-item .highlight-list span {
      padding: ${payload.height > payload.width ? "10px 12px" : "14px 16px"};
      font-size: ${payload.height > payload.width ? "16px" : "17px"};
    }
    .scene-item .data-bar {
      margin-top: ${payload.height > payload.width ? "20px" : "44px"};
    }
    .scene-item .meta-row {
      margin-top: ${payload.height > payload.width ? "14px" : "28px"};
    }
    .highlight-list {
      display: grid;
      grid-template-columns: ${payload.height > payload.width ? "1fr 1fr" : "repeat(2, minmax(0, 1fr))"};
      gap: 12px;
      margin-top: 26px;
      max-width: 820px;
    }
    .highlight-list span {
      padding: 14px 16px;
      border-left: 3px solid var(--accent);
      background: rgba(15, 23, 42, 0.62);
      color: #E6F6FF;
      font-size: ${payload.height > payload.width ? "22px" : "17px"};
      line-height: 1.26;
    }
    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 28px;
    }
    .meta-row span {
      padding: 8px 12px;
      border: 1px solid rgba(103, 232, 249, 0.24);
      background: rgba(103, 232, 249, 0.08);
      color: #B8F4FF;
      font-size: ${payload.height > payload.width ? "18px" : "15px"};
      text-transform: uppercase;
    }
    .data-bar {
      width: min(720px, 70%);
      height: 10px;
      margin-top: 44px;
      border: 1px solid rgba(103, 232, 249, 0.26);
      background: rgba(103, 232, 249, 0.08);
    }
    .data-bar span {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, var(--accent), var(--secondary));
      box-shadow: 0 0 26px rgba(103, 232, 249, 0.42);
      animation: grow 1.2s ease-out both;
    }
    .product-panel {
      position: relative;
      width: ${payload.height > payload.width ? "100%" : "420px"};
      height: ${payload.height > payload.width ? "360px" : "520px"};
      border: 1px solid rgba(103, 232, 249, 0.22);
      background:
        linear-gradient(145deg, rgba(8, 13, 24, 0.92), rgba(15, 23, 42, 0.74)),
        linear-gradient(rgba(103, 232, 249, 0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(103, 232, 249, 0.05) 1px, transparent 1px);
      background-size: auto, 28px 28px, 28px 28px;
      overflow: hidden;
      box-shadow: 0 28px 80px rgba(0, 0, 0, 0.34), inset 0 0 48px rgba(103, 232, 249, 0.08);
      clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 22px 100%, 0 calc(100% - 22px));
    }
    .scene-item .product-panel {
      height: ${payload.height > payload.width ? "248px" : "520px"};
    }
    .product-panel img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: saturate(1.08) contrast(1.04);
      transform: scale(1.03);
    }
    .fallback-panel {
      display: grid;
      place-items: center;
    }
    .product-mark {
      width: 190px;
      height: 190px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(103, 232, 249, 0.36);
      background: linear-gradient(135deg, rgba(103, 232, 249, 0.18), rgba(139, 92, 246, 0.16));
      color: #EAFBFF;
      font-size: 72px;
      font-weight: 800;
      box-shadow: 0 0 44px rgba(103, 232, 249, 0.22);
    }
    .product-caption {
      position: absolute;
      left: 24px;
      right: 24px;
      bottom: 24px;
      padding: 16px 18px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(3, 7, 18, 0.76);
      backdrop-filter: blur(12px);
    }
    .product-caption span {
      display: block;
      color: var(--accent);
      font-size: 14px;
      margin-bottom: 8px;
    }
    .product-caption strong {
      display: block;
      color: #F8FAFC;
      font-size: ${payload.height > payload.width ? "26px" : "22px"};
      line-height: 1.2;
    }
    .product-caption em {
      display: block;
      margin-top: 8px;
      color: #67e8f9;
      font-style: normal;
      font-size: 15px;
      line-height: 1.25;
    }
    .signal-board {
      position: relative;
      width: ${payload.height > payload.width ? "100%" : "420px"};
      height: ${payload.height > payload.width ? "310px" : "520px"};
      display: grid;
      grid-template-columns: ${payload.height > payload.width ? "repeat(auto-fit, minmax(118px, 1fr))" : "1fr"};
      gap: ${payload.height > payload.width ? "10px" : "14px"};
      padding: ${payload.height > payload.width ? "24px" : "28px"};
      border: 1px solid rgba(103, 232, 249, 0.22);
      background: linear-gradient(145deg, rgba(8, 13, 24, 0.92), rgba(15, 23, 42, 0.74));
      overflow: hidden;
      box-shadow: 0 28px 80px rgba(0, 0, 0, 0.34), inset 0 0 48px rgba(103, 232, 249, 0.08);
      clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 22px 100%, 0 calc(100% - 22px));
    }
    .signal-card {
      min-width: 0;
      display: grid;
      grid-template-columns: ${payload.height > payload.width ? "1fr" : "68px minmax(0, 1fr)"};
      align-items: center;
      gap: 12px;
      padding: ${payload.height > payload.width ? "8px" : "12px"};
      border: 1px solid rgba(148, 163, 184, 0.14);
      background: rgba(2, 6, 23, 0.42);
    }
    .signal-thumb {
      width: ${payload.height > payload.width ? "100%" : "68px"};
      aspect-ratio: 1;
      display: grid;
      place-items: center;
      overflow: hidden;
      border: 1px solid rgba(103, 232, 249, 0.2);
      background: linear-gradient(135deg, rgba(103, 232, 249, 0.16), rgba(139, 92, 246, 0.16));
      color: #EAFBFF;
      font-size: ${payload.height > payload.width ? "18px" : "22px"};
      font-weight: 800;
    }
    .signal-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .signal-card strong {
      display: block;
      color: #F8FAFC;
      font-size: ${payload.height > payload.width ? "12px" : "18px"};
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .signal-card span {
      display: block;
      margin-top: 6px;
      color: var(--accent);
      font-size: ${payload.height > payload.width ? "10px" : "13px"};
    }
    .motion-push-in .product-panel { animation: panelPush 1.8s ease-out both; }
    .motion-push-in .signal-board { animation: panelPush 1.8s ease-out both; }
    .motion-drift-left .product-panel { animation: driftLeft 2s ease-out both; }
    .motion-drift-left .signal-board { animation: driftLeft 2s ease-out both; }
    .motion-drift-right .product-panel { animation: driftRight 2s ease-out both; }
    .motion-drift-right .signal-board { animation: driftRight 2s ease-out both; }
    .motion-reveal-up .scene-body { animation: revealUp 1.2s ease-out both; }
    .motion-scanline .product-panel::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, transparent, rgba(103, 232, 249, 0.18), transparent);
      transform: translateY(-100%);
      animation: scan 2.4s ease-in-out both;
    }
    .motion-scanline .signal-board::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, transparent, rgba(103, 232, 249, 0.18), transparent);
      transform: translateY(-100%);
      animation: scan 2.4s ease-in-out both;
    }
    .subtitle-safe {
      position: absolute;
      z-index: 2;
      left: ${payload.height > payload.width ? "90px" : "160px"};
      right: ${payload.height > payload.width ? "90px" : "160px"};
      bottom: ${payload.height > payload.width ? "38px" : "64px"};
      padding: ${payload.height > payload.width ? "12px 16px" : "18px 24px"};
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(0,0,0,0.38);
      color: #F8FAFC;
      font-size: ${payload.height > payload.width ? "20px" : "22px"};
      line-height: 1.36;
      max-height: ${payload.height > payload.width ? "72px" : "none"};
      overflow: hidden;
    }
    @keyframes scene {
      0%, 92% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-12px); }
    }
    @keyframes grow {
      from { transform: scaleX(0.2); transform-origin: left; }
      to { transform: scaleX(1); transform-origin: left; }
    }
    @keyframes panelPush {
      from { transform: scale(0.96); opacity: 0.78; }
      to { transform: scale(1); opacity: 1; }
    }
    @keyframes driftLeft {
      from { transform: translateX(18px); opacity: 0.82; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes driftRight {
      from { transform: translateX(-18px); opacity: 0.82; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes revealUp {
      from { transform: translateY(18px); opacity: 0.78; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes scan {
      0% { transform: translateY(-100%); }
      70% { transform: translateY(100%); }
      100% { transform: translateY(100%); }
    }
  </style>
</head>
<body>
  <main class="composition">
    ${sceneMarkup}
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      default:
        return "&#039;";
    }
  });
}

function renderSignalBoard(items: TrendItem[], fallbackTitle: string): string {
  const boardItems = items.length
    ? items
    : [{ id: "fallback", source: "trendforge", title: fallbackTitle, rank: 1, raw: {} }];
  return `<div class="signal-board">
    ${boardItems.slice(0, 5).map((item, index) => `<div class="signal-card">
      <div class="signal-thumb">${item.thumbnail ? `<img src="${escapeAttr(item.thumbnail)}" alt="${escapeAttr(item.title)}" crossorigin="anonymous" />` : escapeHtml(initials(item.title))}</div>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <span>#${item.rank ?? index + 1}${item.score ? ` / ${item.score} upvotes` : ""}</span>
      </div>
    </div>`).join("")}
  </div>`;
}

function uniqueItems(items: TrendItem[]): TrendItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.id || item.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "TF";
}

function splitDisplayText(value: string, maxLines: number): string[] {
  const maxChars = maxLines * 34;
  const normalized = truncateText(value.replace(/\s+/g, " ").trim(), maxChars);
  if (normalized.length <= 34) return [normalized];
  const limit = Math.max(28, Math.ceil(normalized.length / maxLines));
  const lines: string[] = [];
  let cursor = normalized;
  while (cursor.length && lines.length < maxLines) {
    if (cursor.length <= limit) {
      lines.push(cursor);
      break;
    }
    const cut = findCutPoint(cursor, limit);
    lines.push(cursor.slice(0, cut).trim());
    cursor = cursor.slice(cut).trim();
  }
  if (cursor && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1]} ${cursor}`.trim();
  return lines;
}

function truncateText(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, Math.max(1, max - 1))}…` : value;
}

function findCutPoint(value: string, limit: number): number {
  const punctuation = ["，", "。", "；", ",", ".", ";", " "];
  for (let offset = 0; offset < 12; offset++) {
    const index = limit - offset;
    const char = value[index];
    if (index > 10 && char && punctuation.includes(char)) return index + 1;
  }
  return limit;
}

function readMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function readChoice(value: unknown, choices: string[], fallback: string): string {
  const next = typeof value === "string" ? value : "";
  return choices.includes(next) ? next : fallback;
}

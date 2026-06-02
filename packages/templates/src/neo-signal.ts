import type { RenderPayload, TemplateDefinition } from "@trendforge/core";

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
  const sceneMarkup = scenes
    .map((scene, index) => {
      const rank = scene.items?.[0]?.rank ?? index;
      const metric = scene.items?.[0]?.score ?? (index + 1) * 17;
      return `<section class="scene scene-${scene.type}" style="--i:${index}">
        <div class="hud-top">
          <span>TRENDFORGE / ${payload.composition}</span>
          <span>${String(scene.type).toUpperCase()}</span>
        </div>
        <div class="rank">${scene.type === "item" ? String(rank).padStart(2, "0") : "TF"}</div>
        <div class="scene-body">
          <p class="kicker">${scene.visualHint ?? "LOCAL AI VIDEO WORKSTATION"}</p>
          <h1>${escapeHtml(scene.title)}</h1>
          <p class="screen">${escapeHtml(scene.screenText)}</p>
          <div class="data-bar"><span style="width:${Math.min(96, Math.max(24, metric))}%"></span></div>
        </div>
        <div class="subtitle-safe">${escapeHtml(scene.voiceText)}</div>
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
    .scene-body {
      position: relative;
      z-index: 2;
      max-width: ${payload.height > payload.width ? "820px" : "1120px"};
      margin-top: ${payload.height > payload.width ? "330px" : "220px"};
    }
    .kicker {
      color: var(--accent);
      font-size: 18px;
      text-transform: uppercase;
      margin: 0 0 24px;
    }
    h1 {
      font-size: ${payload.height > payload.width ? "76px" : "66px"};
      line-height: 1.05;
      margin: 0;
      max-width: 880px;
      letter-spacing: 0;
    }
    .screen {
      margin: 28px 0 0;
      max-width: 860px;
      color: #D8E4F8;
      font-size: ${payload.height > payload.width ? "34px" : "28px"};
      line-height: 1.48;
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
    .subtitle-safe {
      position: absolute;
      z-index: 2;
      left: ${payload.height > payload.width ? "90px" : "160px"};
      right: ${payload.height > payload.width ? "90px" : "160px"};
      bottom: ${payload.height > payload.width ? "98px" : "64px"};
      padding: 18px 24px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(0,0,0,0.38);
      color: #F8FAFC;
      font-size: ${payload.height > payload.width ? "28px" : "22px"};
      line-height: 1.42;
    }
    @keyframes scene {
      0%, 100% { opacity: 0; transform: translateY(16px); }
      4%, 92% { opacity: 1; transform: translateY(0); }
    }
    @keyframes grow {
      from { transform: scaleX(0.2); transform-origin: left; }
      to { transform: scaleX(1); transform-origin: left; }
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

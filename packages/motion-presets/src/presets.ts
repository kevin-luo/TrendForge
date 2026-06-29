import type { MotionLayer, VisualSceneSpec, VisualType } from "@trendforge/motion-core";
import { motionSizeForRatio } from "@trendforge/motion-core";

export type MotionPreset = {
  visualType: VisualType;
  label: string;
  build(spec: VisualSceneSpec, fps: number): MotionLayer[];
};

export const motionPresets: MotionPreset[] = [
  { visualType: "rank-race", label: "Rank Race", build: rankRaceLayers },
  { visualType: "product-workspace", label: "Product Workspace", build: productWorkspaceLayers },
  { visualType: "news-evidence-wall", label: "News Evidence Wall", build: newsEvidenceLayers },
  { visualType: "data-pulse", label: "Data Pulse", build: dataPulseLayers },
  { visualType: "timeline-rail", label: "Timeline Rail", build: timelineRailLayers },
  { visualType: "workflow-orbit", label: "Workflow Orbit", build: workflowOrbitLayers },
  { visualType: "creator-desk", label: "Creator Desk", build: creatorDeskLayers },
  { visualType: "split-compare", label: "Split Compare", build: splitCompareLayers },
  { visualType: "whiteboard-explain", label: "Whiteboard Explain", build: whiteboardExplainLayers }
];

export function presetFor(type: VisualType): MotionPreset {
  return motionPresets.find((preset) => preset.visualType === type) ?? motionPresets[0]!;
}

function rankRaceLayers(spec: VisualSceneSpec, fps: number): MotionLayer[] {
  if (isPaperSpec(spec)) return rankRacePosterLayers(spec, fps);
  const { width, height } = motionSizeForRatio(spec.ratio);
  // Leaderboard rows prioritize entities such as product names and ranked items.
  const lanes = normalizeLabels([...(spec.contentSlots.entities ?? []), ...(spec.contentSlots.chips ?? [])], 5);
  const action = spec.safeAreas.action;
  const rowGap = Math.round(action.height * 0.035);
  const rowH = Math.round((action.height - rowGap * 4) / 5);
  return [
    textLayer("rank-title", spec.contentSlots.headline ?? "TOP SIGNAL", spec.safeAreas.title, 58, 950),
    groupLayer("rank-lanes", action, lanes.map((label, index) => {
      const y = action.y + index * (rowH + rowGap);
      const barWidth = Math.round(action.width * (0.34 + index * 0.08));
      return {
        id: `rank-lane-${index}`,
        kind: "group",
        frame: { x: action.x, y, width: action.width, height: rowH },
        children: [
          shapeLayer(`rank-row-${index}`, { x: action.x, y, width: action.width, height: rowH }, index, "panel"),
          shapeLayer(`rank-badge-${index}`, { x: action.x + 24, y: y + 22, width: 74, height: 74 }, index),
          textLayer(`rank-num-${index}`, `#${index + 1}`, { x: action.x + 39, y: y + 26, width: 54, height: 44 }, 24, 950),
          textLayer(`rank-label-${index}`, label, { x: action.x + 122, y: y + 24, width: action.width - 164, height: 54 }, 30, 900),
          shapeLayer(`rank-bar-${index}`, { x: action.x + 122, y: y + rowH - 34, width: barWidth, height: 14 }, index, "bar")
        ],
        keyframes: enterKeyframes(index * 4, fps)
      } satisfies MotionLayer;
    })),
    shapeLayer("rank-scan", { x: 0, y: Math.round(height * 0.08), width, height: Math.round(spec.safeAreas.subtitle.y * 0.96 - height * 0.08) }, 2, "scan")
  ];
}

function rankRacePosterLayers(spec: VisualSceneSpec, fps: number): MotionLayer[] {
  const { width, height } = motionSizeForRatio(spec.ratio);
  const accentOffset = spec.design?.accentIndex ?? 0;
  const typeScale = spec.design?.typographyScale ?? 1;
  const rotation = spec.design?.rotation ?? 0;
  const maxCards = spec.design?.decor === "minimal" ? 3 : 5;
  const lanes = posterLabels([...(spec.contentSlots.entities ?? []), ...(spec.contentSlots.chips ?? [])], maxCards);
  const left = Math.round(width * 0.065);
  const top = Math.round(height * 0.064);
  const maxW = Math.round(width * 0.87);
  const titleW = Math.round(maxW * 0.72);
  const cardTop = Math.round(height * 0.4);
  const featureH = Math.round(height * 0.15);
  const smallTop = cardTop + featureH + Math.round(height * 0.028);
  const smallGap = Math.round(width * 0.035);
  const smallW = Math.round((maxW - smallGap) / 2);
  const smallH = Math.round(height * 0.095);
  const title = spec.contentSlots.headline ?? "AI 产品信号";
  return [
    withKeyframes(shapeLayer("poster-yellow-strip", { x: left + Math.round(maxW * 0.68), y: top + 12, width: Math.round(maxW * 0.24), height: 72 }, 0, "sticker"), holdRotate(0, fps, 3 + rotation * 0.2)),
    textLayer("poster-kicker", `${spec.contentSlots.sourceLabel ?? "TREND FORGE"} / PRODUCT SIGNAL`, { x: left, y: top, width: maxW * 0.7, height: 38 }, 21, 850, { fill: "#F05A28" }),
    textLayer("poster-title", title, { x: left, y: top + 70, width: titleW, height: Math.round(height * 0.2) }, Math.round(64 * typeScale), 950),
    textLayer("poster-note", "LOCAL-FIRST VIDEO BRIEF", { x: left, y: top + Math.round(height * 0.25), width: maxW * 0.6, height: 36 }, 22, 800, { fill: "#6C6454" }),
    withKeyframes(groupLayer("poster-feature-card", { x: left, y: cardTop, width: maxW, height: featureH }, [
      shapeLayer("poster-feature-bg", { x: left, y: cardTop, width: maxW, height: featureH }, accentOffset, "paper"),
      shapeLayer("poster-feature-rank", { x: left + 34, y: cardTop + 34, width: 106, height: 106 }, 0, "sticker"),
      textLayer("poster-feature-num", "#1", { x: left + 54, y: cardTop + 50, width: 86, height: 70 }, 38, 950),
      textLayer("poster-feature-name", lanes[0] ?? "Product", { x: left + 168, y: cardTop + 34, width: maxW - 212, height: 76 }, Math.round(48 * typeScale), 950),
      textLayer("poster-feature-copy", "最值得先看的产品信号", { x: left + 172, y: cardTop + 114, width: maxW - 220, height: 36 }, 22, 850, { fill: "#6C6454" }),
      shapeLayer("poster-feature-line", { x: left + 172, y: cardTop + featureH - 34, width: Math.round(maxW * 0.58), height: 12 }, accentOffset + 1, "bar")
    ]), enterKeyframes(0, fps)),
    ...lanes.slice(1, 5).map((label, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = left + col * (smallW + smallGap);
      const y = smallTop + row * (smallH + Math.round(height * 0.03));
      return withKeyframes(groupLayer(`poster-small-card-${index}`, { x, y, width: smallW, height: smallH }, [
        shapeLayer(`poster-small-bg-${index}`, { x, y, width: smallW, height: smallH }, accentOffset + index + 1, "paper"),
        shapeLayer(`poster-small-label-${index}`, { x: x + 24, y: y + 20, width: 68, height: 40 }, accentOffset + index + 1, "label"),
        textLayer(`poster-small-num-${index}`, `#${index + 2}`, { x: x + 36, y: y + 26, width: 52, height: 32 }, 20, 950),
        textLayer(`poster-small-name-${index}`, label, { x: x + 30, y: y + 76, width: smallW - 60, height: 50 }, Math.round(27 * typeScale), 950),
        shapeLayer(`poster-small-rule-${index}`, { x: x + 30, y: y + smallH - 28, width: smallW - 60, height: 7 }, accentOffset + index + 2, "bar")
      ]), holdRotate(index * 3, fps, (index % 2 === 0 ? -1.3 : 1.3) + rotation * 0.15));
    }),
    shapeLayer("poster-subtitle-guard", { x: left, y: spec.safeAreas.subtitle.y - 30, width: maxW, height: 4 }, accentOffset + 3, "bar")
  ];
}

function productWorkspaceLayers(spec: VisualSceneSpec, fps: number): MotionLayer[] {
  if (isPaperSpec(spec)) return productWorkspacePosterLayers(spec, fps);
  const productName = spec.contentSlots.product?.name ?? spec.contentSlots.headline ?? "Product";
  const action = spec.safeAreas.action;
  const product = spec.contentSlots.product;
  const headline = product?.oneLineZh || product?.tagline || spec.contentSlots.headline || productName;
  const highlights = normalizeLabels(
    product?.highlightsZh?.length ? product.highlightsZh : spec.contentSlots.chips ?? [],
    3,
    28
  );
  const metrics = spec.contentSlots.metrics ?? [];
  const topBar = { x: action.x + 28, y: action.y + 26, width: action.width - 56, height: 58 };
  const hero = { x: action.x + 34, y: action.y + 96, width: action.width - 68, height: Math.round(action.height * 0.3) };
  const listY = hero.y + hero.height + 34;
  const metricY = action.y + action.height - 126;
  return [
    textLayer("product-title", productName, spec.safeAreas.title, 70, 950),
    withKeyframes(groupLayer("workspace-window", action, [
      shapeLayer("window-frame", action, 0, "panel"),
      shapeLayer("window-topbar", topBar, 1, "rail"),
      ...[0, 1, 2].map((dot) =>
        shapeLayer(`window-dot-${dot}`, { x: topBar.x + 22 + dot * 28, y: topBar.y + 20, width: 16, height: 16 }, dot)
      ),
      shapeLayer("window-hero-card", hero, 2, "panel"),
      textLayer("product-hero", headline, { x: hero.x + 28, y: hero.y + 26, width: hero.width - 56, height: hero.height - 52 }, 30, 900),
      ...highlights.map((label, index) =>
        withKeyframes(groupLayer(`product-row-${index}`, { x: action.x + 42, y: listY + index * 76, width: action.width - 84, height: 56 }, [
          shapeLayer(`product-row-bg-${index}`, { x: action.x + 42, y: listY + index * 76, width: action.width - 84, height: 56 }, index, "panel"),
          shapeLayer(`product-row-mark-${index}`, { x: action.x + 62, y: listY + 18 + index * 76, width: 20, height: 20 }, index),
          textLayer(`product-row-text-${index}`, label, { x: action.x + 98, y: listY + 8 + index * 76, width: action.width - 146, height: 38 }, 22, 850)
        ]), enterKeyframes(index * 4, fps))
      ),
      ...metrics.slice(0, 3).map((metric, index) =>
        withKeyframes(groupLayer(`product-metric-${index}`, {
          x: action.x + 42 + index * Math.round((action.width - 84) / 3),
          y: metricY,
          width: Math.round((action.width - 116) / 3),
          height: 88
        }, [
          shapeLayer(`product-metric-bg-${index}`, {
            x: action.x + 42 + index * Math.round((action.width - 84) / 3),
            y: metricY,
            width: Math.round((action.width - 116) / 3),
            height: 88
          }, index, "panel"),
          textLayer(`product-metric-label-${index}`, metric.label, {
            x: action.x + 62 + index * Math.round((action.width - 84) / 3),
            y: metricY + 12,
            width: Math.round((action.width - 156) / 3),
            height: 24
          }, 17, 760),
          textLayer(`product-metric-value-${index}`, metric.value, {
            x: action.x + 62 + index * Math.round((action.width - 84) / 3),
            y: metricY + 38,
            width: Math.round((action.width - 156) / 3),
            height: 34
          }, 24, 950)
        ]), enterKeyframes(8 + index * 3, fps))
      ),
      shapeLayer("cursor", { x: action.x + Math.round(action.width * 0.55), y: action.y + Math.round(action.height * 0.46), width: 34, height: 34 }, 3, "cursor")
    ]), enterKeyframes(0, fps))
  ];
}

function productWorkspacePosterLayers(spec: VisualSceneSpec, fps: number): MotionLayer[] {
  const { width, height } = motionSizeForRatio(spec.ratio);
  const accentOffset = spec.design?.accentIndex ?? 0;
  const typeScale = spec.design?.typographyScale ?? 1;
  const rotation = spec.design?.rotation ?? 0;
  const productName = spec.contentSlots.product?.name ?? spec.contentSlots.headline ?? "Product";
  const product = spec.contentSlots.product;
  const headline = short(product?.oneLineZh || product?.tagline || spec.contentSlots.headline || productName, 36);
  const highlights = normalizeLabels(product?.highlightsZh?.length ? product.highlightsZh : spec.contentSlots.chips ?? [], 3, 26);
  const metrics = spec.contentSlots.metrics ?? [];
  const left = Math.round(width * 0.065);
  const top = Math.round(height * 0.06);
  const maxW = Math.round(width * 0.87);
  const heroY = Math.round(height * 0.28);
  const heroH = Math.round(height * 0.34);
  const rowY = heroY + heroH + Math.round(height * 0.04);
  const metricW = Math.round((maxW - 34) / 3);
  return [
    textLayer("product-kicker", `PRODUCT FILE / #${product?.rank ?? 1}`, { x: left, y: top, width: maxW, height: 36 }, 21, 850, { fill: "#F05A28" }),
    textLayer("product-title", productName, { x: left, y: top + 62, width: maxW, height: Math.round(height * 0.13) }, Math.round(74 * typeScale), 950, { fontFamily: "serif" }),
    withKeyframes(shapeLayer("product-corner-sticker", { x: left + Math.round(maxW * 0.65), y: top + 70, width: Math.round(maxW * 0.24), height: 72 }, accentOffset + 2, "sticker"), holdRotate(0, fps, -4 + rotation * 0.2)),
        withKeyframes(groupLayer("product-paper-window", { x: left, y: heroY, width: maxW, height: heroH }, [
      shapeLayer("product-paper-bg", { x: left, y: heroY, width: maxW, height: heroH }, accentOffset, "paper"),
      shapeLayer("product-paper-sidebar", { x: left + 34, y: heroY + 34, width: 112, height: heroH - 68 }, accentOffset + 3, "label"),
      textLayer("product-paper-headline", headline, { x: left + 180, y: heroY + 48, width: maxW - 230, height: 110 }, Math.round(32 * typeScale), 950),
      ...highlights.map((label, index) =>
        textLayer(`product-paper-highlight-${index}`, label, { x: left + 184, y: heroY + 166 + index * 56, width: maxW - 238, height: 38 }, 24, 850)
      ),
      shapeLayer("product-paper-path", { x: left + 182, y: heroY + heroH - 64, width: Math.round(maxW * 0.56), height: 14 }, accentOffset + 1, "bar"),
      shapeLayer("product-paper-cursor", { x: left + Math.round(maxW * 0.71), y: heroY + Math.round(heroH * 0.56), width: 42, height: 42 }, accentOffset + 4, "cursor")
    ]), enterKeyframes(0, fps)),
    ...metrics.slice(0, 3).map((metric, index) => {
      const x = left + index * (metricW + 17);
      return withKeyframes(groupLayer(`product-paper-metric-${index}`, { x, y: rowY, width: metricW, height: 128 }, [
        shapeLayer(`product-paper-metric-bg-${index}`, { x, y: rowY, width: metricW, height: 128 }, accentOffset + index + 1, "paper"),
        textLayer(`product-paper-metric-label-${index}`, metric.label, { x: x + 24, y: rowY + 18, width: metricW - 48, height: 28 }, 18, 800, { fill: "#6C6454" }),
        textLayer(`product-paper-metric-value-${index}`, metric.value, { x: x + 24, y: rowY + 54, width: metricW - 48, height: 56 }, 34, 950)
      ]), holdRotate(8 + index * 4, fps, (index === 1 ? 1.2 : -1.2) + rotation * 0.12));
    }),
    ...(() => { const p = spec.contentSlots.product; if (!p?.name) return []; const cw = Math.round(maxW * 0.32); const ch = Math.round(height * 0.22); return [withKeyframes(groupLayer("product-hero-card", { x: left, y: Math.round(height * 0.13), width: cw, height: ch }, productCardLayers(spec, { x: left, y: Math.round(height * 0.13), width: cw, height: ch }, "pc")), enterKeyframes(2, fps))]; })(),
    shapeLayer("product-subtitle-guard", { x: left, y: spec.safeAreas.subtitle.y - 26, width: maxW, height: 4 }, accentOffset + 2, "bar")
  ];
}

function newsEvidenceLayers(spec: VisualSceneSpec, fps: number): MotionLayer[] {
  const labels = normalizeLabels(spec.contentSlots.chips ?? spec.contentSlots.entities ?? [], 4);
  const action = spec.safeAreas.action;
  const cardW = Math.round(action.width * 0.42);
  const cardH = Math.round(action.height * 0.32);
  return [
    textLayer("news-title", spec.contentSlots.headline ?? "SIGNAL DESK", spec.safeAreas.title, 64, 950),
    groupLayer("evidence-wall", action, labels.map((label, index) => {
      const cardX = action.x + (index % 2) * Math.round(action.width * 0.45);
      const cardY = action.y + Math.floor(index / 2) * Math.round(action.height * 0.38);
      return withKeyframes(groupLayer(`evidence-${index}`, { x: cardX, y: cardY, width: cardW, height: cardH }, [
        shapeLayer(`evidence-card-${index}`, { x: cardX, y: cardY, width: cardW, height: cardH }, index, "panel"),
        textLayer(`evidence-text-${index}`, label, { x: cardX + 22, y: cardY + 22, width: cardW - 44, height: 70 }, 24, 840)
      ]), enterKeyframes(index * 5, fps));
    }))
  ];
}

function dataPulseLayers(spec: VisualSceneSpec, fps: number): MotionLayer[] {
  if (isPaperSpec(spec)) return dataPulsePosterLayers(spec, fps);
  const action = spec.safeAreas.action;
  const metrics = spec.contentSlots.metrics?.length ? spec.contentSlots.metrics : normalizeLabels(spec.contentSlots.chips ?? [], 3).map((label, index) => ({ label, value: `${72 + index * 9}%` }));
  return [
    textLayer("data-title", spec.contentSlots.headline ?? "DATA PULSE", spec.safeAreas.title, 64, 950),
    ...Array.from({ length: 18 }, (_, index) => {
      const barHeight = Math.round(action.height * (0.18 + ((index * 7) % 11) / 18));
      return withKeyframes(shapeLayer(`pulse-bar-${index}`, {
        x: action.x + Math.round(index * (action.width / 20)),
        y: action.y + action.height - barHeight,
        width: Math.round(action.width / 34),
        height: barHeight
      }, index % 3, "bar"), pulseKeyframes(index * 2, fps));
    }),
    ...metrics.slice(0, 3).map((metric, index) =>
      textLayer(`metric-${index}`, `${metric.label} ${metric.value}`, { x: action.x + index * Math.round(action.width / 3), y: action.y + 24, width: Math.round(action.width / 3) - 24, height: 54 }, 24, 850)
    )
  ];
}

function dataPulsePosterLayers(spec: VisualSceneSpec, fps: number): MotionLayer[] {
  const { width, height } = motionSizeForRatio(spec.ratio);
  const accentOffset = spec.design?.accentIndex ?? 0;
  const typeScale = spec.design?.typographyScale ?? 1;
  const rotation = spec.design?.rotation ?? 0;
  const left = Math.round(width * 0.065);
  const top = Math.round(height * 0.064);
  const maxW = Math.round(width * 0.87);
  const product = spec.contentSlots.product;
  const rows = signalRows(spec);
  const metrics = signalMetrics(spec, rows);
  const board = { x: left, y: Math.round(height * 0.36), width: maxW, height: Math.round(height * 0.35) };
  const rowH = Math.round((board.height - 100) / 4);
  const stripY = Math.min(board.y + board.height + Math.round(height * 0.035), spec.safeAreas.subtitle.y - 150);
  const title = product ? `${product.name} 热度拆解` : (spec.contentSlots.headline ?? "热度看板");
  const insight = short(product?.whyInterestingZh || "按可讲性、收藏点和传播动作排序，镜头里展示真实判断。", 38);
  return [
    textLayer("data-poster-kicker", "OPEN DESIGN / HEAT BOARD", { x: left, y: top, width: Math.round(maxW * 0.65), height: 34 }, 20, 850, { fill: "#F05A28" }),
    textLayer("data-poster-title", title, { x: left, y: top + 58, width: Math.round(maxW * 0.68), height: Math.round(height * 0.15) }, Math.round(58 * typeScale), 950),
    withKeyframes(shapeLayer("data-corner-sticker", { x: left + Math.round(maxW * 0.72), y: top + 42, width: Math.round(maxW * 0.2), height: 76 }, 0, "sticker"), holdRotate(0, fps, 4 + rotation * 0.15)),
    ...metrics.slice(0, 3).map((metric, index) => {
      const cardW = Math.round((maxW - 34) / 3);
      const x = left + index * (cardW + 17);
      const y = Math.round(height * 0.245);
      return withKeyframes(groupLayer(`data-poster-metric-${index}`, { x, y, width: cardW, height: 116 }, [
        shapeLayer(`data-poster-metric-bg-${index}`, { x, y, width: cardW, height: 116 }, accentOffset + index, "paper"),
        textLayer(`data-poster-metric-label-${index}`, short(metric.label, 10), { x: x + 20, y: y + 18, width: cardW - 40, height: 26 }, 18, 800, { fill: "#6C6454" }),
        textLayer(`data-poster-metric-value-${index}`, short(metric.value, 8), { x: x + 20, y: y + 48, width: cardW - 40, height: 48 }, 32, 950)
      ]), holdRotate(index * 4, fps, index === 1 ? 1.2 : -1.2));
    }),
    withKeyframes(groupLayer("data-poster-board", board, [
      shapeLayer("data-poster-board-bg", board, accentOffset, "paper"),
      textLayer("data-poster-board-label", product ? "内容卖点优先级" : "本期内容热度排序", { x: board.x + 34, y: board.y + 24, width: board.width - 68, height: 36 }, 24, 950, { fill: "#6C6454" }),
      ...rows.slice(0, 4).map((row, index) => {
        const y = board.y + 72 + index * rowH;
        const barW = Math.round((board.width - 330) * (row.score / 100));
        return withKeyframes(groupLayer(`data-row-${index}`, { x: board.x + 28, y, width: board.width - 56, height: rowH - 14 }, [
          shapeLayer(`data-row-bg-${index}`, { x: board.x + 28, y, width: board.width - 56, height: rowH - 14 }, index, "panel"),
          shapeLayer(`data-row-score-bg-${index}`, { x: board.x + board.width - 142, y: y + 18, width: 86, height: 52 }, 0, "sticker"),
          textLayer(`data-row-score-${index}`, `${row.score}`, { x: board.x + board.width - 120, y: y + 26, width: 56, height: 34 }, 25, 950),
          textLayer(`data-row-label-${index}`, row.label, { x: board.x + 58, y: y + 18, width: board.width - 260, height: 36 }, 27, 950),
          textLayer(`data-row-detail-${index}`, row.detail, { x: board.x + 58, y: y + 58, width: board.width - 260, height: 28 }, 18, 800, { fill: "#6C6454" }),
          shapeLayer(`data-row-bar-${index}`, { x: board.x + 58, y: y + rowH - 24, width: barW, height: 8 }, index + 1, "bar")
        ]), enterKeyframes(index * 4, fps));
      })
    ]), enterKeyframes(0, fps)),
    withKeyframes(groupLayer("data-poster-verdict", { x: left, y: stripY, width: maxW, height: 106 }, [
      shapeLayer("data-poster-verdict-bg", { x: left, y: stripY, width: maxW, height: 106 }, 0, "sticker"),
      textLayer("data-poster-verdict-copy", insight, { x: left + 34, y: stripY + 26, width: maxW - 68, height: 52 }, 27, 950)
    ]), enterKeyframes(10, fps)),
    shapeLayer("data-subtitle-guard", { x: left, y: spec.safeAreas.subtitle.y - 28, width: maxW, height: 4 }, accentOffset + 1, "bar")
  ];
}

function timelineRailLayers(spec: VisualSceneSpec, fps: number): MotionLayer[] {
  if (isPaperSpec(spec)) return timelineRailPosterLayers(spec, fps);
  const labels = normalizeLabels(spec.contentSlots.chips ?? spec.contentSlots.entities ?? [], 4);
  const action = spec.safeAreas.action;
  return [
    textLayer("timeline-title", spec.contentSlots.headline ?? "TIMELINE", spec.safeAreas.title, 64, 950),
    shapeLayer("timeline-rail", { x: action.x + 56, y: action.y, width: 5, height: action.height }, 0, "rail"),
    ...labels.map((label, index) => {
      const itemX = action.x + 44;
      const itemY = action.y + index * Math.round(action.height / 4);
      return withKeyframes(groupLayer(`timeline-item-${index}`, { x: itemX, y: itemY, width: action.width - 70, height: 88 }, [
        shapeLayer(`timeline-dot-${index}`, { x: itemX, y: itemY + 30, width: 34, height: 34 }, index),
        textLayer(`timeline-label-${index}`, label, { x: itemX + 58, y: itemY + 12, width: action.width - 120, height: 60 }, 28, 880)
      ]), enterKeyframes(index * 5, fps));
    })
  ];
}

function timelineRailPosterLayers(spec: VisualSceneSpec, fps: number): MotionLayer[] {
  const { width, height } = motionSizeForRatio(spec.ratio);
  const accentOffset = spec.design?.accentIndex ?? 0;
  const typeScale = spec.design?.typographyScale ?? 1;
  const labels = normalizeLabels(spec.contentSlots.chips ?? spec.contentSlots.entities ?? [], 4, 18);
  const left = Math.round(width * 0.065);
  const top = Math.round(height * 0.064);
  const maxW = Math.round(width * 0.87);
  const railX = left + 60;
  const startY = Math.round(height * 0.28);
  const stepY = Math.round(height * 0.15);
  return [
    textLayer("timeline-poster-kicker", "FRAME SEQUENCE / EDIT RHYTHM", { x: left, y: top, width: Math.round(maxW * 0.66), height: 34 }, 20, 850, { fill: "#F05A28" }),
    textLayer("timeline-poster-title", spec.contentSlots.headline ?? "本期关键词", { x: left, y: top + 58, width: Math.round(maxW * 0.68), height: Math.round(height * 0.13) }, Math.round(58 * typeScale), 950),
    shapeLayer("timeline-poster-rail", { x: railX, y: startY - 24, width: 6, height: stepY * 3 + 110 }, accentOffset, "rail"),
    ...labels.map((label, index) => {
      const y = startY + index * stepY;
      const cardX = left + 118 + (index % 2) * 36;
      const cardW = maxW - (cardX - left) - 20;
      return withKeyframes(groupLayer(`timeline-poster-card-${index}`, { x: cardX, y: y - 22, width: cardW, height: 106 }, [
        shapeLayer(`timeline-poster-dot-${index}`, { x: railX - 20, y: y + 10, width: 46, height: 46 }, accentOffset + index, "sticker"),
        shapeLayer(`timeline-poster-bg-${index}`, { x: cardX, y: y - 22, width: cardW, height: 106 }, accentOffset + index + 1, "paper"),
        textLayer(`timeline-poster-index-${index}`, `0${index + 1}`, { x: cardX + 24, y: y + 2, width: 58, height: 28 }, 19, 950, { fill: "#6C6454" }),
        textLayer(`timeline-poster-label-${index}`, label, { x: cardX + 92, y: y + 2, width: cardW - 122, height: 58 }, 28, 950),
        shapeLayer(`timeline-poster-rule-${index}`, { x: cardX + 92, y: y + 74, width: Math.round((cardW - 128) * (0.5 + index * 0.12)), height: 7 }, accentOffset + index + 2, "bar")
      ]), holdRotate(index * 4, fps, index % 2 === 0 ? -0.8 : 0.8));
    }),
    shapeLayer("timeline-subtitle-guard", { x: left, y: spec.safeAreas.subtitle.y - 28, width: maxW, height: 4 }, accentOffset + 2, "bar")
  ];
}

function workflowOrbitLayers(spec: VisualSceneSpec, fps: number): MotionLayer[] {
  const labels = normalizeLabels(spec.contentSlots.chips ?? spec.contentSlots.entities ?? [], 6);
  const action = spec.safeAreas.action;
  const cx = action.x + Math.round(action.width / 2);
  const cy = action.y + Math.round(action.height / 2);
  return [
    textLayer("workflow-title", spec.contentSlots.headline ?? "WORKFLOW", spec.safeAreas.title, 64, 950),
    withKeyframes(shapeLayer("workflow-core", { x: cx - 80, y: cy - 80, width: 160, height: 160 }, 0, "core"), pulseKeyframes(0, fps)),
    ...labels.map((label, index) => {
      const angle = (Math.PI * 2 * index) / labels.length;
      const x = cx + Math.round(Math.cos(angle) * action.width * 0.34) - 92;
      const y = cy + Math.round(Math.sin(angle) * action.height * 0.28) - 28;
      return withKeyframes(textLayer(`workflow-node-${index}`, label, { x, y, width: 184, height: 56 }, 22, 850), enterKeyframes(index * 4, fps));
    })
  ];
}

function creatorDeskLayers(spec: VisualSceneSpec, fps: number): MotionLayer[] {
  const action = spec.safeAreas.action;
  return [
    textLayer("creator-title", spec.contentSlots.headline ?? "CREATOR CUT", spec.safeAreas.title, 64, 950),
    withKeyframes(shapeLayer("phone-preview", { x: action.x + 60, y: action.y + 30, width: Math.round(action.width * 0.34), height: Math.round(action.height * 0.68) }, 0, "phone"), enterKeyframes(0, fps)),
    withKeyframes(shapeLayer("mic-ring", { x: action.x + Math.round(action.width * 0.68), y: action.y + 80, width: 170, height: 170 }, 1, "ring"), pulseKeyframes(8, fps)),
    shapeLayer("edit-track", { x: action.x + 40, y: action.y + Math.round(action.height * 0.78), width: action.width - 80, height: 62 }, 2, "rail"),
    ...normalizeLabels(spec.contentSlots.chips ?? [], 3).map((label, index) =>
      textLayer(`creator-chip-${index}`, label, { x: action.x + Math.round(action.width * 0.54), y: action.y + 292 + index * 58, width: Math.round(action.width * 0.34), height: 42 }, 22, 850)
    )
  ];
}

function splitCompareLayers(spec: VisualSceneSpec, fps: number): MotionLayer[] {
  if (isPaperSpec(spec)) return splitComparePosterLayers(spec, fps);
  const action = spec.safeAreas.action;
  const labels = normalizeLabels(spec.contentSlots.chips ?? [], 2);
  const panelW = Math.round(action.width * 0.48);
  const rightX = action.x + Math.round(action.width * 0.52);
  return [
    textLayer("compare-title", spec.contentSlots.headline ?? "COMPARE", spec.safeAreas.title, 64, 950),
    withKeyframes(groupLayer("left-panel", { x: action.x, y: action.y, width: panelW, height: action.height }, [
      shapeLayer("left-bg", { x: action.x, y: action.y, width: panelW, height: action.height }, 0, "panel"),
      textLayer("left-label", labels[0]!, { x: action.x + 32, y: action.y + 36, width: Math.round(action.width * 0.4), height: 80 }, 30, 900)
    ]), enterKeyframes(0, fps)),
    withKeyframes(groupLayer("right-panel", { x: rightX, y: action.y, width: panelW, height: action.height }, [
      shapeLayer("right-bg", { x: rightX, y: action.y, width: panelW, height: action.height }, 1, "panel"),
      textLayer("right-label", labels[1]!, { x: rightX + 32, y: action.y + 36, width: Math.round(action.width * 0.4), height: 80 }, 30, 900)
    ]), enterKeyframes(6, fps))
  ];
}

function splitComparePosterLayers(spec: VisualSceneSpec, fps: number): MotionLayer[] {
  const { width, height } = motionSizeForRatio(spec.ratio);
  const accentOffset = spec.design?.accentIndex ?? 0;
  const typeScale = spec.design?.typographyScale ?? 1;
  const product = spec.contentSlots.product;
  const labels = normalizeLabels(spec.contentSlots.chips ?? spec.contentSlots.entities ?? [], 6, 18);
  const left = Math.round(width * 0.065);
  const top = Math.round(height * 0.064);
  const maxW = Math.round(width * 0.87);
  const panelY = Math.round(height * 0.28);
  const panelH = Math.round(height * 0.43);
  const gap = Math.round(width * 0.034);
  const panelW = Math.round((maxW - gap) / 2);
  const rightX = left + panelW + gap;
  const verdictY = panelY + panelH + Math.round(height * 0.035);
  const leftBullets = normalizeLabels(product?.highlightsZh?.length ? product.highlightsZh : labels.slice(0, 3), 3, 16);
  const rightBullets = normalizeLabels(labels.slice(3).length ? labels.slice(3) : spec.contentSlots.entities ?? [], 3, 16);
  return [
    textLayer("compare-poster-kicker", "ARGUMENT CUT / VIRAL HOOK", { x: left, y: top, width: Math.round(maxW * 0.65), height: 34 }, 20, 850, { fill: "#F05A28" }),
    textLayer("compare-poster-title", spec.contentSlots.headline ?? product?.name ?? "观点拆解", { x: left, y: top + 58, width: Math.round(maxW * 0.68), height: Math.round(height * 0.13) }, Math.round(58 * typeScale), 950),
    withKeyframes(groupLayer("compare-poster-left", { x: left, y: panelY, width: panelW, height: panelH }, [
      shapeLayer("compare-poster-left-bg", { x: left, y: panelY, width: panelW, height: panelH }, accentOffset, "paper"),
      shapeLayer("compare-poster-left-tab", { x: left + 26, y: panelY + 28, width: 126, height: 48 }, 0, "label"),
      textLayer("compare-poster-left-tag", "亮点", { x: left + 48, y: panelY + 38, width: 84, height: 32 }, 22, 950),
      ...leftBullets.map((label, index) =>
        groupLayer(`compare-poster-left-row-${index}`, { x: left + 34, y: panelY + 112 + index * 92, width: panelW - 68, height: 64 }, [
          shapeLayer(`compare-poster-left-dot-${index}`, { x: left + 34, y: panelY + 126 + index * 92, width: 30, height: 30 }, accentOffset + index + 1, "sticker"),
          textLayer(`compare-poster-left-copy-${index}`, label, { x: left + 80, y: panelY + 112 + index * 92, width: panelW - 116, height: 56 }, 24, 900)
        ])
      )
    ]), enterKeyframes(0, fps)),
    withKeyframes(groupLayer("compare-poster-right", { x: rightX, y: panelY, width: panelW, height: panelH }, [
      shapeLayer("compare-poster-right-bg", { x: rightX, y: panelY, width: panelW, height: panelH }, accentOffset + 1, "paper"),
      shapeLayer("compare-poster-right-tab", { x: rightX + 26, y: panelY + 28, width: 126, height: 48 }, 0, "label"),
      textLayer("compare-poster-right-tag", "传播", { x: rightX + 48, y: panelY + 38, width: 84, height: 32 }, 22, 950),
      ...rightBullets.map((label, index) =>
        groupLayer(`compare-poster-right-row-${index}`, { x: rightX + 34, y: panelY + 112 + index * 92, width: panelW - 68, height: 64 }, [
          shapeLayer(`compare-poster-right-dot-${index}`, { x: rightX + 34, y: panelY + 126 + index * 92, width: 30, height: 30 }, accentOffset + index + 3, "sticker"),
          textLayer(`compare-poster-right-copy-${index}`, label, { x: rightX + 80, y: panelY + 112 + index * 92, width: panelW - 116, height: 56 }, 24, 900)
        ])
      )
    ]), enterKeyframes(7, fps)),
    withKeyframes(shapeLayer("compare-poster-swipe", { x: left + Math.round(maxW * 0.47), y: panelY + 34, width: 18, height: panelH - 68 }, accentOffset + 4, "bar"), pulseKeyframes(12, fps)),
    withKeyframes(groupLayer("compare-poster-verdict", { x: left, y: verdictY, width: maxW, height: 116 }, [
      shapeLayer("compare-poster-verdict-bg", { x: left, y: verdictY, width: maxW, height: 116 }, 1, "sticker"),
      textLayer("compare-poster-verdict-copy", "先给结论，再用三条证据加速信任建立。", { x: left + 34, y: verdictY + 30, width: maxW - 68, height: 54 }, 28, 950)
    ]), enterKeyframes(14, fps)),
    shapeLayer("compare-subtitle-guard", { x: left, y: spec.safeAreas.subtitle.y - 28, width: maxW, height: 4 }, accentOffset + 1, "bar")
  ];
}

function whiteboardExplainLayers(spec: VisualSceneSpec, fps: number): MotionLayer[] {
  const action = spec.safeAreas.action;
  const labels = normalizeLabels(spec.contentSlots.chips ?? spec.contentSlots.entities ?? [], 4);
  return [
    textLayer("whiteboard-title", spec.contentSlots.headline ?? "EXPLAIN", spec.safeAreas.title, 64, 950),
    shapeLayer("board", action, 0, "panel"),
    ...labels.map((label, index) =>
      withKeyframes(textLayer(`board-step-${index}`, `${index + 1}. ${label}`, { x: action.x + 54, y: action.y + 60 + index * 92, width: action.width - 108, height: 58 }, 28, 840), enterKeyframes(index * 5, fps))
    )
  ];
}

//  Product Card
function productCardLayers(
  spec: VisualSceneSpec, frame: {x:number;y:number;width:number;height:number}, idPrefix: string
): MotionLayer[] {
  const p = spec.contentSlots.product;
  if (!p?.name) return [];
  const f = frame;
  const initial = p.name.charAt(0).toUpperCase();
  const nm = short(p.name, 16);
  const tag = short(p.oneLineZh || p.tagline || "", 28);
  const pal = typeof spec.style.themeId === "string" ? spec.style.themeId : "paper-ink";
  const isPaper = pal === "paper-ink" || pal.startsWith("od-");
  const ci = spec.design?.accentIndex ?? 0;
  return [
    shapeLayer(idPrefix+"_bg",{x:f.x,y:f.y,width:f.width,height:f.height},ci,isPaper?"paper":"panel"),
    shapeLayer(idPrefix+"_top",{x:f.x,y:f.y,width:f.width,height:Math.round(f.height*0.1)},ci,"bar"),
    textLayer(idPrefix+"_init",initial,{x:f.x+Math.round(f.width*0.1),y:f.y+Math.round(f.height*0.16),width:Math.round(f.width*0.3),height:Math.round(f.height*0.42)},Math.round(Math.min(f.width,f.height)*0.22),950,{fontFamily:"serif"}),
    textLayer(idPrefix+"_name",nm,{x:f.x+Math.round(f.width*0.1),y:f.y+Math.round(f.height*0.54),width:Math.round(f.width*0.8),height:Math.round(f.height*0.2)},Math.round(f.width*0.08),800),
    ...(tag ? [textLayer(idPrefix+"_tag",tag,{x:f.x+Math.round(f.width*0.1),y:f.y+Math.round(f.height*0.72),width:Math.round(f.width*0.8),height:Math.round(f.height*0.15)},Math.round(f.width*0.05),700,{fill:"#6B6358"})] : []),
    ...(p.rank ? [shapeLayer(idPrefix+"_rank",{x:f.x+Math.round(f.width*0.74),y:f.y+4,width:Math.round(f.width*0.2),height:34},ci+1,"sticker"),textLayer(idPrefix+"_rT", "#"+p.rank,{x:f.x+Math.round(f.width*0.74),y:f.y+4,width:Math.round(f.width*0.2),height:34},Math.round(f.width*0.05),900)] : []),
  ];
}

function textLayer(id: string, content: string, frame: MotionLayer["frame"], fontSize: number, fontWeight: number, style: Record<string, string | number> = {}): MotionLayer {
  return {
    id,
    kind: "text",
    frame,
    content,
    style: { fontSize, fontWeight, ...style },
    safeAreaRole: id.includes("title") ? "title" : "ui",
    keyframes: enterKeyframes(0, 30)
  };
}

function shapeLayer(id: string, frame: MotionLayer["frame"], colorIndex: number, tone: "solid" | "panel" | "paper" | "sticker" | "label" | "bar" | "scan" | "cursor" | "rail" | "core" | "phone" | "ring" = "solid"): MotionLayer {
  return {
    id,
    kind: "shape",
    frame,
    style: {
      tone,
      colorIndex,
      radius: tone === "bar" || tone === "rail" ? 999 : 28
    },
    safeAreaRole: "visual"
  };
}

function groupLayer(id: string, frame: MotionLayer["frame"], children: MotionLayer[]): MotionLayer {
  return { id, kind: "group", frame, children, safeAreaRole: "visual" };
}

function enterKeyframes(delay: number, fps: number) {
  const start = Math.max(0, delay);
  return [
    { frame: start, properties: { opacity: 0, translateY: 28, scale: 0.96 }, easing: "ease-out" as const },
    { frame: start + Math.round(fps * 0.45), properties: { opacity: 1, translateY: 0, scale: 1 }, easing: "expo-out" as const }
  ];
}

function pulseKeyframes(delay: number, fps: number) {
  const start = Math.max(0, delay);
  return [
    { frame: start, properties: { scale: 0.98, opacity: 0.72 }, easing: "ease-out" as const },
    { frame: start + Math.round(fps * 0.5), properties: { scale: 1.05, opacity: 1 }, easing: "spring" as const },
    { frame: start + Math.round(fps), properties: { scale: 1, opacity: 0.86 }, easing: "ease-in-out" as const }
  ];
}

function holdRotate(delay: number, fps: number, rotate: number) {
  const start = Math.max(0, delay);
  return [
    { frame: start, properties: { opacity: 0, translateY: 24, scale: 0.98, rotate }, easing: "ease-out" as const },
    { frame: start + Math.round(fps * 0.45), properties: { opacity: 1, translateY: 0, scale: 1, rotate }, easing: "expo-out" as const }
  ];
}

function withKeyframes(layer: MotionLayer, keyframes: MotionLayer["keyframes"]): MotionLayer {
  return { ...layer, keyframes };
}

function normalizeLabels(labels: string[], count: number, max = 14): string[] {
  const fallback = ["选题", "脚本", "画面", "字幕", "发布", "复盘"];
  return Array.from({ length: count }, (_, index) => short(labels[index] ?? fallback[index % fallback.length] ?? `Step ${index + 1}`, max));
}

function short(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function posterLabels(labels: string[], maxCount: number): string[] {
  const blocked = [/Product Hunt/i, /^TOP$/i, /^\d{4}-\d{2}-\d{2}$/i, /^本期总览$/];
  const clean = labels
    .map((label) => label.replace(/^#\d+\s*/, "").trim())
    .filter((label) => label.length >= 2)
    .filter((label) => !blocked.some((pattern) => pattern.test(label)));
  const uniqueLabels = Array.from(new Set(clean)).slice(0, maxCount).map((label) => short(label, 18));
  return uniqueLabels.length ? uniqueLabels : normalizeLabels([], Math.min(3, maxCount), 18);
}

type SignalRow = {
  label: string;
  detail: string;
  score: number;
  badge: string;
};

function signalRows(spec: VisualSceneSpec): SignalRow[] {
  const product = spec.contentSlots.product;
  if (product) {
    return [
      {
        label: product.name,
        detail: short(product.oneLineZh || product.tagline, 24),
        score: scoreFromNumber(product.votes, 92),
        badge: "升"
      },
      {
        label: "适合人群",
        detail: short(product.targetUser || "独立开发者和产品团队", 24),
        score: 86,
        badge: "准"
      },
      {
        label: "收藏理由",
        detail: short(product.whyInterestingZh || "具备明确工作流价值", 24),
        score: 88,
        badge: "藏"
      },
      {
        label: "讨论热度",
        detail: product.comments === undefined ? "评论数据待采集" : `${product.comments} 条讨论`,
        score: scoreFromNumber(product.comments, 76),
        badge: "评"
      }
    ];
  }
  const labels = posterLabels([...(spec.contentSlots.entities ?? []), ...(spec.contentSlots.chips ?? [])], 4);
  const details = [
    "适合开场先抛结论",
    "可拆成功能路径",
    "具备收藏型信息点",
    "适合结尾做复盘"
  ];
  return normalizeLabels(labels, 4, 18).map((label, index) => ({
    label,
    detail: details[index] ?? "可转成短视频镜头",
    score: scoreForLabel(label, index),
    badge: index === 0 ? "热" : index === 1 ? "拆" : index === 2 ? "藏" : "续"
  }));
}

function signalMetrics(spec: VisualSceneSpec, rows: SignalRow[]): Array<{ label: string; value: string }> {
  const product = spec.contentSlots.product;
  if (product) {
    return [
      { label: "排名", value: `#${product.rank}` },
      { label: "票数", value: product.votes === undefined ? "待采集" : String(product.votes) },
      { label: "讨论", value: product.comments === undefined ? "待采集" : String(product.comments) }
    ];
  }
  return [
    { label: "候选", value: `${rows.length} 个` },
    { label: "最高热度", value: String(rows[0]?.score ?? 88) },
    { label: "输出", value: "短视频" }
  ];
}

function scoreForLabel(label: string, index: number): number {
  let value = 0;
  for (let i = 0; i < label.length; i++) value += label.charCodeAt(i) * (i + 3);
  return Math.max(68, Math.min(96, 96 - index * 7 - (value % 6)));
}

function scoreFromNumber(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  return Math.max(62, Math.min(98, Math.round(68 + Math.log10(Math.max(1, value)) * 12)));
}

function isPaperSpec(spec: VisualSceneSpec): boolean {
  return spec.style.themeId === "paper-ink" || spec.style.themeId.startsWith("od-");
}

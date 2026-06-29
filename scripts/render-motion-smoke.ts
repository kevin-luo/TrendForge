/**
 * MotionGraph smoke render — 验证完整管线可行性
 *
 * 流程：smoke TrendItems -> Storyboard -> MotionDirectorPlan -> MotionGraph[]
 *       -> 每个 graph 的黄金帧 SVG/PNG -> RenderLintReport
 *
 * 产出：storage/cache/motion-smoke/frames/  内的 .svg 和 .png
 *       storage/cache/motion-smoke/lint.json   lint 报告
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TrendItem, VideoStoryboard } from "@trendforge/core";
import { buildSubtitleTracks, createProductHuntStoryboard } from "@trendforge/product-video";
import { createMotionDirectorPlan } from "@trendforge/motion-director";
import { goldenFrameFor, writeMotionGraphFrame } from "@trendforge/motion-render";
import { lintMotionGraph } from "@trendforge/render-lint";

const outDir = path.resolve(process.cwd(), "storage", "cache", "motion-smoke");
const framesDir = path.join(outDir, "frames");
await mkdir(framesDir, { recursive: true });

/* ── smoke data ─────────────────────────────────────────────────────────── */

const items: TrendItem[] = [
  {
    id: "smoke_vectorpilot",
    source: "product-hunt",
    title: "VectorPilot",
    url: "https://example.com/vectorpilot",
    summary: "把 Figma 设计稿转成可维护前端代码的本地 AI 工具，面向独立开发者和产品团队。",
    content: "Local AI design-to-code workflow",
    author: "TrendForge",
    score: 386,
    comments: 48,
    rank: 1,
    raw: {}
  },
  {
    id: "smoke_shippulse",
    source: "product-hunt",
    title: "ShipPulse",
    url: "https://example.com/shippulse",
    summary: "追踪发布节奏、用户反馈和增长信号，把产品迭代变成可视化作战室。",
    content: "Product launch intelligence workspace",
    author: "TrendForge",
    score: 284,
    comments: 35,
    rank: 2,
    raw: {}
  },
  {
    id: "smoke_promptdesk",
    source: "product-hunt",
    title: "PromptDesk",
    url: "https://example.com/promptdesk",
    summary: "团队级 Prompt 管理、评测和复用系统，适合 AI 产品团队沉淀工作流。",
    content: "Prompt operations for AI teams",
    author: "TrendForge",
    score: 241,
    comments: 29,
    rank: 3,
    raw: {}
  }
];

/* ── storyboard ──────────────────────────────────────────────────────────── */

const base = createProductHuntStoryboard({
  items,
  assets: [],
  language: "bilingual",
  ratio: "9:16",
  date: "2026-06-05",
  topCount: 3,
  style: "快切短视频"
});

// 取代表性场景：封面、概览、第一个产品、结尾
const scenePool = [base.scenes[0], base.scenes[1], base.scenes[2], base.scenes.at(-1)];
const scenes = scenePool.filter((s): s is VideoStoryboard["scenes"][number] => Boolean(s));

const storyboard: VideoStoryboard = {
  ...base,
  candidate: "a",
  theme: "paper-ink",
  scenes,
  durationTarget: scenes.reduce((sum, s) => sum + s.duration, 0),
  subtitleTracks: buildSubtitleTracks(scenes)
};

await writeFile(path.join(outDir, "storyboard.json"), JSON.stringify(storyboard, null, 2), "utf8");
console.log(`\n[smoke] storyboard: ${scenes.length} scenes`);

/* ── MotionGraph 管线 ────────────────────────────────────────────────────── */

const plan = createMotionDirectorPlan(storyboard, { fps: 30, candidate: "a" });
console.log(`[smoke] motion plan: ${plan.specs.length} specs → ${plan.graphs.length} graphs`);
await writeFile(path.join(outDir, "motion-design.json"), JSON.stringify(plan.designPlan, null, 2), "utf8");

/* ── 渲染关键帧 PNG ──────────────────────────────────────────────────────── */

type FrameResult = {
  graphId: string;
  visualType: string;
  frame: number;
  svgPath: string;
  pngPath: string | undefined;
  bytes: number;
  lintScore: number;
};
const results: FrameResult[] = [];
const lintReports = [];

for (let i = 0; i < plan.graphs.length; i++) {
  const graph = plan.graphs[i]!;
  const spec = plan.specs[i]!;
  const frame = goldenFrameFor(graph);
  const label = `${String(i).padStart(2, "0")}_${spec.visualType.replace(/-/g, "_")}`;

  const written = await writeMotionGraphFrame(
    graph,
    frame,
    path.join(framesDir, label),
    { debug: true }
  );

  const lint = lintMotionGraph(graph, {
    jobId: graph.id,
    sampleFrames: [0, frame, graph.durationFrames - 1]
  });
  lintReports.push(lint);

  results.push({
    graphId: graph.id,
    visualType: spec.visualType,
    frame,
    svgPath: written.svgPath,
    pngPath: written.pngPath,
    bytes: written.bytes,
    lintScore: lint.score
  });

  const rasterTag = written.rasterized ? "✓ PNG" : "○ SVG";
  console.log(`  [${i + 1}/${plan.graphs.length}] ${spec.visualType.padEnd(24)} f=${frame}  score=${lint.score}  ${rasterTag}  ${(written.bytes / 1024).toFixed(0)}KB`);
}

await writeFile(path.join(outDir, "lint.json"), JSON.stringify(lintReports, null, 2), "utf8");

/* ── 汇总 ────────────────────────────────────────────────────────────────── */

const pngCount = results.filter((r) => r.pngPath).length;
const avgScore = Math.round(results.reduce((sum, r) => sum + r.lintScore, 0) / results.length);

console.log(`\n[smoke] done`);
console.log(`  frames dir : ${framesDir}`);
console.log(`  PNG 帧     : ${pngCount}/${results.length}  (sharp ${pngCount ? "OK" : "not linked"})`);
console.log(`  avg lint   : ${avgScore} / 100`);
console.log(`  lint report: ${path.join(outDir, "lint.json")}`);
if (pngCount > 0) {
  console.log(`\n  关键帧验收 (肉眼检查):`);
  for (const r of results) {
    if (r.pngPath) console.log(`    ${r.visualType.padEnd(24)} ${r.pngPath}`);
  }
}

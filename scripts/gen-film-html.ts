import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import type { TrendItem, VideoStoryboard } from "@trendforge/core";
import { createProductHuntStoryboard, buildSubtitleTracks } from "@trendforge/product-video";
import { storyboardToVisualSpecs } from "@trendforge/motion-director";
import { makeFilmHtml } from "../packages/motion-render/src/html-film.js";

const outDir = path.resolve(process.cwd(), "storage", "cache", "pw-smoke");
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const items: TrendItem[] = [
  { id: "r1", source: "product-hunt", title: "VectorPilot", url: "https://example.com/vp", summary: "Figma to code AI", content: "AI design-to-code", author: "TF", score: 386, comments: 48, rank: 1, raw: {} },
  { id: "r2", source: "product-hunt", title: "ShipPulse", url: "https://example.com/sp", summary: "Launch intelligence", content: "Product ops", author: "TF", score: 284, comments: 35, rank: 2, raw: {} },
];
const base = createProductHuntStoryboard({ items, assets: [], language: "bilingual", ratio: "9:16", date: "2026-06-06", topCount: 2, style: "快切短视频" });
const scenes = [base.scenes[0], base.scenes[1], base.scenes[2]].filter(Boolean) as VideoStoryboard["scenes"];
const storyboard: VideoStoryboard = { ...base, candidate: "a", theme: "paper-ink", scenes, durationTarget: scenes.reduce((s, sc) => s + sc.duration, 0), subtitleTracks: buildSubtitleTracks(scenes) };
const specs = JSON.parse(JSON.stringify(storyboardToVisualSpecs(storyboard, { fps: 30, candidate: "a" })));

const html = makeFilmHtml(specs, { themeId: "paper-ink", fps: 30 });
await writeFile(path.join(outDir, "film.html"), html, "utf8");
console.log(`HTML: ${(html.length/1024).toFixed(1)}KB | ${specs.length} scenes | ${specs.reduce((s:any,sp:any)=>s+sp.duration,0).toFixed(1)}s`);

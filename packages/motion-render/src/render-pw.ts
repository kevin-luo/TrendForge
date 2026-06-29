import { mkdir, writeFile as wf, rm } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";
import type { TrendItem, VideoStoryboard } from "@trendforge/core";
import { createProductHuntStoryboard, buildSubtitleTracks } from "@trendforge/product-video";
import { storyboardToVisualSpecs } from "@trendforge/motion-director";
import { makeFilmHtml } from "./html-film.js";

const outDir = path.resolve(process.cwd(), "../../storage/cache/pw-smoke");
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
const framesDir = path.join(outDir, "frames");
await mkdir(framesDir);

const items: TrendItem[] = [
  { id: "r1", source: "product-hunt", title: "VectorPilot", url: "https://example.com/vp", summary: "Figma to code AI", content: "AI design-to-code", author: "TF", score: 386, comments: 48, rank: 1, raw: {} },
  { id: "r2", source: "product-hunt", title: "ShipPulse", url: "https://example.com/sp", summary: "Launch intelligence", content: "Product ops", author: "TF", score: 284, comments: 35, rank: 2, raw: {} },
];
const base = createProductHuntStoryboard({ items, assets: [], language: "bilingual", ratio: "9:16", date: "2026-06-06", topCount: 2, style: "快切短视频" });
const scenes = [base.scenes[0], base.scenes[1], base.scenes[2]].filter(Boolean) as VideoStoryboard["scenes"];
const storyboard: VideoStoryboard = { ...base, candidate: "a", theme: "paper-ink", scenes, durationTarget: scenes.reduce((s, sc) => s + sc.duration, 0), subtitleTracks: buildSubtitleTracks(scenes) };
const specs = JSON.parse(JSON.stringify(storyboardToVisualSpecs(storyboard, { fps: 30, candidate: "a" })));

const html = makeFilmHtml(specs, { themeId: "paper-ink", fps: 30 });
const htmlPath = path.join(outDir, "film.html");
await wf(htmlPath, html, "utf8");
const fps = 30;
const total = Math.round(specs.reduce((s:any,sp:any)=>s+sp.duration,0)*fps);
console.log(`HTML:${(html.length/1024).toFixed(1)}KB | ${total}f`);

const EXEC = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({ executablePath: EXEC, headless: true, args: ["--no-sandbox","--disable-gpu"] });
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 2 });
await page.goto("file:///" + htmlPath.replace(/\\/g,"/"), { waitUntil: "networkidle0" });

const keys = [0, Math.round(total*0.15), Math.round(total*0.35), Math.round(total*0.55), Math.round(total*0.75), Math.max(0,total-1)];
for (const f of keys) {
  if (f>=total) continue;
  await page.evaluate((fr:number)=>{ (window as any).seek(fr); }, f);
  await new Promise(r=>setTimeout(r,400));
  const p = path.join(framesDir, `frame_${String(f).padStart(6,"0")}.png`);
  await page.screenshot({ path: p, type: "png" });
  console.log(`  f ${f}/${total} -> ${path.basename(p)}`);
}
await browser.close();

try {
  const { execSync } = await import("node:child_process");
  const gl = path.join(framesDir,"frame_%06d.png").replace(/\\/g,"/");
  const vid = path.join(outDir,"pw_a.mp4");
  execSync(`ffmpeg -y -framerate ${fps} -i "${gl}" -c:v libx264 -pix_fmt yuv420p -crf 18 "${vid}"`,{stdio:"pipe"});
  const { statSync } = await import("node:fs");
  console.log(`\nVideo: ${vid} (${(statSync(vid).size/1024/1024).toFixed(1)}MB)`);
} catch { console.log("\nFFmpeg N/A, frames at:", framesDir); }
console.log("Done!");

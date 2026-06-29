// E:\coding\TrendForge\scripts\render-html-film.ts
// Full automated pipeline: Storyboard -> HTML -> Frames -> MP4
import { mkdir, writeFile, rm, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type { TrendItem, VideoStoryboard } from "@trendforge/core";
import { createProductHuntStoryboard, buildSubtitleTracks } from "@trendforge/product-video";
import { storyboardToVisualSpecs } from "@trendforge/motion-director";
import { makeFilmHtml } from "../packages/motion-render/src/html-film.js";

const OUT = path.resolve(process.cwd(), "storage", "cache", "html-film");
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const FRAMES = path.join(OUT, "frames");
await mkdir(FRAMES);

// ---- Resolve puppeteer-core from pnpm store ----
const pnpmStore = path.resolve(process.cwd(), "node_modules", ".pnpm");
const pcDir = path.join(pnpmStore, "puppeteer-core@25.1.0", "node_modules", "puppeteer-core");
const req = createRequire(path.join(pcDir, "package.json"));
const puppeteer = req("puppeteer-core");

// ---- Generate storyboard & specs ----
const items: TrendItem[] = [
  { id: "r1", source: "product-hunt", title: "VectorPilot", url: "https://example.com/vp", summary: "Figma to code AI", content: "AI design-to-code", author: "TF", score: 386, comments: 48, rank: 1, raw: {} },
  { id: "r2", source: "product-hunt", title: "ShipPulse", url: "https://example.com/sp", summary: "Launch intelligence", content: "Product ops", author: "TF", score: 284, comments: 35, rank: 2, raw: {} },
];
const base = createProductHuntStoryboard({ items, assets: [], language: "bilingual", ratio: "9:16", date: "2026-06-06", topCount: 2, style: "快切短视频" });
const scenes = [base.scenes[0], base.scenes[1], base.scenes[2]].filter(Boolean) as VideoStoryboard["scenes"];
const sb: VideoStoryboard = { ...base, candidate: "a", theme: "paper-ink", scenes, durationTarget: scenes.reduce((s:any,sc:any)=>s+sc.duration,0), subtitleTracks: buildSubtitleTracks(scenes) };
const specs = JSON.parse(JSON.stringify(storyboardToVisualSpecs(sb, { fps: 30, candidate: "a" })));

// ---- Generate HTML ----
const html = makeFilmHtml(specs, { themeId: "paper-ink", fps: 30 });
const htmlPath = path.join(OUT, "film.html");
await writeFile(htmlPath, html, "utf8");
const fps = 30;
const totalF = Math.round(specs.reduce((s:any,sp:any)=>s+sp.duration,0)*fps);
console.log(`HTML: ${(html.length/1024).toFixed(1)}KB | ${totalF}f`);

// ---- Render frames ----
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox","--disable-gpu","--disable-setuid-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 800));

const keyFrames = [0, Math.round(totalF*0.15), Math.round(totalF*0.35), Math.round(totalF*0.55), Math.round(totalF*0.75), Math.max(0,totalF-1)];
let frameIdx = 0;
for (const f of keyFrames) {
  if (f >= totalF) continue;
  await page.evaluate((fr: number) => { (window as any).seek(fr); }, f);
  await new Promise(r => setTimeout(r, 500));
  const png = path.join(FRAMES, `frame_${String(frameIdx).padStart(6,"0")}.png`);
  await page.screenshot({ path: png, type: "png" });
  console.log(`  [${frameIdx+1}/${keyFrames.length}] frame ${f}/${totalF} -> ${(await import("node:fs/promises")).stat(png).then(s=> (s.size/1024).toFixed(0)+"KB")}`);
  frameIdx++;
}
await browser.close();
console.log(`Frames: ${frameIdx} in ${FRAMES}`);

// ---- Compose video ----
const ffmpegDir = path.join(pnpmStore, "@ffmpeg-installer+ffmpeg@1.1.0", "node_modules", "@ffmpeg-installer", "ffmpeg");
let ffmpegExe = "";
// Search for ffmpeg.exe recursively in ffmpegDir
const { readdir } = await import("node:fs/promises");
async function findFFmpeg(dir: string): Promise<string> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const fp = path.join(dir, e.name);
      if (e.isFile() && e.name === "ffmpeg.exe") return fp;
      if (e.isDirectory()) {
        const found = await findFFmpeg(fp);
        if (found) return found;
      }
    }
  } catch {}
  return "";
}
ffmpegExe = await findFFmpeg(ffmpegDir);
if (ffmpegExe) {
  const gl = path.join(FRAMES, "frame_%06d.png").replace(/\\/g, "/");
  const vid = path.join(OUT, "film_a.mp4");
  const { execSync } = await import("node:child_process");
  execSync(`"${ffmpegExe}" -y -framerate 30 -i "${gl}" -c:v libx264 -pix_fmt yuv420p -crf 18 "${vid}"`, { stdio: "pipe" });
  const { statSync } = await import("node:fs");
  console.log(`\nVideo: ${vid} (${(statSync(vid).size/1024/1024).toFixed(1)}MB)`);
} else {
  console.log("\nFFmpeg not found in bundle. Frames at:", FRAMES);
}
console.log("Done!");

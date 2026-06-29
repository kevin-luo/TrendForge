/**
 * HtmlRenderer — Puppeteer-based HTML-to-frame-sequence renderer.
 *
 * Opens the HTML composition in a headless Chrome instance,
 * pauses the CSS animations, seeks each frame by adjusting
 * animation-delay, and saves each frame as a PNG.
 * The resulting image sequence is assembled into a video by ffmpeg.
 */

import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

export interface TextFitSample {
  role: string;
  sceneKey: string;
  templateKey: string;
  clamped: boolean;
}

export interface TextFitSummary {
  totalFitTextCount: number;
  clampedTextCount: number;
  clampedRate: number;
  clampedByRole: Record<string, number>;
  clampedByScene: Record<string, number>;
  clampedByTemplate: Record<string, number>;
}

export interface RenderQualityReport {
  sampledAt: string;
  sampledFrame: number;
  textFitSummary: TextFitSummary;
}

export interface RenderFramesOptions {
  /** Absolute path to the HTML file */
  html: string;
  width: number;
  height: number;
  deviceScaleFactor?: number;
  fps: number;
  duration: number;
  /** Directory to write frame PNGs into */
  outputDir: string;
  /** Collect text-fit quality metrics from the first prepared page */
  collectQuality?: boolean;
  /** Called with (framesWritten, totalFrames) as each frame is saved */
  onProgress?: (written: number, total: number) => Promise<void> | void;
}

export interface RenderFramesResult {
  frameDir: string;
  frameCount: number;
  /** Pattern to pass to ffmpeg -i (e.g. /path/frames/frame_%06d.png) */
  frameGlob: string;
  quality?: RenderQualityReport;
}

export interface RenderScenePostersOptions {
  html: string;
  width: number;
  height: number;
  outputDir: string;
  onProgress?: (written: number, total: number) => Promise<void> | void;
}

export interface ScenePoster {
  path: string;
  index: number;
}

export interface RenderScenePostersResult {
  posterDir: string;
  scenes: ScenePoster[];
}

// Chrome/Chromium binary search order
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH ?? "",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Google\\Chrome Beta\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium"
];

export function findChrome(): string | undefined {
  return CHROME_CANDIDATES.find((p) => p && existsSync(p));
}

export function summarizeTextFitSamples(samples: TextFitSample[]): TextFitSummary {
  const summary: TextFitSummary = {
    totalFitTextCount: samples.length,
    clampedTextCount: 0,
    clampedRate: 0,
    clampedByRole: {},
    clampedByScene: {},
    clampedByTemplate: {}
  };
  for (const sample of samples) {
    if (!sample.clamped) continue;
    summary.clampedTextCount += 1;
    summary.clampedByRole[sample.role] = (summary.clampedByRole[sample.role] ?? 0) + 1;
    summary.clampedByScene[sample.sceneKey] = (summary.clampedByScene[sample.sceneKey] ?? 0) + 1;
    summary.clampedByTemplate[sample.templateKey] = (summary.clampedByTemplate[sample.templateKey] ?? 0) + 1;
  }
  summary.clampedRate = summary.totalFitTextCount > 0 ? Number((summary.clampedTextCount / summary.totalFitTextCount).toFixed(3)) : 0;
  return summary;
}

export async function renderFrames(opts: RenderFramesOptions): Promise<RenderFramesResult> {
  const { html, width, height, deviceScaleFactor = 1, fps, duration, outputDir, collectQuality = false, onProgress } = opts;

  const executablePath = findChrome();
  if (!executablePath) {
    throw new Error(
      "找不到 Chrome 可执行文件。请安装 Google Chrome 或设置 CHROME_PATH 环境变量。"
    );
  }

  const totalFrames = Math.max(1, Math.round(duration * fps));
  const frameDir = path.join(outputDir, "frames");
  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });

  const fileUrl = `file:///${html.replace(/\\/g, "/")}`;
  const launchArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-web-security",
    "--allow-file-access-from-files",
    `--window-size=${width},${height}`
  ];

  // Frame screenshotting is the bottleneck. Parallelize across N worker BROWSERS
  // (separate processes — unlike multiple pages in one browser, this avoids the
  // shared-CDP screenshot contention that can deadlock). Each worker is its own
  // seek-driven clock, so frames stay deterministic. Pool = min(cores-1, 4),
  // overridable via RENDER_CONCURRENCY.
  const envPool = Number(process.env.RENDER_CONCURRENCY);
  const poolSize = Math.max(
    1,
    Math.min(Number.isFinite(envPool) && envPool > 0 ? envPool : os.cpus().length - 1, 4, totalFrames)
  );

  let completed = 0;
  let quality: RenderQualityReport | undefined;

  async function prepare(browser: Browser): Promise<Page> {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor });
    await page.goto(fileUrl, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts?.ready;
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          })
        )
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
    });
    const hasSeek = await page.evaluate(() => typeof (window as any).seek === "function");
    if (!hasSeek) throw new Error("HTML 模板未暴露 window.seek(frame)，无法逐帧渲染");
    return page;
  }

  async function collectQualityReport(page: Page): Promise<RenderQualityReport> {
    const samples = await page.evaluate(() => {
      const scenes = Array.from(document.querySelectorAll<HTMLElement>(".scene"));
      return Array.from(document.querySelectorAll<HTMLElement>("[data-fit]")).map((el) => {
        const scene = el.closest<HTMLElement>(".scene");
        const sceneIndex = scene ? scenes.indexOf(scene) : -1;
        const templateShell = el.closest<HTMLElement>(".template-shell");
        const templateKey =
          templateShell?.getAttribute("data-template-id")
          ?? templateShell?.getAttribute("data-template")
          ?? el.getAttribute("data-template-id")
          ?? "unknown";
        return {
          role: el.getAttribute("data-fit-role") ?? "unknown",
          sceneKey: sceneIndex >= 0 ? `scene-${sceneIndex}` : "scene-unknown",
          templateKey,
          clamped: el.getAttribute("data-fit-state") === "clamped"
        };
      });
    });
    return {
      sampledAt: new Date().toISOString(),
      sampledFrame: 0,
      textFitSummary: summarizeTextFitSamples(samples)
    };
  }

  // One worker = one browser rendering lane frames [lane, lane+pool, …].
  async function runLane(lane: number): Promise<void> {
    const browser = await puppeteer.launch({ executablePath, headless: true, args: launchArgs });
    try {
      const page = await prepare(browser);
      if (collectQuality && lane === 0) {
        await page.evaluate(async () => {
          await document.fonts?.ready;
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          if (typeof (window as any).seek === "function") (window as any).seek(0);
        });
        quality = await collectQualityReport(page);
      }
      for (let frame = lane; frame < totalFrames; frame += poolSize) {
        await page.evaluate((f: number) => (window as any).seek(f), frame);
        const framePath = path.join(frameDir, `frame_${String(frame).padStart(6, "0")}.png`);
        for (let attempt = 1; ; attempt++) {
          try {
            // Bound each screenshot so a hung capture rejects (then retries)
            // instead of stalling the whole render.
            await Promise.race([
              (page as any).screenshot({ path: framePath, type: "png" }),
              new Promise((_resolve, reject) => setTimeout(() => reject(new Error("screenshot timeout")), 20000))
            ]);
            break;
          } catch (error) {
            if (attempt >= 3) throw error;
            await new Promise<void>((resolve) => setTimeout(resolve, 250));
          }
        }
        completed += 1;
        await onProgress?.(completed, totalFrames);
      }
    } finally {
      await browser.close();
    }
  }

  await Promise.all(Array.from({ length: poolSize }, (_unused, lane) => runLane(lane)));

  return {
    frameDir,
    frameCount: totalFrames,
    frameGlob: path.join(frameDir, "frame_%06d.png"),
    quality
  };
}

export async function renderScenePosters(opts: RenderScenePostersOptions): Promise<RenderScenePostersResult> {
  const { html, width, height, outputDir, onProgress } = opts;

  const executablePath = findChrome();
  if (!executablePath) {
    throw new Error(
      "找不到 Chrome 可执行文件。请安装 Google Chrome 或设置 CHROME_PATH 环境变量。"
    );
  }

  const posterDir = path.join(outputDir, "posters");
  await rm(posterDir, { recursive: true, force: true });
  await mkdir(posterDir, { recursive: true });

  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--allow-file-access-from-files",
        `--window-size=${width},${height}`
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    const fileUrl = `file:///${html.replace(/\\/g, "/")}`;
    await page.goto(fileUrl, { waitUntil: "load" });

    await page.evaluate(async () => {
      await document.fonts?.ready;
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          })
        )
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 350));
    });

    const sceneCount = await page.evaluate(() => document.querySelectorAll(".scene").length);
    const total = Math.max(1, sceneCount);

    const posters: ScenePoster[] = [];
    for (let index = 0; index < total; index++) {
      await page.evaluate((activeIndex: number) => {
        document.documentElement.classList.add("poster-mode");
        const scenes = document.querySelectorAll<HTMLElement>(".scene");
        scenes.forEach((scene, sceneIndex) => {
          const visible = sceneIndex === activeIndex;
          scene.style.animation = "none";
          scene.style.opacity = visible ? "1" : "0";
          scene.style.visibility = visible ? "visible" : "hidden";
          scene.style.transform = "none";
        });
      }, index);

      const posterPath = path.join(posterDir, `scene_${String(index).padStart(3, "0")}.png`);
      await (page as any).screenshot({ path: posterPath, type: "png" });
      posters.push({ path: posterPath, index });
      await onProgress?.(index + 1, total);
    }

    return { posterDir, scenes: posters };
  } finally {
    await browser?.close();
  }
}

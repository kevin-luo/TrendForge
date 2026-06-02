/**
 * HtmlRenderer — Puppeteer-based HTML-to-frame-sequence renderer.
 *
 * Opens the HTML composition in a headless Chrome instance,
 * pauses the CSS animations, seeks each frame by adjusting
 * animation-delay, and saves each frame as a PNG.
 * The resulting image sequence is assembled into a video by ffmpeg.
 */

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import puppeteer, { type Browser } from "puppeteer-core";

export interface RenderFramesOptions {
  /** Absolute path to the HTML file */
  html: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  /** Directory to write frame PNGs into */
  outputDir: string;
  /** Called with (framesWritten, totalFrames) as each frame is saved */
  onProgress?: (written: number, total: number) => Promise<void> | void;
}

export interface RenderFramesResult {
  frameDir: string;
  frameCount: number;
  /** Pattern to pass to ffmpeg -i (e.g. /path/frames/frame_%06d.png) */
  frameGlob: string;
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

export async function renderFrames(opts: RenderFramesOptions): Promise<RenderFramesResult> {
  const { html, width, height, fps, duration, outputDir, onProgress } = opts;

  const executablePath = findChrome();
  if (!executablePath) {
    throw new Error(
      "找不到 Chrome 可执行文件。请安装 Google Chrome 或设置 CHROME_PATH 环境变量。"
    );
  }

  const totalFrames = Math.max(1, Math.round(duration * fps));
  const frameDir = path.join(outputDir, "frames");
  await mkdir(frameDir, { recursive: true });

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

    // Load the HTML file
    const fileUrl = `file:///${html.replace(/\\/g, "/")}`;
    await page.goto(fileUrl, { waitUntil: "load" });

    // Give fonts/styles a moment to load
    await page.evaluate(() => new Promise<void>((r) => setTimeout(r, 300)));

    // Pause all animations at t=0
    await page.evaluate(() => {
      const style = document.createElement("style");
      style.textContent = `* { animation-play-state: paused !important; }`;
      document.head.appendChild(style);
    });

    const sceneDuration = duration / Math.max(1, await page.evaluate(() =>
      document.querySelectorAll(".scene").length
    ));

    // Scrub and screenshot each frame
    for (let frame = 0; frame < totalFrames; frame++) {
      const timeSec = frame / fps;

      // Seek to this moment by adjusting each scene's animation-delay offset
      await page.evaluate(
        (t: number, singleDuration: number) => {
          const scenes = document.querySelectorAll<HTMLElement>(".scene");
          scenes.forEach((el, i) => {
            const sceneStart = i * singleDuration;
            // Make scene visible during its window, invisible otherwise
            const relativeT = t - sceneStart;
            el.style.setProperty("animation-delay", `${-relativeT}s`);
            el.style.setProperty("animation-duration", `${singleDuration}s`);
            el.style.setProperty("animation-play-state", "paused");
          });
        },
        timeSec,
        sceneDuration
      );

      const framePath = path.join(frameDir, `frame_${String(frame).padStart(6, "0")}.png`);
      await (page as any).screenshot({ path: framePath, type: "png" });
      await onProgress?.(frame + 1, totalFrames);
    }
  } finally {
    await browser?.close();
  }

  return {
    frameDir,
    frameCount: totalFrames,
    frameGlob: path.join(frameDir, "frame_%06d.png")
  };
}

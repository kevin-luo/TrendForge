import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoryboardScene } from "@trendforge/core";

export type SceneImageLogger = (entry: {
  level: "info" | "warn";
  message: string;
  context?: Record<string, unknown>;
}) => Promise<void> | void;

export type GenerateImageFn = (subject: string, outPath: string, seed: number) => Promise<string | undefined>;
export type SearchImageFn = (subject: string, outPath: string, seed: number, scene: StoryboardScene) => Promise<string | undefined>;

export type FetchSceneImagesOptions = {
  projectId: string;
  topic: string;
  assetDir: string;
  searchImage?: SearchImageFn;
  generateImage?: GenerateImageFn;
  log?: SceneImageLogger;
};

const FALLBACK_WIDTH = 1080;
const FALLBACK_HEIGHT = 1920;

export async function fetchSceneImages(scenes: StoryboardScene[], options: FetchSceneImagesOptions): Promise<StoryboardScene[]> {
  const generateImage = options.generateImage;
  const searchImage = options.searchImage;
  await mkdir(options.assetDir, { recursive: true });
  return Promise.all(
    scenes.map(async (scene, index) => {
      if (scene.image) return scene;
      const firstRenderableHint = scene.assetHints?.find((hint) => Boolean(hint?.trim()));
      if (firstRenderableHint) {
        await options.log?.({
          level: "info",
          message: "场景已有可用素材，提升为主视觉",
          context: { index, hint: firstRenderableHint, hints: scene.assetHints?.length ?? 0 }
        });
        return { ...scene, image: firstRenderableHint };
      }

      const subject = buildImageSubject(scene, options.topic);
      const searchPath = path.join(options.assetDir, `scene_${index}.jpg`);
      if (searchImage) {
        const searched = await searchImage(subject, searchPath, index + 1, scene);
        if (searched) {
          await options.log?.({
            level: "info",
            message: "DeepSeek 搜索图片成功",
            context: { index, path: searched }
          });
          return { ...scene, image: searched, assetHints: [...(scene.assetHints ?? []), searched] };
        }
      }

      if (generateImage) {
        const generated = await generateImage(subject, searchPath, index + 1);
        if (generated) {
          await options.log?.({
            level: "info",
            message: "场景外部配图生成成功",
            context: { index, path: generated }
          });
          return { ...scene, image: generated };
        }
      }

      await options.log?.({
        level: "warn",
        message: "外部配图生成失败，生成本地视觉卡片",
        context: { index, subject }
      });

      const svgPath = path.join(options.assetDir, `scene_${index}.svg`);
      const svg = buildSceneFallbackSvg({
        topic: options.topic,
        index,
        title: scene.title,
        body: scene.screenText,
        keywords: scene.keywords,
        visualDirection: scene.visualDirection
      });
      try {
        await writeFile(svgPath, svg, "utf8");
        await options.log?.({
          level: "info",
          message: "本地 SVG fallback 已生成",
          context: { index, path: svgPath }
        });
        return { ...scene, image: svgPath };
      } catch (error) {
        const inlineSvg = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
        await options.log?.({
          level: "warn",
          message: "本地 SVG 写入失败，改用内联 SVG",
          context: { index, error: error instanceof Error ? error.message : String(error) }
        });
        return { ...scene, image: inlineSvg };
      }
    })
  );
}

export function buildSceneFallbackSvg(input: {
  topic: string;
  index: number;
  title?: string;
  body?: string;
  keywords?: string[];
  visualDirection?: string;
}): string {
  const title = compactText(input.title || input.topic || "趋势视觉卡片", 48);
  const body = compactText(input.body || input.visualDirection || input.topic || "", 96);
  const keywords = uniqueStrings([
    input.topic,
    input.visualDirection ?? "",
    ...(input.keywords ?? [])
  ]).slice(0, 4);

  const titleLines = wrapLines(title, 18, 2);
  const bodyLines = wrapLines(body, 24, 3);
  const chipRows = keywords.map((keyword, index) => {
    const x = 72 + (index % 2) * 244;
    const y = 1210 + Math.floor(index / 2) * 92;
    return `
      <g transform="translate(${x}, ${y})">
        <rect x="0" y="0" width="220" height="56" rx="28" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.16)" />
        <text x="110" y="37" text-anchor="middle" font-family="Inter, 'Microsoft YaHei', sans-serif" font-size="24" fill="#F8FBFF">${escapeXml(compactText(keyword, 18))}</text>
      </g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${FALLBACK_WIDTH}" height="${FALLBACK_HEIGHT}" viewBox="0 0 ${FALLBACK_WIDTH} ${FALLBACK_HEIGHT}" role="img" aria-label="${escapeXml(title)}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#08111F" />
        <stop offset="45%" stop-color="#112B4A" />
        <stop offset="100%" stop-color="#1A0F2E" />
      </linearGradient>
      <radialGradient id="glowA" cx="30%" cy="20%" r="70%">
        <stop offset="0%" stop-color="#77C8FF" stop-opacity="0.68" />
        <stop offset="100%" stop-color="#77C8FF" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="glowB" cx="80%" cy="75%" r="60%">
        <stop offset="0%" stop-color="#FF7A59" stop-opacity="0.55" />
        <stop offset="100%" stop-color="#FF7A59" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="card" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.20" />
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.06" />
      </linearGradient>
      <filter id="softBlur" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="18" />
      </filter>
    </defs>
    <rect width="1080" height="1920" fill="url(#bg)" />
    <circle cx="260" cy="280" r="360" fill="url(#glowA)" filter="url(#softBlur)" opacity="0.92" />
    <circle cx="840" cy="1460" r="420" fill="url(#glowB)" filter="url(#softBlur)" opacity="0.86" />
    <path d="M0,1490 C220,1360 390,1340 560,1460 C730,1580 900,1600 1080,1480 L1080,1920 L0,1920 Z" fill="rgba(255,255,255,0.04)" />
    <path d="M-80,420 L1080,940" stroke="rgba(255,255,255,0.11)" stroke-width="10" />
    <path d="M-60,520 L960,0" stroke="rgba(255,255,255,0.08)" stroke-width="8" />
    <rect x="72" y="104" width="144" height="52" rx="26" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.18)" />
    <text x="144" y="138" text-anchor="middle" font-family="Inter, 'Microsoft YaHei', sans-serif" font-size="24" letter-spacing="2" fill="#EEF5FF">${escapeXml(`SCENE ${String(input.index + 1).padStart(2, "0")}`)}</text>
    <rect x="72" y="210" width="936" height="612" rx="44" fill="url(#card)" stroke="rgba(255,255,255,0.16)" />
    <g>
      ${titleLines.map((line, index) => `<text x="104" y="${308 + index * 72}" font-family="'Noto Serif CJK SC','Microsoft YaHei',serif" font-size="${index === 0 ? 68 : 60}" font-weight="700" fill="#FFFFFF">${escapeXml(line)}</text>`).join("")}
      ${bodyLines.map((line, index) => `<text x="104" y="${490 + index * 54}" font-family="Inter, 'Microsoft YaHei', sans-serif" font-size="34" fill="rgba(248,251,255,0.88)">${escapeXml(line)}</text>`).join("")}
    </g>
    <rect x="104" y="690" width="360" height="8" rx="4" fill="#77C8FF" opacity="0.78" />
    <rect x="104" y="722" width="268" height="8" rx="4" fill="#FF7A59" opacity="0.72" />
    <g opacity="0.88">
      ${chipRows}
    </g>
    <g opacity="0.72">
      <circle cx="880" cy="270" r="76" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="4" />
      <circle cx="880" cy="270" r="34" fill="rgba(255,255,255,0.18)" />
      <rect x="786" y="346" width="196" height="20" rx="10" fill="rgba(255,255,255,0.22)" />
      <rect x="786" y="380" width="146" height="20" rx="10" fill="rgba(255,255,255,0.14)" />
    </g>
  </svg>`;
}

function buildImageSubject(scene: StoryboardScene, topic: string): string {
  return [scene.title, scene.screenText, topic].filter(Boolean).join(", ").slice(0, 200);
}

export async function downloadImageToFile(url: string, outPath: string, timeoutMs = 15000): Promise<string | undefined> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1500) return undefined;
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, buf);
    return outPath;
  } catch {
    return undefined;
  }
}

async function defaultGenerateImage(subject: string, outPath: string, seed: number): Promise<string | undefined> {
  const promptText = encodeURIComponent(`${subject}. cinematic promotional poster illustration, clean composition, vibrant, high detail, no text, no watermark`.slice(0, 220));
  const url = `https://image.pollinations.ai/prompt/${promptText}?width=768&height=1024&nologo=true&seed=${seed}`;
  return downloadImageToFile(url, outPath, 28000);
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function compactText(value: string, limit: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => compactText(String(value ?? ""), 40))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function wrapLines(value: string, maxChars: number, maxLines: number): string[] {
  const tokens = value.split(/(?<=[。！？!?.,，、\s])/).map((part) => part.trim()).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const token of tokens.length ? tokens : [value]) {
    const candidate = current ? `${current}${token}` : token;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
      continue;
    }
    lines.push(current.trim());
    current = token;
    if (lines.length >= maxLines - 1) break;
  }
  if (current.trim() && lines.length < maxLines) lines.push(current.trim());
  const tail = value.replace(lines.join(""), "").trim();
  if (tail && lines.length < maxLines) lines.push(compactText(tail, maxChars));
  return lines.slice(0, maxLines);
}

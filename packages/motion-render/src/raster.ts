import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MotionGraph } from "@trendforge/motion-core";
import { renderMotionGraphFrameSvg, type RenderSvgOptions } from "./svg.js";

type SharpFactory = (input: Buffer) => { png(): { toBuffer(): Promise<Buffer> } };
type SharpModule = SharpFactory & { concurrency?: (threads: number) => void };

let sharpPromise: Promise<SharpFactory | null> | undefined;

/**
 * Load `sharp` lazily so the package stays usable (SVG only) on machines where
 * the optional native binary is missing. Resolution is intentionally tolerant.
 *
 * We pin libvips to 1 thread per operation: the frame sequencer already runs a
 * pool of N rasterizations concurrently, so per-image multithreading would only
 * oversubscribe the cores and slow the batch down.
 */
async function loadSharp(): Promise<SharpFactory | null> {
  sharpPromise ??= (async () => {
    try {
      const mod = (await import("sharp")) as unknown as { default: SharpModule };
      mod.default.concurrency?.(1);
      return mod.default;
    } catch {
      return null;
    }
  })();
  return sharpPromise;
}

export async function rasterizeSvgToPng(svg: string): Promise<Buffer | null> {
  const sharp = await loadSharp();
  if (!sharp) return null;
  return sharp(Buffer.from(svg, "utf8")).png().toBuffer();
}

export async function renderMotionGraphFramePng(
  graph: MotionGraph,
  frame: number,
  options: RenderSvgOptions = {}
): Promise<Buffer | null> {
  return rasterizeSvgToPng(renderMotionGraphFrameSvg(graph, frame, options));
}

export type WriteFrameResult = {
  frame: number;
  rasterized: boolean;
  pngPath?: string;
  svgPath: string;
  bytes: number;
};

/**
 * Write one frame to disk. Always emits the SVG (cheap, debuggable) and, when
 * sharp is available, the rasterized PNG next to it.
 */
export async function writeMotionGraphFrame(
  graph: MotionGraph,
  frame: number,
  filePathWithoutExt: string,
  options: RenderSvgOptions = {}
): Promise<WriteFrameResult> {
  await mkdir(path.dirname(filePathWithoutExt), { recursive: true });
  const svg = renderMotionGraphFrameSvg(graph, frame, options);
  const svgPath = `${filePathWithoutExt}.svg`;
  await writeFile(svgPath, svg, "utf8");

  const png = await rasterizeSvgToPng(svg);
  if (!png) {
    return { frame, rasterized: false, svgPath, bytes: Buffer.byteLength(svg, "utf8") };
  }
  const pngPath = `${filePathWithoutExt}.png`;
  await writeFile(pngPath, png);
  return { frame, rasterized: true, pngPath, svgPath, bytes: png.byteLength };
}

/** The frame at the visual "settle point" of a graph — past the entrance animation. */
export function goldenFrameFor(graph: MotionGraph): number {
  const settle = Math.round(graph.fps * 0.7);
  const mid = Math.round(graph.durationFrames * 0.5);
  return Math.min(graph.durationFrames - 1, Math.max(settle, mid));
}

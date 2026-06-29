import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { MotionGraph } from "@trendforge/motion-core";
import { renderMotionGraphFrameSvg, type RenderSvgOptions } from "./svg.js";
import { rasterizeSvgToPng } from "./raster.js";

export type RenderSequenceOptions = RenderSvgOptions & {
  /** Called as each frame is written, with the running global frame count and total. */
  onProgress?: (written: number, total: number) => void | Promise<void>;
  /**
   * Number of frames to rasterize concurrently. Frame filenames are globally
   * indexed, so out-of-order completion is harmless for ffmpeg. Defaults to the
   * CPU core count (capped at 8 to bound peak memory from in-flight PNGs).
   * Override with the MOTION_RENDER_CONCURRENCY env var.
   */
  concurrency?: number;
};

function defaultConcurrency(): number {
  const fromEnv = Number(process.env.MOTION_RENDER_CONCURRENCY);
  if (Number.isFinite(fromEnv) && fromEnv >= 1) return Math.floor(fromEnv);
  // Leave a couple of cores for the main thread / OS; cap to bound peak memory
  // from in-flight PNG buffers on very high-core machines.
  return Math.max(1, Math.min(os.cpus().length - 2, 16));
}

export type RenderSequenceResult = {
  frameDir: string;
  /** ffmpeg input pattern, e.g. <dir>/frame_%06d.png */
  frameGlob: string;
  frameCount: number;
  fps: number;
  /** Total video duration in seconds (sum of all graph durations). */
  duration: number;
  rasterized: boolean;
};

/**
 * Render a sequence of MotionGraphs (one per scene) into a flat PNG frame
 * sequence suitable for ffmpeg `framesToVideo`. Each graph contributes
 * `durationFrames` frames, numbered globally and continuously so the whole
 * film plays back at a single fps.
 *
 * Pure rendering: depends only on motion-core + sharp, never on ffmpeg.
 * If sharp is unavailable the SVGs are still written (rasterized=false) so the
 * failure is debuggable, but no usable PNG sequence is produced.
 */
export async function renderMotionGraphSequence(
  graphs: MotionGraph[],
  frameDir: string,
  options: RenderSequenceOptions = {}
): Promise<RenderSequenceResult> {
  if (!graphs.length) throw new Error("renderMotionGraphSequence: no graphs to render");
  const fps = graphs[0]!.fps;
  const total = graphs.reduce((sum, graph) => sum + graph.durationFrames, 0);

  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });

  const { onProgress, concurrency, ...svgOptions } = options;

  // Flatten (graph, localFrame) → a globally numbered frame list so the pipeline
  // can render frames in parallel while keeping continuous, ordered filenames.
  const frames: Array<{ graph: MotionGraph; local: number; globalFrame: number }> = [];
  let globalFrame = 0;
  for (const graph of graphs) {
    for (let local = 0; local < graph.durationFrames; local++) {
      frames.push({ graph, local, globalFrame: globalFrame++ });
    }
  }

  let rasterized = true;
  let written = 0;
  let next = 0;

  async function renderOne(frame: (typeof frames)[number]): Promise<void> {
    const svg = renderMotionGraphFrameSvg(frame.graph, frame.local, svgOptions);
    const png = await rasterizeSvgToPng(svg);
    const stem = path.join(frameDir, `frame_${String(frame.globalFrame).padStart(6, "0")}`);
    if (png) {
      await writeFile(`${stem}.png`, png);
    } else {
      rasterized = false;
      await writeFile(`${stem}.svg`, svg, "utf8");
    }
    written++;
    await onProgress?.(written, total);
  }

  // Bounded worker pool: each worker pulls the next frame index until the list
  // is drained. Rasterization (sharp/libvips) runs off the main thread, so N
  // workers keep N frames in flight across cores instead of one-at-a-time.
  const workers = Math.max(1, concurrency ?? defaultConcurrency());
  await Promise.all(
    Array.from({ length: Math.min(workers, frames.length) }, async () => {
      for (let index = next++; index < frames.length; index = next++) {
        await renderOne(frames[index]!);
      }
    })
  );

  return {
    frameDir,
    frameGlob: path.join(frameDir, "frame_%06d.png"),
    frameCount: total,
    fps,
    duration: total / fps,
    rasterized
  };
}

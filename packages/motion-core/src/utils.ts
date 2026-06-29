import type { Box, MotionGraph, VisualSceneSpec } from "./types.js";

export function motionSizeForRatio(ratio: VisualSceneSpec["ratio"]): { width: number; height: number } {
  if (ratio === "16:9") return { width: 1920, height: 1080 };
  if (ratio === "1:1") return { width: 1080, height: 1080 };
  if (ratio === "4:5") return { width: 1080, height: 1350 };
  if (ratio === "16:10") return { width: 1920, height: 1200 };
  if (ratio === "2.35:1") return { width: 2350, height: 1000 };
  return { width: 1080, height: 1920 };
}

export function defaultSafeAreas(ratio: VisualSceneSpec["ratio"]): VisualSceneSpec["safeAreas"] {
  const { width, height } = motionSizeForRatio(ratio);
  const portrait = height >= width;
  return {
    title: {
      x: Math.round(width * (portrait ? 0.06 : 0.05)),
      y: Math.round(height * (portrait ? 0.06 : 0.07)),
      width: Math.round(width * (portrait ? 0.88 : 0.55)),
      height: Math.round(height * (portrait ? 0.18 : 0.2))
    },
    action: {
      x: Math.round(width * (portrait ? 0.06 : 0.58)),
      y: Math.round(height * (portrait ? 0.24 : 0.13)),
      width: Math.round(width * (portrait ? 0.88 : 0.36)),
      height: Math.round(height * (portrait ? 0.56 : 0.72))
    },
    subtitle: {
      x: Math.round(width * (portrait ? 0.1 : 0.15)),
      y: Math.round(height * (portrait ? 0.83 : 0.82)),
      width: Math.round(width * (portrait ? 0.8 : 0.7)),
      height: Math.round(height * (portrait ? 0.12 : 0.12))
    }
  };
}

export function framesForSeconds(seconds: number, fps: number): number {
  return Math.max(1, Math.round(seconds * fps));
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function boxInside(inner: Box, outer: Box): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

export function estimateTextCapacity(box: Box, fontSize: number): number {
  const charsPerLine = Math.max(1, Math.floor(box.width / Math.max(1, fontSize * 0.62)));
  const lines = Math.max(1, Math.floor(box.height / Math.max(1, fontSize * 1.18)));
  return charsPerLine * lines;
}

export function flattenLayers(graph: MotionGraph) {
  const out = [graph.background];
  const visit = (layers: MotionGraph["layers"]) => {
    for (const layer of layers) {
      out.push(layer);
      if (layer.children?.length) visit(layer.children);
    }
  };
  visit(graph.layers);
  return out;
}

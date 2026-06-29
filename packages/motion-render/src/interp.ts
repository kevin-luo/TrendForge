import type { MotionKeyframe } from "@trendforge/motion-core";
import { ease } from "./easing.js";

/**
 * The resolved animatable transform for a layer at a given frame.
 * These are the only properties the renderer animates today; everything
 * else in a keyframe is treated as static style.
 */
export type LayerTransform = {
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
  rotate: number;
};

export const IDENTITY_TRANSFORM: LayerTransform = {
  opacity: 1,
  translateX: 0,
  translateY: 0,
  scale: 1,
  rotate: 0
};

const NUMERIC_KEYS = ["opacity", "translateX", "translateY", "scale", "rotate"] as const;

function defaultFor(key: (typeof NUMERIC_KEYS)[number]): number {
  return key === "opacity" || key === "scale" ? 1 : 0;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function resolveAt(kf: MotionKeyframe): LayerTransform {
  return {
    opacity: num(kf.properties.opacity, 1),
    translateX: num(kf.properties.translateX, 0),
    translateY: num(kf.properties.translateY, 0),
    scale: num(kf.properties.scale, 1),
    rotate: num(kf.properties.rotate, 0)
  };
}

/**
 * Sample the animated transform of a layer at an absolute frame.
 *
 * Mirrors the HyperFrames "virtual clock" idea: state is a pure function of
 * the current frame, so the same frame always yields the same transform.
 * Easing is taken from the destination keyframe of each segment (CSS-like).
 */
export function sampleTransform(keyframes: MotionKeyframe[] | undefined, frame: number): LayerTransform {
  if (!keyframes || keyframes.length === 0) return { ...IDENTITY_TRANSFORM };

  const sorted = keyframes.length === 1 ? keyframes : [...keyframes].sort((a, b) => a.frame - b.frame);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (frame <= first.frame) return resolveAt(first);
  if (frame >= last.frame) return resolveAt(last);

  let a = first;
  let b = last;
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i]!;
    const nxt = sorted[i + 1]!;
    if (frame >= cur.frame && frame <= nxt.frame) {
      a = cur;
      b = nxt;
      break;
    }
  }

  const span = Math.max(1, b.frame - a.frame);
  const t = ease(b.easing, (frame - a.frame) / span);
  const out: LayerTransform = { ...IDENTITY_TRANSFORM };
  for (const key of NUMERIC_KEYS) {
    const def = defaultFor(key);
    const va = num(a.properties[key], def);
    const vb = num(b.properties[key], def);
    out[key] = va + (vb - va) * t;
  }
  return out;
}

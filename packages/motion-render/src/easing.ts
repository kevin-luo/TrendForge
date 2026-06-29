import type { MotionEasing } from "@trendforge/motion-core";

export type EasingFn = (t: number) => number;

const backC1 = 1.70158;
const backC3 = backC1 + 1;

/**
 * Deterministic easing curves keyed by the MotionEasing enum.
 * Every curve maps a normalized time [0,1] onto an eased [0,1]-ish value.
 * `spring` and `back-out` intentionally overshoot before settling.
 */
export const easingFns: Record<MotionEasing, EasingFn> = {
  linear: (t) => t,
  "ease-in": (t) => t * t,
  "ease-out": (t) => 1 - (1 - t) * (1 - t),
  "ease-in-out": (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  "back-out": (t) => 1 + backC3 * Math.pow(t - 1, 3) + backC1 * Math.pow(t - 1, 2),
  "expo-out": (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  spring: (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return 1 - Math.exp(-6 * t) * Math.cos(t * Math.PI * 2.2);
  }
};

export function ease(easing: MotionEasing | undefined, t: number): number {
  const clamped = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return (easing ? easingFns[easing] : easingFns.linear)(clamped);
}

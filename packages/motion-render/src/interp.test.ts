import type { MotionKeyframe } from "@trendforge/motion-core";
import { describe, expect, it } from "vitest";
import { ease } from "./easing.js";
import { sampleTransform } from "./interp.js";
import { renderMotionGraphFrameSvg } from "./svg.js";

const enter: MotionKeyframe[] = [
  { frame: 0, properties: { opacity: 0, translateY: 28, scale: 0.96 }, easing: "ease-out" },
  { frame: 14, properties: { opacity: 1, translateY: 0, scale: 1 }, easing: "expo-out" }
];

describe("sampleTransform", () => {
  it("returns identity without keyframes", () => {
    expect(sampleTransform(undefined, 10)).toEqual({ opacity: 1, translateX: 0, translateY: 0, scale: 1, rotate: 0 });
  });

  it("clamps to the first keyframe before the start", () => {
    expect(sampleTransform(enter, -5)).toMatchObject({ opacity: 0, translateY: 28 });
  });

  it("clamps to the last keyframe after the end", () => {
    expect(sampleTransform(enter, 999)).toMatchObject({ opacity: 1, translateY: 0, scale: 1 });
  });

  it("interpolates monotonically across a segment", () => {
    const early = sampleTransform(enter, 3).opacity;
    const late = sampleTransform(enter, 11).opacity;
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(late);
    expect(late).toBeLessThanOrEqual(1);
  });
});

describe("ease", () => {
  it("pins endpoints", () => {
    for (const fn of ["linear", "ease-in", "ease-out", "ease-in-out", "back-out", "expo-out", "spring"] as const) {
      expect(ease(fn, 0)).toBeCloseTo(0, 5);
      expect(ease(fn, 1)).toBeCloseTo(1, 5);
    }
  });
});

describe("renderMotionGraphFrameSvg", () => {
  it("produces a sized svg with background and layers", () => {
    const svg = renderMotionGraphFrameSvg(
      {
        id: "g1",
        width: 1080,
        height: 1920,
        fps: 30,
        durationFrames: 120,
        background: { id: "background", kind: "shape", frame: { x: 0, y: 0, width: 1080, height: 1920 }, style: { tone: "depth-grid", themeId: "news-rank" } },
        layers: [
          { id: "title", kind: "text", frame: { x: 60, y: 100, width: 960, height: 160 }, content: "测试标题 Title", style: { fontSize: 64, fontWeight: 900 }, safeAreaRole: "title", keyframes: enter }
        ],
        captions: [],
        qualityRules: []
      },
      8
    );
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('width="1080"');
    expect(svg).toContain("测试标题");
    expect(svg).toContain("url(#darkBgGrad)");
  });
});

import { describe, expect, it } from "vitest";
import type { MotionGraph } from "@trendforge/motion-core";
import { lintMotionGraph } from "./lint.js";

describe("render lint", () => {
  it("reports subtitle safe area overlap and frame samples", () => {
    const graph: MotionGraph = {
      id: "graph_1",
      width: 1080,
      height: 1920,
      fps: 30,
      durationFrames: 120,
      background: { id: "background", kind: "shape", frame: { x: 0, y: 0, width: 1080, height: 1920 } },
      layers: [
        { id: "caption-safe-area", kind: "shape", safeAreaRole: "caption", frame: { x: 108, y: 1580, width: 864, height: 230 } },
        { id: "bad-title", kind: "text", content: "字幕区域里出现了画面文字", frame: { x: 120, y: 1600, width: 600, height: 90 }, style: { fontSize: 36 } }
      ],
      qualityRules: ["subtitle-safe-area", "text-overflow"]
    };
    const report = lintMotionGraph(graph);
    expect(report.issues.some((issue) => issue.id.includes("subtitle-overlap"))).toBe(true);
    expect(report.frameSamples).toHaveLength(5);
  });
});

import { describe, expect, it } from "vitest";
import { defaultSafeAreas } from "@trendforge/motion-core";
import { buildMotionGraph } from "./builder.js";

describe("motion presets", () => {
  it("builds a rank-race motion graph with caption safe area", () => {
    const graph = buildMotionGraph({
      id: "spec_1",
      sceneId: "scene_1",
      shotId: "shot_1",
      ratio: "9:16",
      duration: 4,
      visualType: "rank-race",
      contentSlots: { headline: "今日 AI 产品信号", chips: ["VectorPilot", "ShipPulse", "PromptDesk"] },
      motion: { pace: "fast", camera: "push-in", transitionIn: "flash", transitionOut: "whip", beatSync: true, intensity: 4 },
      style: { themeId: "tech-signal", typography: "bold-news", density: "high" },
      safeAreas: defaultSafeAreas("9:16")
    });
    expect(graph.layers.some((layer) => layer.id === "caption-safe-area")).toBe(true);
    expect(graph.layers.length).toBeGreaterThan(2);
  });
});

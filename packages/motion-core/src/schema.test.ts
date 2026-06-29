import { describe, expect, it } from "vitest";
import { motionGraphSchema, visualSceneSpecSchema } from "./schemas.js";
import { defaultSafeAreas, motionSizeForRatio } from "./utils.js";

describe("motion-core schemas", () => {
  it("validates a visual scene spec", () => {
    const spec = visualSceneSpecSchema.parse({
      id: "spec_1",
      sceneId: "scene_1",
      shotId: "shot_1",
      ratio: "9:16",
      duration: 4,
      visualType: "rank-race",
      contentSlots: {
        headline: "今日 AI 产品信号",
        chips: ["效率", "低成本"],
        assets: [{ role: "illustration", src: "https://example.com/asset.png", source: "generated" }]
      },
      motion: { pace: "fast", camera: "push-in", transitionIn: "flash", transitionOut: "whip", beatSync: true, intensity: 4 },
      style: { themeId: "tech-signal", typography: "bold-news", density: "high" },
      safeAreas: defaultSafeAreas("9:16")
    });
    expect(spec.visualType).toBe("rank-race");
  });

  it("validates a motion graph", () => {
    const size = motionSizeForRatio("9:16");
    const graph = motionGraphSchema.parse({
      id: "graph_1",
      ...size,
      fps: 30,
      durationFrames: 120,
      background: { id: "bg", kind: "shape", frame: { x: 0, y: 0, ...size } },
      layers: [
        {
          id: "title",
          kind: "text",
          frame: { x: 80, y: 120, width: 800, height: 140 },
          content: "今日 AI 产品信号",
          safeAreaRole: "title"
        }
      ],
      qualityRules: ["subtitle-safe-area", "text-overflow"]
    });
    expect(graph.layers).toHaveLength(1);
  });
});

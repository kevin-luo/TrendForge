import { describe, expect, it } from "vitest";
import type { StoryboardScene, VideoStoryboard } from "@trendforge/core";
import { createMotionDirectorPlan, storyboardToVisualSpecs } from "./director.js";

describe("motion director", () => {
  it("creates visual specs and motion graphs from a storyboard", () => {
    const storyboard: VideoStoryboard = {
      title: "今日 AI 产品信号",
      subtitle: "Product Hunt",
      source: "product_hunt",
      language: "zh",
      ratio: "9:16",
      durationTarget: 4,
      scenes: [
        {
          id: "scene_1",
          type: "overview",
          duration: 4,
          title: "本期总览",
          screenText: "#1 VectorPilot / #2 ShipPulse",
          narrationTextZh: "先看完整榜单。",
          narrationTextEn: "First scan the list.",
          subtitleZh: "先看完整榜单。",
          subtitleEn: "First scan the list.",
          visualDirection: "rank",
          shots: [
            {
              id: "shot_1",
              start: 0,
              duration: 4,
              beat: "扫榜",
              onScreenText: "今日 AI 产品信号",
              camera: "push-in",
              transitionIn: "flash",
              transitionOut: "whip",
              pace: "snap",
              broll: [{ query: "AI tools", mood: "product", source: "generated", fallbackVisual: "rank-board" }]
            }
          ]
        }
      ],
      products: [],
      subtitleTracks: []
    };
    const plan = createMotionDirectorPlan(storyboard);
    expect(plan.designPlan.sceneDesigns).toHaveLength(1);
    expect(plan.specs[0]?.designPlanId).toBe(plan.designPlan.id);
    expect(plan.specs[0]?.templateId).toContain("trendforge.");
    expect(plan.graphs[0]?.provenance?.sourceDesignPlanId).toBe(plan.designPlan.id);
    expect(plan.graphs[0]?.layers.length).toBeGreaterThan(2);
  });

  it("differentiates repeated headlines so scenes never render identically", () => {
    const scene = (id: string, title: string): StoryboardScene => ({
      id,
      type: "item",
      duration: 3,
      title,
      screenText: title,
      narrationTextZh: "",
      narrationTextEn: "",
      subtitleZh: "",
      subtitleEn: "",
      visualDirection: ""
    });
    const storyboard: VideoStoryboard = {
      title: "今日 AI 热点",
      subtitle: "",
      source: "manual",
      language: "zh",
      ratio: "9:16",
      durationTarget: 9,
      // Three scenes with the SAME title — the exact "repeated copy" case.
      scenes: [scene("s1", "今日 AI 热点"), scene("s2", "今日 AI 热点"), scene("s3", "今日 AI 热点")],
      products: [],
      subtitleTracks: []
    };
    const specs = storyboardToVisualSpecs(storyboard);
    const headlines = specs.map((spec) => spec.contentSlots.headline);
    expect(new Set(headlines).size).toBe(specs.length); // all unique
    expect(headlines[0]).toBe("今日 AI 热点"); // first kept as-is
  });

  it("builds role-based asset slots from storyboard images, hints, and product assets", () => {
    const storyboard: VideoStoryboard = {
      title: "素材测试",
      subtitle: "",
      source: "product_hunt",
      language: "zh",
      ratio: "9:16",
      durationTarget: 4,
      scenes: [
        {
          id: "scene_1",
          type: "product",
          duration: 4,
          title: "Product One",
          screenText: "Product One",
          narrationTextZh: "",
          narrationTextEn: "",
          subtitleZh: "",
          subtitleEn: "",
          visualDirection: "",
          productRank: 1,
          image: "scene-illustration.png",
          assetHints: ["local-fallback.png"],
          metadata: { imageRole: "hero" }
        } as StoryboardScene
      ],
      products: [
        {
          rank: 1,
          name: "Product One",
          tagline: "",
          oneLineZh: "",
          oneLineEn: "",
          highlightsZh: [],
          highlightsEn: [],
          whyInterestingZh: "",
          whyInterestingEn: "",
          screenshotPath: "product-shot.png",
          thumbnailPath: "product-thumb.png",
          logoPath: "product-logo.png"
        }
      ],
      subtitleTracks: []
    };

    const specs = storyboardToVisualSpecs(storyboard);
    const roles = specs[0]?.contentSlots.assets?.map((asset) => asset.role) ?? [];
    expect(roles).toEqual(expect.arrayContaining(["hero", "illustration", "screenshot", "thumbnail", "logo"]));
    expect(specs[0]?.contentSlots.assets?.find((asset) => asset.role === "hero")?.source).toBe("generated");
    expect(specs[0]?.contentSlots.assets?.find((asset) => asset.role === "screenshot")?.source).toBe("product_asset");
  });
});

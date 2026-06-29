import { describe, expect, it } from "vitest";
import type { VideoStoryboard } from "@trendforge/core";
import { defaultSafeAreas, motionDesignPlanSchema, type VisualSceneSpec } from "@trendforge/motion-core";
import { createLocalMotionDesignPlan } from "@trendforge/motion-director";
import { motionPresetManifests } from "@trendforge/motion-presets";
import { LocalMotionDesignProvider, coerceMotionDesignPlan, hasDesignSignal } from "./motion-design.js";

const SPEC: VisualSceneSpec = {
  id: "spec_1",
  sceneId: "scene_1",
  shotId: "shot_1",
  ratio: "9:16",
  duration: 3,
  visualType: "rank-race",
  contentSlots: { headline: "本期 3 个值得关注的新产品", entities: ["VectorPilot", "ShipPulse"] },
  motion: { pace: "snap", camera: "push-in", transitionIn: "flash", transitionOut: "whip", beatSync: true, intensity: 5 },
  style: { themeId: "paper-ink", typography: "bold-news", density: "high" },
  safeAreas: defaultSafeAreas("9:16")
};

const STORYBOARD: VideoStoryboard = {
  title: "AI 产品信号",
  subtitle: "Product Hunt",
  source: "product_hunt",
  language: "zh",
  ratio: "9:16",
  durationTarget: 3,
  scenes: [],
  products: [],
  subtitleTracks: [],
  candidate: "a",
  theme: "paper-ink"
};

describe("motion design provider", () => {
  it("creates a local MotionDesignPlan with scene-level design decisions", async () => {
    const provider = new LocalMotionDesignProvider();
    const plan = await provider.generate({ storyboard: STORYBOARD, candidate: "a", templates: motionPresetManifests, specs: [SPEC] });
    expect(plan.designSystem.source).toBe("open-design");
    expect(plan.designSystem.themeId).toMatch(/^od-/);
    expect(plan.sceneDesigns[0]?.templateId).toContain("trendforge.");
  });

  it("detects whether an LLM payload carries a design signal", () => {
    expect(hasDesignSignal({})).toBe(false);
    expect(hasDesignSignal({ foo: 1 })).toBe(false);
    expect(hasDesignSignal({ designSystem: { themeId: "paper-ink" } })).toBe(true);
    expect(hasDesignSignal({ sceneDesigns: [{ sceneId: "scene_1" }] })).toBe(true);
  });

  it("coerces a loose/partial LLM payload into a schema-valid plan (the structure-validation fix)", () => {
    const base = createLocalMotionDesignPlan({ storyboard: STORYBOARD, specs: [SPEC], candidate: "a" });
    // Deliberately loose: missing most fields, out-of-range typographyScale, a
    // bogus visualType — exactly the shape that used to throw "动态设计结构校验失败".
    const loose = {
      designSystem: { themeId: "paper-ink", palette: { accents: ["#111111", "#F05A28", "#1B3A8A"] } },
      sceneDesigns: [{ sceneId: "scene_1", shotId: "shot_1", accentIndex: 2, typographyScale: 5, visualType: "totally-bogus", emphasisWords: ["VectorPilot"] }]
    };
    const merged = coerceMotionDesignPlan(loose, base);
    // The merged plan now passes the strict schema.
    expect(motionDesignPlanSchema.safeParse(merged).success).toBe(true);
    expect(merged.generatedBy).toBe("deepseek");
    // LLM creative choices are honored…
    expect(merged.designSystem.themeId).toBe("paper-ink");
    expect(merged.designSystem.palette.accents).toEqual(["#111111", "#F05A28", "#1B3A8A"]);
    expect(merged.sceneDesigns[0]?.accentIndex).toBe(2);
    expect(merged.sceneDesigns[0]?.emphasisWords).toEqual(["VectorPilot"]);
    // …while invalid values are normalized/clamped instead of failing.
    expect(merged.sceneDesigns[0]?.typographyScale).toBeLessThanOrEqual(1.35);
    // A bogus enum falls back to the (valid) base value rather than failing.
    expect(merged.sceneDesigns[0]?.visualType).not.toBe("totally-bogus");
    expect(merged.sceneDesigns[0]?.visualType).toBe(base.sceneDesigns[0]?.visualType);
  });
});

import { describe, expect, it } from "vitest";
import { contentGraphSchema, motionDesignPlanSchema, motionEngineAdapterSpecSchema, motionTemplateManifestSchema } from "./schemas.js";

describe("motion-core manifest schemas", () => {
  it("validates engine adapter metadata", () => {
    const adapter = motionEngineAdapterSpecSchema.parse({
      id: "motion-render",
      label: "TrendForge Motion Render",
      description: "MotionGraph frame renderer.",
      status: "ready",
      input: "motion-graph",
      outputFormats: ["mp4", "png-sequence"],
      localRender: true,
      requiresBrowser: false,
      deterministic: true,
      renderContract: "render(input, context)",
      bestFor: ["matrix videos"]
    });
    expect(adapter.deterministic).toBe(true);
  });

  it("validates a template manifest", () => {
    const manifest = motionTemplateManifestSchema.parse({
      specVersion: 1,
      id: "trendforge.rank-race",
      name: "Rank Race",
      description: "榜单赛道模板",
      category: "ranking",
      tags: ["榜单"],
      bestFor: ["Product Hunt Top 5"],
      engine: "motion-render",
      visualType: "rank-race",
      output: {
        formats: ["mp4", "png-sequence"],
        defaultFormat: "mp4",
        supportedAspects: ["9:16", "16:9"],
        fps: { min: 24, max: 60, default: 30 },
        duration: { minSeconds: 2, maxSeconds: 8, defaultSeconds: 4 },
        alpha: false,
        audio: "optional"
      },
      inputs: { schema: { type: "object" }, required: ["contentSlots"] },
      license: { spdx: "Apache-2.0", attributionRequired: false, redistributionAllowed: true, commercialUse: true }
    });
    expect(manifest.visualType).toBe("rank-race");
  });

  it("validates content graph provenance", () => {
    const graph = contentGraphSchema.parse({
      id: "cg_1",
      title: "AI 产品信号",
      nodes: [
        { id: "topic", kind: "topic", label: "今日 AI 产品信号" },
        { id: "product_1", kind: "product", label: "VectorPilot", sourceRef: { type: "api", uri: "product-hunt", confidence: 0.8 } },
        { id: "scene_1", kind: "scene", label: "榜单开场" }
      ],
      edges: [
        { id: "e1", from: "topic", to: "product_1", kind: "supports", weight: 0.7 },
        { id: "e2", from: "product_1", to: "scene_1", kind: "renders-to" }
      ],
      entryNodeIds: ["topic"],
      templateHints: ["trendforge.rank-race"]
    });
    expect(graph.edges.map((edge) => edge.kind)).toContain("renders-to");
  });

  it("validates an AI motion design plan", () => {
    const plan = motionDesignPlanSchema.parse({
      id: "design_1",
      name: "Paper Ink Signal",
      generatedBy: "deepseek",
      designSystem: {
        id: "paper-ink.frame-md",
        name: "Paper Ink Signal",
        source: "frame-md",
        themeId: "paper-ink",
        stylePrompt: "Warm paper, black ink, hard borders and kinetic editorial motion.",
        palette: {
          background: "#F6F0DF",
          surface: "#FFFDF4",
          ink: "#121212",
          muted: "#6C6454",
          accents: ["#F7E25B", "#F05A28"]
        },
        typography: {
          display: "Noto Serif CJK SC",
          body: "Inter",
          mono: "IBM Plex Mono",
          headlineWeight: 950,
          bodyWeight: 760
        },
        frameRules: ["Start from a strong hero frame"],
        motionRules: ["Use staggered poster-pop motion"],
        qualityRules: ["Keep subtitles in the reserved safe area"]
      },
      sceneDesigns: [
        {
          id: "scene_design_1",
          sceneId: "scene_1",
          shotId: "shot_1",
          templateId: "trendforge.rank-race.poster-stack",
          visualType: "rank-race",
          layoutVariant: "poster-stack",
          accentIndex: 1,
          typographyScale: 1.05,
          density: "high",
          rotation: -2,
          decor: "editorial",
          motionSignature: "poster-pop",
          emphasisWords: ["VectorPilot"]
        }
      ]
    });
    expect(plan.sceneDesigns[0]?.layoutVariant).toBe("poster-stack");
  });
});

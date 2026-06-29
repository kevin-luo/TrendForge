import type { VideoStoryboard } from "@trendforge/core";
import type {
  MotionDecorLevel,
  MotionDesignPlan,
  MotionFrameDesignSystem,
  MotionSceneDesign,
  MotionSceneLayoutVariant,
  MotionSignature,
  VisualSceneSpec,
  VisualType
} from "@trendforge/motion-core";
import { openDesignSystemFor } from "@trendforge/motion-presets";

export type MotionDesignPlanInput = {
  storyboard: VideoStoryboard;
  specs: VisualSceneSpec[];
  candidate?: "a" | "b" | "c";
};

export function createLocalMotionDesignPlan(input: MotionDesignPlanInput): MotionDesignPlan {
  const seed = hash(`${input.storyboard.title}:${input.candidate ?? input.storyboard.candidate ?? "a"}:${input.storyboard.theme ?? ""}`);
  const designSystem = designSystemFor(input.storyboard, input.candidate, seed);
  const sceneDesigns = input.specs.map((spec, index) => sceneDesignFor(spec, designSystem, seed + index * 97));
  return {
    id: `design_${toBase36(seed)}`,
    name: `${designSystem.name} · ${input.storyboard.title}`,
    generatedBy: "local-fallback",
    designSystem,
    sceneDesigns,
    sourceRefs: [
      { label: "TrendForge local design director" },
      { label: "nexu-io/open-design", uri: "https://github.com/nexu-io/open-design" }
    ],
    promptDigest: toBase36(seed),
    createdAt: new Date(0).toISOString()
  };
}

export function applyMotionDesignPlan(specs: VisualSceneSpec[], plan: MotionDesignPlan): VisualSceneSpec[] {
  return specs.map((spec, index) => {
    const sceneDesign = findSceneDesign(plan, spec) ?? sceneDesignFor(spec, plan.designSystem, hash(`${plan.id}:${spec.id}:${index}`));
    return {
      ...spec,
      designPlanId: plan.id,
      templateId: sceneDesign.templateId,
      visualType: sceneDesign.visualType,
      design: sceneDesign,
      style: {
        ...spec.style,
        themeId: plan.designSystem.themeId,
        density: sceneDesign.density,
        typography: isEditorialSystem(plan.designSystem.themeId) ? "bold-news" : spec.style.typography
      }
    };
  });
}

function findSceneDesign(plan: MotionDesignPlan, spec: VisualSceneSpec): MotionSceneDesign | undefined {
  return plan.sceneDesigns.find((item) => item.sceneId === spec.sceneId && item.shotId === spec.shotId)
    ?? plan.sceneDesigns.find((item) => item.sceneId === spec.sceneId)
    ?? plan.sceneDesigns.find((item) => item.visualType === spec.visualType);
}

function designSystemFor(storyboard: VideoStoryboard, candidate: "a" | "b" | "c" | undefined, seed: number): MotionFrameDesignSystem {
  const id = candidate ?? storyboard.candidate ?? "a";
  const openDesign = openDesignSystemFor(id, seed);
  const { origin, bestFor, templateBias, styleTags, slug, ...designSystem } = openDesign;
  void origin;
  void bestFor;
  void templateBias;
  void styleTags;
  void slug;
  return {
    ...designSystem,
    id: `${openDesign.id}.${toBase36(seed % 4096)}`
  };
}

function isEditorialSystem(themeId: string): boolean {
  return themeId === "paper-ink" || themeId.startsWith("od-");
}

function sceneDesignFor(spec: VisualSceneSpec, system: MotionFrameDesignSystem, seed: number): MotionSceneDesign {
  const visualType = visualTypeFor(spec.visualType, seed);
  return {
    id: `scene_design_${toBase36(hash(`${spec.id}:${system.id}:${seed}`))}`,
    sceneId: spec.sceneId,
    shotId: spec.shotId,
    templateId: `trendforge.${visualType}.${layoutVariantFor(visualType, seed)}`,
    visualType,
    layoutVariant: layoutVariantFor(visualType, seed),
    accentIndex: seed % 5,
    typographyScale: 0.92 + ((seed % 7) * 0.035),
    density: densityFor(seed, spec.style.density),
    rotation: ((seed % 9) - 4) * 0.8,
    decor: decorFor(seed),
    motionSignature: motionSignatureFor(visualType, seed),
    emphasisWords: emphasisWordsFor(spec),
    rationale: `${visualType} · ${system.name}`
  };
}

function visualTypeFor(base: VisualType, seed: number): VisualType {
  const alternates: Partial<Record<VisualType, VisualType[]>> = {
    "rank-race": ["rank-race", "data-pulse", "workflow-orbit"],
    "product-workspace": ["product-workspace", "split-compare", "workflow-orbit"],
    "data-pulse": ["data-pulse", "rank-race", "workflow-orbit"],
    "creator-desk": ["creator-desk", "product-workspace", "timeline-rail"],
    "whiteboard-explain": ["whiteboard-explain", "workflow-orbit", "data-pulse"]
  };
  const list = alternates[base] ?? [base];
  return list[seed % list.length] ?? base;
}

function layoutVariantFor(visualType: VisualType, seed: number): MotionSceneLayoutVariant {
  const map: Record<VisualType, MotionSceneLayoutVariant[]> = {
    "rank-race": ["poster-stack", "data-magazine", "kinetic-type"],
    "product-workspace": ["interface-depth", "split-editorial", "poster-stack"],
    "news-evidence-wall": ["evidence-grid", "split-editorial", "poster-stack"],
    "data-pulse": ["data-magazine", "kinetic-type", "poster-stack"],
    "timeline-rail": ["timeline-broadside", "evidence-grid", "poster-stack"],
    "workflow-orbit": ["workflow-map", "split-editorial", "kinetic-type"],
    "creator-desk": ["interface-depth", "poster-stack", "workflow-map"],
    "split-compare": ["split-editorial", "evidence-grid", "data-magazine"],
    "whiteboard-explain": ["workflow-map", "timeline-broadside", "split-editorial"]
  };
  const list = map[visualType];
  return list[seed % list.length] ?? "poster-stack";
}

function densityFor(seed: number, fallback: VisualSceneSpec["style"]["density"]) {
  const values = ["low", "medium", "high"] as const;
  return values[seed % values.length] ?? fallback;
}

function decorFor(seed: number): MotionDecorLevel {
  const values = ["minimal", "editorial", "maximal"] as const;
  return values[seed % values.length] ?? "editorial";
}

function motionSignatureFor(visualType: VisualType, seed: number): MotionSignature {
  if (visualType === "data-pulse") return "data-tick";
  if (visualType === "workflow-orbit") return "orbit-sweep";
  const values = ["snap-stagger", "poster-pop", "kinetic-slam", "soft-reveal"] as const;
  return values[seed % values.length] ?? "poster-pop";
}

function emphasisWordsFor(spec: VisualSceneSpec): string[] {
  return Array.from(new Set([
    spec.contentSlots.product?.name,
    ...(spec.contentSlots.entities ?? []),
    ...(spec.contentSlots.chips ?? []),
    spec.contentSlots.headline
  ].filter((value): value is string => Boolean(value?.trim())))).slice(0, 6);
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function toBase36(value: number): string {
  return Math.abs(value).toString(36);
}

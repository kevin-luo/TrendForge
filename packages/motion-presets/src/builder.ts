import type { MotionGraph, MotionLayer, VisualSceneSpec } from "@trendforge/motion-core";
import { framesForSeconds, motionSizeForRatio } from "@trendforge/motion-core";
import { manifestForVisualType } from "./manifest.js";
import { presetFor } from "./presets.js";

export type BuildMotionGraphOptions = {
  fps?: number;
  graphId?: string;
};

export function buildMotionGraph(spec: VisualSceneSpec, options: BuildMotionGraphOptions = {}): MotionGraph {
  const fps = options.fps ?? 30;
  const size = motionSizeForRatio(spec.ratio);
  const durationFrames = framesForSeconds(spec.duration, fps);
  const preset = presetFor(spec.visualType);
  const manifest = manifestForVisualType(spec.visualType);
  const layers = withCaptionReserved(preset.build(spec, fps), spec);
  return {
    id: options.graphId ?? `graph_${spec.id}`,
    width: size.width,
    height: size.height,
    fps,
    durationFrames,
    engine: spec.engine ?? manifest.engine,
    templateId: spec.templateId ?? manifest.id,
    provenance: {
      visualSpecId: spec.id,
      contentGraphNodeId: spec.contentGraphNodeId,
      sourceTemplateId: manifest.id,
      sourceDesignPlanId: spec.designPlanId,
      generatedBy: "@trendforge/motion-presets"
    },
    sourceSpecId: spec.id,
    background: {
      id: "background",
      kind: "shape",
      frame: { x: 0, y: 0, width: size.width, height: size.height },
      style: { tone: "depth-grid", themeId: spec.style.themeId }
    },
    layers,
    captions: [],
    qualityRules: [
      "subtitle-safe-area",
      "text-overflow",
      "contrast",
      "motion-energy",
      "scene-variety",
      "caption-density",
      "brand-consistency",
      "golden-frame"
    ]
  };
}

function withCaptionReserved(layers: MotionLayer[], spec: VisualSceneSpec): MotionLayer[] {
  return [
    ...layers,
    {
      id: "caption-safe-area",
      kind: "shape",
      frame: spec.safeAreas.subtitle,
      style: { tone: "reserved-caption", opacity: 0 },
      safeAreaRole: "caption"
    }
  ];
}

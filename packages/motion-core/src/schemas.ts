import { z } from "zod";

export const boxSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive(),
  height: z.number().positive()
});

export const visualTypeSchema = z.enum([
  "rank-race",
  "product-workspace",
  "news-evidence-wall",
  "data-pulse",
  "timeline-rail",
  "workflow-orbit",
  "creator-desk",
  "split-compare",
  "whiteboard-explain"
]);

export const motionEngineIdSchema = z.enum(["motion-render", "remotion", "hyperframes", "motion-canvas", "revideo", "manim", "custom"]);
export const motionEngineStatusSchema = z.enum(["ready", "experimental", "planned", "disabled"]);
export const motionEngineInputKindSchema = z.enum(["motion-graph", "html-frame", "react-composition", "canvas-program", "python-scene"]);
export const motionOutputFormatSchema = z.enum(["mp4", "webm", "mov", "png-sequence", "gif"]);
export const ratioSchema = z.enum(["9:16", "16:9", "1:1", "4:5", "16:10", "2.35:1", "custom"]);

export const motionEngineAdapterSpecSchema = z.object({
  id: motionEngineIdSchema,
  label: z.string().min(1),
  description: z.string().min(1),
  status: motionEngineStatusSchema,
  input: motionEngineInputKindSchema,
  outputFormats: z.array(motionOutputFormatSchema).min(1),
  localRender: z.boolean(),
  requiresBrowser: z.boolean(),
  deterministic: z.boolean(),
  renderContract: z.literal("render(input, context)"),
  bestFor: z.array(z.string().min(1)).min(1),
  limitations: z.array(z.string().min(1)).optional()
});

export const motionTemplateManifestSchema = z.object({
  specVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string().min(1)),
  bestFor: z.array(z.string().min(1)).min(1),
  engine: motionEngineIdSchema,
  visualType: visualTypeSchema.optional(),
  output: z.object({
    formats: z.array(motionOutputFormatSchema).min(1),
    defaultFormat: motionOutputFormatSchema,
    supportedAspects: z.array(ratioSchema).min(1),
    fps: z.object({
      min: z.number().int().positive(),
      max: z.number().int().positive(),
      default: z.number().int().positive()
    }),
    duration: z.object({
      minSeconds: z.number().positive(),
      maxSeconds: z.number().positive(),
      defaultSeconds: z.number().positive()
    }),
    alpha: z.boolean(),
    audio: z.enum(["none", "optional", "required"])
  }),
  inputs: z.object({
    schema: z.unknown(),
    required: z.array(z.string().min(1)).optional(),
    examples: z.array(z.unknown()).optional()
  }),
  license: z.object({
    spdx: z.string().min(1),
    attributionRequired: z.boolean(),
    redistributionAllowed: z.boolean(),
    commercialUse: z.boolean(),
    sourceUrl: z.string().url().optional(),
    author: z.string().min(1).optional()
  }),
  provenance: z.object({
    upstreamProject: z.string().min(1).optional(),
    upstreamUrl: z.string().url().optional(),
    notes: z.string().min(1).optional()
  }).optional(),
  preview: z.object({
    poster: z.string().min(1).optional(),
    sampleFrames: z.array(z.string().min(1)).optional()
  }).optional(),
  performance: z.object({
    referenceRenderSeconds: z.number().positive().optional(),
    referenceFrames: z.number().int().positive().optional(),
    machine: z.string().min(1).optional()
  }).optional()
});

export const motionFrameDesignSourceSchema = z.enum(["deepseek", "local-fallback", "user", "design-md", "frame-md", "open-design"]);
export const motionSceneLayoutVariantSchema = z.enum([
  "poster-stack",
  "split-editorial",
  "data-magazine",
  "kinetic-type",
  "interface-depth",
  "evidence-grid",
  "timeline-broadside",
  "workflow-map"
]);
export const motionDecorLevelSchema = z.enum(["minimal", "editorial", "maximal"]);
export const motionSignatureSchema = z.enum(["snap-stagger", "poster-pop", "kinetic-slam", "soft-reveal", "data-tick", "orbit-sweep"]);
export const assetSlotRoleSchema = z.enum(["hero", "background", "logo", "screenshot", "illustration", "texture", "diagram", "thumbnail"]);
export const assetSlotSourceSchema = z.enum(["product_asset", "generated", "manual", "local"]);

export const assetSlotSchema = z.object({
  role: assetSlotRoleSchema,
  src: z.string().min(1),
  source: assetSlotSourceSchema
});

export const motionFrameDesignSystemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: motionFrameDesignSourceSchema,
  themeId: z.string().min(1),
  stylePrompt: z.string().min(1),
  palette: z.object({
    background: z.string().min(1),
    surface: z.string().min(1),
    ink: z.string().min(1),
    muted: z.string().min(1),
    accents: z.array(z.string().min(1)).min(1)
  }),
  typography: z.object({
    display: z.string().min(1),
    body: z.string().min(1),
    mono: z.string().min(1),
    headlineWeight: z.number().int().min(100).max(1000),
    bodyWeight: z.number().int().min(100).max(1000)
  }),
  frameRules: z.array(z.string().min(1)).min(1),
  motionRules: z.array(z.string().min(1)).min(1),
  qualityRules: z.array(z.string().min(1)).min(1)
});

export const motionSceneDesignSchema = z.object({
  id: z.string().min(1),
  sceneId: z.string().min(1),
  shotId: z.string().min(1),
  templateId: z.string().min(1),
  visualType: visualTypeSchema,
  layoutVariant: motionSceneLayoutVariantSchema,
  accentIndex: z.number().int().min(0),
  typographyScale: z.number().min(0.75).max(1.35),
  density: z.enum(["low", "medium", "high"]),
  rotation: z.number().min(-12).max(12),
  decor: motionDecorLevelSchema,
  motionSignature: motionSignatureSchema,
  emphasisWords: z.array(z.string().min(1)).max(8),
  rationale: z.string().optional()
});

export const motionDesignPlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  generatedBy: motionFrameDesignSourceSchema,
  designSystem: motionFrameDesignSystemSchema,
  sceneDesigns: z.array(motionSceneDesignSchema).min(1),
  sourceRefs: z.array(z.object({ label: z.string().min(1), uri: z.string().optional() })).optional(),
  promptDigest: z.string().optional(),
  createdAt: z.string().optional()
});

export const contentGraphNodeKindSchema = z.enum(["topic", "source", "trend", "product", "claim", "data", "quote", "scene", "shot", "caption", "asset", "style"]);
export const contentGraphEdgeKindSchema = z.enum(["sequence", "depends-on", "supports", "contrasts", "expands", "summarizes", "cites", "styles", "renders-to"]);

export const contentGraphSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  nodes: z.array(z.object({
    id: z.string().min(1),
    kind: contentGraphNodeKindSchema,
    label: z.string().min(1),
    summary: z.string().optional(),
    payload: z.record(z.unknown()).optional(),
    sourceRef: z.object({
      type: z.enum(["url", "project", "manual", "api", "file"]),
      uri: z.string().optional(),
      projectId: z.string().optional(),
      confidence: z.number().min(0).max(1).optional()
    }).optional()
  })).min(1),
  edges: z.array(z.object({
    id: z.string().min(1),
    from: z.string().min(1),
    to: z.string().min(1),
    kind: contentGraphEdgeKindSchema,
    weight: z.number().min(0).max(1).optional(),
    note: z.string().optional()
  })),
  entryNodeIds: z.array(z.string().min(1)).optional(),
  templateHints: z.array(z.string().min(1)).optional(),
  sourceProjectId: z.string().optional(),
  createdAt: z.string().optional()
});

export const visualSceneSpecSchema = z.object({
  id: z.string().min(1),
  sceneId: z.string().min(1),
  shotId: z.string().min(1),
  designPlanId: z.string().min(1).optional(),
  templateId: z.string().min(1).optional(),
  engine: motionEngineIdSchema.optional(),
  contentGraphNodeId: z.string().min(1).optional(),
  ratio: ratioSchema,
  duration: z.number().positive(),
  visualType: visualTypeSchema,
  contentSlots: z.object({
    headline: z.string().optional(),
    body: z.string().optional(),
    image: z.string().optional(),
    assets: z.array(assetSlotSchema).optional(),
    chips: z.array(z.string()).optional(),
    metrics: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    entities: z.array(z.string()).optional(),
    quote: z.string().optional(),
    sourceLabel: z.string().optional(),
    caption: z.string().optional(),
    product: z.unknown().optional()
  }),
  motion: z.object({
    pace: z.enum(["snap", "fast", "steady"]),
    camera: z.enum(["push-in", "pull-out", "pan-left", "pan-right", "tilt-up", "tilt-down", "handheld", "snap-zoom", "orbit"]),
    transitionIn: z.enum(["cut", "whip", "zoom", "wipe", "glitch", "flash", "match"]),
    transitionOut: z.enum(["cut", "whip", "zoom", "wipe", "glitch", "flash", "match"]),
    beatSync: z.boolean(),
    intensity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
  }),
  style: z.object({
    themeId: z.string().min(1),
    typography: z.enum(["bold-news", "creator-pop", "documentary", "clean-explain"]),
    density: z.enum(["low", "medium", "high"])
  }),
  safeAreas: z.object({
    title: boxSchema,
    action: boxSchema,
    subtitle: boxSchema
  }),
  design: motionSceneDesignSchema.optional()
});

export const motionKeyframeSchema = z.object({
  frame: z.number().int().nonnegative(),
  properties: z.record(z.union([z.string(), z.number(), z.boolean()])),
  easing: z.enum(["linear", "ease-in", "ease-out", "ease-in-out", "spring", "back-out", "expo-out"]).optional()
});

export const motionLayerSchema: z.ZodType<{
  id: string;
  kind: "text" | "shape" | "image" | "video" | "svg" | "canvas" | "webgl" | "group";
  frame: { x: number; y: number; width: number; height: number };
  content?: string;
  assetPath?: string;
  style?: Record<string, string | number>;
  keyframes?: Array<{ frame: number; properties: Record<string, string | number | boolean>; easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out" | "spring" | "back-out" | "expo-out" }>;
  children?: Array<unknown>;
  safeAreaRole?: "title" | "visual" | "caption" | "ui";
}> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    kind: z.enum(["text", "shape", "image", "video", "svg", "canvas", "webgl", "group"]),
    frame: boxSchema,
    content: z.string().optional(),
    assetPath: z.string().optional(),
    style: z.record(z.union([z.string(), z.number()])).optional(),
    keyframes: z.array(motionKeyframeSchema).optional(),
    children: z.array(motionLayerSchema).optional(),
    safeAreaRole: z.enum(["title", "visual", "caption", "ui"]).optional()
  })
);

export const motionGraphSchema = z.object({
  id: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  durationFrames: z.number().int().positive(),
  engine: motionEngineIdSchema.optional(),
  templateId: z.string().min(1).optional(),
  contentGraphId: z.string().min(1).optional(),
  provenance: z.object({
    visualSpecId: z.string().min(1).optional(),
    contentGraphNodeId: z.string().min(1).optional(),
    sourceTemplateId: z.string().min(1).optional(),
    sourceDesignPlanId: z.string().min(1).optional(),
    generatedBy: z.string().min(1).optional()
  }).optional(),
  background: motionLayerSchema,
  layers: z.array(motionLayerSchema),
  audio: z.array(z.object({
    id: z.string().min(1),
    src: z.string().min(1),
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().positive(),
    volume: z.number().min(0).max(2).optional()
  })).optional(),
  captions: z.array(z.object({
    id: z.string().min(1),
    language: z.enum(["zh", "en", "bilingual"]),
    safeArea: boxSchema,
    cues: z.array(z.object({
      id: z.string().min(1),
      startFrame: z.number().int().nonnegative(),
      endFrame: z.number().int().positive(),
      text: z.string().min(1),
      keywords: z.array(z.string()).optional()
    }))
  })).optional(),
  qualityRules: z.array(z.enum([
    "subtitle-safe-area",
    "text-overflow",
    "contrast",
    "motion-energy",
    "scene-variety",
    "caption-density",
    "brand-consistency",
    "golden-frame"
  ])),
  sourceSpecId: z.string().optional()
});

export const renderLintReportSchema = z.object({
  jobId: z.string().min(1),
  score: z.number().min(0).max(100),
  issues: z.array(z.object({
    id: z.string().min(1),
    severity: z.enum(["info", "warn", "error"]),
    sceneId: z.string().optional(),
    shotId: z.string().optional(),
    frame: z.number().int().nonnegative().optional(),
    message: z.string().min(1),
    suggestion: z.string().min(1)
  })),
  frameSamples: z.array(z.object({
    frame: z.number().int().nonnegative(),
    path: z.string().min(1),
    hash: z.string().min(1)
  }))
});

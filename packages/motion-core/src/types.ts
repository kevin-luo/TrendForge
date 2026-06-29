import type { CameraMove, ProductVideoItem, Ratio, ShotTransition } from "@trendforge/core";

export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisualType =
  | "rank-race"
  | "product-workspace"
  | "news-evidence-wall"
  | "data-pulse"
  | "timeline-rail"
  | "workflow-orbit"
  | "creator-desk"
  | "split-compare"
  | "whiteboard-explain";

export type TypographySystem = "bold-news" | "creator-pop" | "documentary" | "clean-explain";
export type MotionDensity = "low" | "medium" | "high";
export type MotionPace = "snap" | "fast" | "steady";
export type MotionIntensity = 1 | 2 | 3 | 4 | 5;
export type MotionEngineId = "motion-render" | "remotion" | "hyperframes" | "motion-canvas" | "revideo" | "manim" | "custom";
export type MotionEngineStatus = "ready" | "experimental" | "planned" | "disabled";
export type MotionEngineInputKind = "motion-graph" | "html-frame" | "react-composition" | "canvas-program" | "python-scene";
export type MotionOutputFormat = "mp4" | "webm" | "mov" | "png-sequence" | "gif";

export type MotionEngineAdapterSpec = {
  id: MotionEngineId;
  label: string;
  description: string;
  status: MotionEngineStatus;
  input: MotionEngineInputKind;
  outputFormats: MotionOutputFormat[];
  localRender: boolean;
  requiresBrowser: boolean;
  deterministic: boolean;
  renderContract: "render(input, context)";
  bestFor: string[];
  limitations?: string[];
};

export type MotionTemplateManifest = {
  specVersion: 1;
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  bestFor: string[];
  engine: MotionEngineId;
  visualType?: VisualType;
  output: {
    formats: MotionOutputFormat[];
    defaultFormat: MotionOutputFormat;
    supportedAspects: Ratio[];
    fps: {
      min: number;
      max: number;
      default: number;
    };
    duration: {
      minSeconds: number;
      maxSeconds: number;
      defaultSeconds: number;
    };
    alpha: boolean;
    audio: "none" | "optional" | "required";
  };
  inputs: {
    schema: unknown;
    required?: string[];
    examples?: unknown[];
  };
  license: {
    spdx: string;
    attributionRequired: boolean;
    redistributionAllowed: boolean;
    commercialUse: boolean;
    sourceUrl?: string;
    author?: string;
  };
  provenance?: {
    upstreamProject?: string;
    upstreamUrl?: string;
    notes?: string;
  };
  preview?: {
    poster?: string;
    sampleFrames?: string[];
  };
  performance?: {
    referenceRenderSeconds?: number;
    referenceFrames?: number;
    machine?: string;
  };
};

export type MotionFrameDesignSource = "deepseek" | "local-fallback" | "user" | "design-md" | "frame-md" | "open-design";
export type MotionSceneLayoutVariant =
  | "poster-stack"
  | "split-editorial"
  | "data-magazine"
  | "kinetic-type"
  | "interface-depth"
  | "evidence-grid"
  | "timeline-broadside"
  | "workflow-map";
export type MotionDecorLevel = "minimal" | "editorial" | "maximal";
export type MotionSignature = "snap-stagger" | "poster-pop" | "kinetic-slam" | "soft-reveal" | "data-tick" | "orbit-sweep";

export type AssetSlotRole = "hero" | "background" | "logo" | "screenshot" | "illustration" | "texture" | "diagram" | "thumbnail";
export type AssetSlotSource = "product_asset" | "generated" | "manual" | "local";

export type AssetSlot = {
  role: AssetSlotRole;
  src: string;
  source: AssetSlotSource;
};

export type MotionFrameDesignSystem = {
  id: string;
  name: string;
  source: MotionFrameDesignSource;
  themeId: string;
  stylePrompt: string;
  palette: {
    background: string;
    surface: string;
    ink: string;
    muted: string;
    accents: string[];
  };
  typography: {
    display: string;
    body: string;
    mono: string;
    headlineWeight: number;
    bodyWeight: number;
  };
  frameRules: string[];
  motionRules: string[];
  qualityRules: string[];
};

export type MotionSceneDesign = {
  id: string;
  sceneId: string;
  shotId: string;
  templateId: string;
  visualType: VisualType;
  layoutVariant: MotionSceneLayoutVariant;
  accentIndex: number;
  typographyScale: number;
  density: MotionDensity;
  rotation: number;
  decor: MotionDecorLevel;
  motionSignature: MotionSignature;
  emphasisWords: string[];
  rationale?: string;
};

export type MotionDesignPlan = {
  id: string;
  name: string;
  generatedBy: MotionFrameDesignSource;
  designSystem: MotionFrameDesignSystem;
  sceneDesigns: MotionSceneDesign[];
  sourceRefs?: Array<{ label: string; uri?: string }>;
  promptDigest?: string;
  createdAt?: string;
};

export type ContentGraphNodeKind =
  | "topic"
  | "source"
  | "trend"
  | "product"
  | "claim"
  | "data"
  | "quote"
  | "scene"
  | "shot"
  | "caption"
  | "asset"
  | "style";

export type ContentGraphEdgeKind =
  | "sequence"
  | "depends-on"
  | "supports"
  | "contrasts"
  | "expands"
  | "summarizes"
  | "cites"
  | "styles"
  | "renders-to";

export type ContentGraphSourceRef = {
  type: "url" | "project" | "manual" | "api" | "file";
  uri?: string;
  projectId?: string;
  confidence?: number;
};

export type ContentGraphNode = {
  id: string;
  kind: ContentGraphNodeKind;
  label: string;
  summary?: string;
  payload?: Record<string, unknown>;
  sourceRef?: ContentGraphSourceRef;
};

export type ContentGraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: ContentGraphEdgeKind;
  weight?: number;
  note?: string;
};

export type ContentGraph = {
  id: string;
  title: string;
  nodes: ContentGraphNode[];
  edges: ContentGraphEdge[];
  entryNodeIds?: string[];
  templateHints?: string[];
  sourceProjectId?: string;
  createdAt?: string;
};

export type VisualSceneSpec = {
  id: string;
  sceneId: string;
  shotId: string;
  designPlanId?: string;
  templateId?: string;
  engine?: MotionEngineId;
  contentGraphNodeId?: string;
  ratio: Ratio;
  duration: number;
  visualType: VisualType;
  contentSlots: {
    headline?: string;
    body?: string;
    image?: string;
    assets?: AssetSlot[];
    chips?: string[];
    metrics?: Array<{ label: string; value: string }>;
    entities?: string[];
    quote?: string;
    sourceLabel?: string;
    caption?: string;
    product?: ProductVideoItem;
  };
  motion: {
    pace: MotionPace;
    camera: CameraMove;
    transitionIn: ShotTransition;
    transitionOut: ShotTransition;
    beatSync: boolean;
    intensity: MotionIntensity;
  };
  style: {
    themeId: string;
    typography: TypographySystem;
    density: MotionDensity;
  };
  safeAreas: {
    title: Box;
    action: Box;
    subtitle: Box;
  };
  design?: MotionSceneDesign;
};

export type MotionLayerKind = "text" | "shape" | "image" | "video" | "svg" | "canvas" | "webgl" | "group";
export type MotionSafeAreaRole = "title" | "visual" | "caption" | "ui";
export type MotionEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "spring" | "back-out" | "expo-out";

export type MotionKeyframe = {
  frame: number;
  properties: Record<string, string | number | boolean>;
  easing?: MotionEasing;
};

export type MotionLayer = {
  id: string;
  kind: MotionLayerKind;
  frame: Box;
  content?: string;
  assetPath?: string;
  style?: Record<string, string | number>;
  keyframes?: MotionKeyframe[];
  children?: MotionLayer[];
  safeAreaRole?: MotionSafeAreaRole;
};

export type MotionAudioTrack = {
  id: string;
  src: string;
  startFrame: number;
  endFrame: number;
  volume?: number;
};

export type MotionCaptionCue = {
  id: string;
  startFrame: number;
  endFrame: number;
  text: string;
  keywords?: string[];
};

export type MotionCaptionTrack = {
  id: string;
  language: "zh" | "en" | "bilingual";
  safeArea: Box;
  cues: MotionCaptionCue[];
};

export type RenderQualityRule =
  | "subtitle-safe-area"
  | "text-overflow"
  | "contrast"
  | "motion-energy"
  | "scene-variety"
  | "caption-density"
  | "brand-consistency"
  | "golden-frame";

export type MotionGraph = {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
  engine?: MotionEngineId;
  templateId?: string;
  contentGraphId?: string;
  provenance?: {
    visualSpecId?: string;
    contentGraphNodeId?: string;
    sourceTemplateId?: string;
    sourceDesignPlanId?: string;
    generatedBy?: string;
  };
  background: MotionLayer;
  layers: MotionLayer[];
  audio?: MotionAudioTrack[];
  captions?: MotionCaptionTrack[];
  qualityRules: RenderQualityRule[];
  sourceSpecId?: string;
};

export type RenderLintIssue = {
  id: string;
  severity: "info" | "warn" | "error";
  sceneId?: string;
  shotId?: string;
  frame?: number;
  message: string;
  suggestion: string;
};

export type RenderLintFrameSample = {
  frame: number;
  path: string;
  hash: string;
};

export type RenderLintReport = {
  jobId: string;
  score: number;
  issues: RenderLintIssue[];
  frameSamples: RenderLintFrameSample[];
};

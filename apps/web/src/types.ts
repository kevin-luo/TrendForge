import type { CreatorStyleAgent, ExportSettings, ProjectRecord, Ratio, ServiceStatus, SubtitleCue, TrendItem, VideoScript } from "@trendforge/core";
import type { MotionEngineAdapterSpec, MotionFrameDesignSystem, MotionTemplateManifest, VisualType } from "@trendforge/motion-core";

export type OpenDesignMotionSystem = MotionFrameDesignSystem & {
  slug: string;
  designDocPath: string;
  origin: {
    project: string;
    url: string;
    license: string;
  };
  bestFor: string[];
  templateBias: VisualType[];
  styleTags: string[];
};

export type ProjectDetail = ProjectRecord & {
  trendItems?: TrendItem[];
  script?: VideoScript;
  subtitles?: Array<{ format: string; path?: string; cues_json?: string }>;
  assets?: Array<{ type: string; path: string; meta_json?: string }>;
  jobs?: JobRow[];
};

export type JobRow = {
  id: string;
  project_id: string;
  type: string;
  status: "pending" | "running" | "success" | "failed" | "canceled";
  progress: number;
  step?: string;
  output_path?: string;
  error_message?: string;
  started_at?: string;
  finished_at?: string;
  created_at?: string;
};

export type SourceInfo = {
  id: string;
  name: string;
  description: string;
  requiresAuth: boolean;
  enabled: boolean;
};

export type SystemStatusMap = Record<string, ServiceStatus>;

export type LogRow = {
  id: string;
  level: string;
  message: string;
  created_at: string;
};

export type SubtitleState = {
  cues: SubtitleCue[];
};

export type CreatorStyleState = {
  agent?: CreatorStyleAgent;
};

export type MatrixCandidateExport = {
  candidate: "a" | "b" | "c";
  rendered: boolean;
  packageDir: string;
  videoPath?: string;
  coverPath?: string;
  burnedZhPath?: string;
  burnedBilingualPath?: string;
};

export type MotionTemplateRegistry = {
  engines: MotionEngineAdapterSpec[];
  templates: MotionTemplateManifest[];
  designSystems: OpenDesignMotionSystem[];
};

export type RenderQualitySceneSpecsSummary = {
  sceneCount: number;
  imageSceneCount: number;
  imageCoverage: number;
  templateCounts: Record<string, number>;
  visualTypeCounts: Record<string, number>;
};

export type RenderQualitySummary = {
  sceneCount?: number;
  imageSceneCount?: number;
  imageCoverage?: number;
  assetSceneCount?: number;
  assetRoleCounts?: Record<string, number>;
  assetSourceCounts?: Record<string, number>;
  templateCounts?: Record<string, number>;
  visualTypeCounts?: Record<string, number>;
};

export type TextFitSummary = {
  totalFitTextCount: number;
  clampedTextCount: number;
  clampedRate: number;
  clampedByRole: Record<string, number>;
  clampedByScene: Record<string, number>;
  clampedByTemplate: Record<string, number>;
};

export type RenderQualityReport = {
  renderProfile: "standard" | "high";
  encodeProfile: "standard" | "high";
  ratio: Ratio;
  width: number;
  height: number;
  fps: 24 | 30 | 60;
  themeId: string;
  qualitySummary?: RenderQualitySummary;
  textFitSummary?: TextFitSummary;
  sceneSpecs: RenderQualitySceneSpecsSummary;
};

export type ExportProfileChoice = "auto" | NonNullable<ExportSettings["renderProfile"]>;

export type ExportSubmissionSettings = Pick<
  ExportSettings,
  "ratio" | "fps" | "format" | "burnSubtitles" | "renderProfile" | "qualityProfile"
>;

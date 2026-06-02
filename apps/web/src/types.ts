import type { ProjectRecord, ServiceStatus, SubtitleCue, TrendItem, VideoScript } from "@trendforge/core";

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

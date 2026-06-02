export type Language = "zh" | "en" | "bilingual";
export type Ratio = "9:16" | "16:9" | "1:1" | "4:5" | "16:10" | "2.35:1" | "custom";
export type ProjectStatus = "draft" | "collecting" | "scripting" | "voicing" | "subtitling" | "rendering" | "exported" | "failed";
export type JobStatus = "pending" | "running" | "success" | "failed" | "canceled";
export type JobType =
  | "fetch_source"
  | "generate_script"
  | "generate_tts"
  | "generate_subtitles"
  | "generate_cover"
  | "render_video"
  | "export_video"
  | "process_video";

export type SourceType = "manual" | "product-hunt" | "hacker-news" | "reddit" | "x-twitter" | "rss";

export type FetchOptions = {
  source?: SourceType;
  limit?: number;
  timeframe?: "day" | "week" | "month" | "year";
  mode?: string;
  subreddit?: string;
  rssUrls?: string[];
  query?: string;
  manualText?: string;
  manualLinks?: string[];
  timeoutMs?: number;
};

export type SearchOptions = FetchOptions & {
  query: string;
};

export type TrendItem = {
  id: string;
  source: string;
  title: string;
  url?: string;
  summary?: string;
  content?: string;
  author?: string;
  score?: number;
  comments?: number;
  rank?: number;
  thumbnail?: string;
  publishedAt?: string;
  raw: unknown;
};

export interface SourceConnector {
  id: SourceType;
  name: string;
  description: string;
  requiresAuth: boolean;
  isEnabled(): Promise<boolean>;
  fetchTrending(options: FetchOptions): Promise<TrendItem[]>;
  search?(query: string, options: SearchOptions): Promise<TrendItem[]>;
}

export type ScriptType =
  | "trend-list"
  | "single-news"
  | "comparison"
  | "text-to-video"
  | "product-daily";

export type VideoScript = {
  title: string;
  subtitle?: string;
  language: Language;
  scenes: Scene[];
  voiceoverText: string;
  hashtags?: string[];
  description?: string;
};

export type Scene = {
  id: string;
  type: "cover" | "intro" | "item" | "analysis" | "outro";
  duration?: number;
  title: string;
  screenText: string;
  voiceText: string;
  voiceTextEn?: string;
  items?: TrendItem[];
  visualHint?: string;
};

export type ScriptGenerateInput = {
  projectId: string;
  items: TrendItem[];
  language: Language;
  scriptType: ScriptType;
  targetSeconds?: number;
  tone?: string;
};

export interface ScriptProvider {
  id: string;
  name: string;
  isEnabled(): Promise<boolean>;
  generate(input: ScriptGenerateInput): Promise<VideoScript>;
  regenerateScene(input: ScriptGenerateInput & { scene: Scene; instruction?: string }): Promise<Scene>;
}

export type TtsInput = {
  text: string;
  voice: string;
  format: "mp3" | "wav";
  speed?: number;
  volume?: number;
  pitch?: number;
  emotion?: string;
  language?: string;
  outputDir?: string;
  filename?: string;
};

export type TtsResult = {
  audioPath: string;
  duration: number;
  segments?: TtsSegment[];
};

export type TtsSegment = {
  id: string;
  text: string;
  audioPath: string;
  duration: number;
  start?: number;
  end?: number;
};

export interface TtsProvider {
  id: string;
  name: string;
  isEnabled(): Promise<boolean>;
  synthesize(input: TtsInput): Promise<TtsResult>;
}

export type SubtitleCue = {
  id: string;
  start: number;
  end: number;
  text: string;
  textEn?: string;
  keywords?: string[];
};

export type RenderPayload = {
  projectId: string;
  composition: string;
  ratio: Ratio;
  width: number;
  height: number;
  fps: number;
  duration: number;
  script: VideoScript;
  audio?: {
    path: string;
    duration: number;
  };
  subtitles?: SubtitleCue[];
  theme?: Record<string, unknown>;
  assets?: Record<string, string>;
};

export type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  ratios: Ratio[];
  defaultTheme: Record<string, unknown>;
};

export type ExportSettings = {
  ratio: Ratio;
  width: number;
  height: number;
  fps: 24 | 30 | 60;
  format: "mp4" | "webm";
  burnSubtitles: boolean;
  exportSubtitles: boolean;
  includeBgm: boolean;
  audioOnly: boolean;
  exportCover: boolean;
};

export type AppSettingMap = Record<string, string | undefined>;

export type SystemStatus = {
  renderEngine: ServiceStatus;
  aiModel: ServiceStatus;
  voice: ServiceStatus;
  productHunt: ServiceStatus;
  reddit: ServiceStatus;
  xTwitter: ServiceStatus;
  storage: ServiceStatus;
};

export type ServiceStatus = {
  id: string;
  label: string;
  status: "ready" | "missing" | "disabled" | "error";
  message: string;
};

export type LogEntry = {
  id: string;
  projectId?: string;
  jobId?: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
  createdAt: string;
};

export type JobRecord = {
  id: string;
  projectId: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  step?: string;
  outputPath?: string;
  errorMessage?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
};

export type ProjectRecord = {
  id: string;
  title: string;
  type: string;
  status: ProjectStatus;
  sourceType?: SourceType;
  language: Language;
  ratio: Ratio;
  templateId: string;
  coverPath?: string;
  finalVideoPath?: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

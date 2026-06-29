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
  | "process_video"
  | "product_hunt_video"
  | "promo_video"
  | "matrix_video"
  | "motion_render";

export type SourceType = "manual" | "product-hunt" | "hacker-news" | "reddit" | "x-twitter" | "rss";
export type MatrixContentType = "tool_list" | "news_explain" | "science_explain" | "history_story" | "opinion_comment";
export type MatrixPlatform = "douyin" | "xiaohongshu" | "wechat_channels" | "bilibili" | "youtube" | "youtube_shorts";

export type FetchOptions = {
  source?: SourceType;
  limit?: number;
  timeframe?: "day" | "week" | "month" | "year";
  mode?: string;
  subreddit?: string;
  rssUrls?: string[];
  query?: string;
  date?: string;
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
  metadata?: Record<string, unknown>;
};

export type ShotTransition = "cut" | "whip" | "zoom" | "wipe" | "glitch" | "flash" | "match";

export type CameraMove =
  | "push-in"
  | "pull-out"
  | "pan-left"
  | "pan-right"
  | "tilt-up"
  | "tilt-down"
  | "handheld"
  | "snap-zoom"
  | "orbit";

export type ShotPace = "snap" | "fast" | "steady";

export type BrollIntent = {
  query: string;
  mood: "product" | "news" | "science" | "history" | "opinion" | "creator" | "abstract";
  source?: "product_asset" | "web_image" | "stock" | "local" | "generated";
  assetPath?: string;
  fallbackVisual?:
    | "screenshot"
    | "collage"
    | "diagram"
    | "keyword-wall"
    | "timeline"
    | "data-stream"
    | "product-interface"
    | "news-wall"
    | "creator-desk"
    | "rank-board"
    | "workflow-map";
};

export type SceneShot = {
  id: string;
  start: number;
  duration: number;
  beat: string;
  onScreenText: string;
  narrationText?: string;
  camera: CameraMove;
  transitionIn: ShotTransition;
  transitionOut: ShotTransition;
  pace: ShotPace;
  broll: BrollIntent[];
  sfxCue?: string;
  bgmCue?: string;
  visualMotifs?: string[];
};

export type StoryboardScene = {
  id: string;
  type:
    | "cover"
    | "overview"
    | "product"
    | "hook"
    | "background"
    | "timeline"
    | "item"
    | "explain"
    | "comparison"
    | "quote"
    | "data"
    | "summary"
    | "cta";
  duration: number;
  title: string;
  screenText: string;
  narrationTextZh: string;
  narrationTextEn: string;
  subtitleZh: string;
  subtitleEn: string;
  productRank?: number;
  visualDirection: string;
  image?: string;
  assetHints?: string[];
  keywords?: string[];
  shots?: SceneShot[];
  transition?: ShotTransition;
  camera?: CameraMove;
  brollQueries?: string[];
  bgmCue?: string;
  sfxCue?: string;
  energy?: "calm" | "steady" | "fast" | "viral";
};

export type ProductVideoItem = {
  rank: number;
  name: string;
  tagline: string;
  oneLineZh: string;
  oneLineEn: string;
  highlightsZh: string[];
  highlightsEn: string[];
  targetUser?: string;
  whyInterestingZh: string;
  whyInterestingEn: string;
  votes?: number;
  comments?: number;
  website?: string;
  productHuntUrl?: string;
  logoPath?: string;
  screenshotPath?: string;
  thumbnailPath?: string;
};

export type SubtitleTrack = {
  language: "zh" | "en" | "bilingual";
  cues: SubtitleCue[];
};

export type PublishPack = {
  titles: string[];
  description: string;
  hashtags: string[];
  platformCopies: {
    douyin?: string;
    xiaohongshu?: string;
    wechatChannels?: string;
    bilibili?: string;
    youtube?: string;
  };
};

export type TimelineEvent = {
  id: string;
  title: string;
  date?: string;
  description?: string;
};

export type ContentAngle = {
  id: string;
  title: string;
  audience: string;
  contentType: MatrixContentType;
  hook: string;
  reason: string;
};

export type ContentAnalysis = {
  topic: string;
  contentTypeSuggestion: MatrixContentType[];
  keyPoints: string[];
  entities: {
    people?: string[];
    companies?: string[];
    products?: string[];
    places?: string[];
    dates?: string[];
  };
  timeline?: TimelineEvent[];
  controversy?: string[];
  facts: string[];
  risks?: string[];
  suggestedAngles: ContentAngle[];
};

export type CreatorStyleSample = {
  id?: string;
  source?: "manual" | "url" | "transcript" | "title_list";
  title?: string;
  text: string;
  url?: string;
  metrics?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    publishedAt?: string;
  };
};

export type CreatorStyleAgent = {
  id: string;
  name: string;
  niche: string;
  language: Language;
  description: string;
  hookPatterns: string[];
  narrativeRhythm: string[];
  vocabulary: string[];
  sentenceRules: string[];
  sceneRules: string[];
  subtitleRules: string[];
  visualRules?: string[];
  audioRules?: string[];
  coverTitleRules: string[];
  audienceTriggers: string[];
  viralMechanics: string[];
  pacing: {
    hookSeconds: number;
    sceneSeconds: number;
    totalSeconds: number;
    density: "low" | "medium" | "high";
  };
  examples: {
    opener: string;
    transition: string;
    ending: string;
  };
  directorPolicy?: {
    preferredVisualTypes?: string[];
    transitionBias?: ShotTransition[];
    cameraBias?: CameraMove[];
    textDensity?: "low" | "medium" | "high";
    captionPunchRate?: number;
  };
  skillMarkdown: string;
  rawSummary: string;
  createdAt: string;
};

export type VideoStoryboard = {
  id?: string;
  title: string;
  subtitle: string;
  contentType?: MatrixContentType;
  persona?: string;
  platform?: MatrixPlatform;
  source: "product_hunt" | "manual" | "hacker_news" | "rss" | "reddit" | "x";
  language: Language;
  ratio: Ratio;
  durationTarget: number;
  scenes: StoryboardScene[];
  products: ProductVideoItem[];
  subtitleTracks: SubtitleTrack[];
  publishPack?: PublishPack;
  description?: string;
  hashtags?: string[];
  candidate?: "a" | "b" | "c";
  theme?: "paper-ink" | "news-rank" | "product-deep" | "minimal-visual";
  creatorStyle?: CreatorStyleAgent;
  audioDirection?: {
    voiceStyle: "news" | "energetic" | "documentary" | "storytelling" | "commentary";
    bgmMood: "electronic" | "future-bass" | "hiphop" | "cinematic" | "minimal" | "magic-loop";
    bpm: number;
    sfx: string[];
  };
  visualSearch?: {
    provider: "product_assets" | "web_image" | "stock" | "local_first";
    queries: string[];
    requiredPerScene: number;
  };
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
  sceneId?: string;
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
  deviceScaleFactor?: number;
  renderProfile?: "standard" | "high";
  qualityProfile?: "standard" | "high";
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

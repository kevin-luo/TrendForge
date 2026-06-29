import type { ExportSubmissionSettings, JobRow, LogRow, MotionTemplateRegistry, ProjectDetail, RenderQualityReport, SourceInfo, SystemStatusMap } from "./types";
import type { CreatorStyleAgent, CreatorStyleSample, Language, MatrixContentType, MatrixPlatform, ProjectRecord, Ratio, SourceType, SubtitleCue, VideoScript } from "@trendforge/core";

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = options.body instanceof FormData
    ? undefined
    : options.body
      ? { "Content-Type": "application/json" }
      : undefined;
  const response = await fetch(url, {
    headers,
    ...options
  });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.error?.message ?? `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

function requestPromoGenerate(
  projectId: string,
  options: {
    prompt: string;
    source: SourceType;
    contentType: MatrixContentType | "auto";
    persona?: string;
    platform: MatrixPlatform;
    ratio: Ratio;
    language: Language;
    date?: string;
    topCount?: number;
    rssUrl?: string;
    styleName?: string;
    styleNiche?: string;
    styleAgent?: CreatorStyleAgent;
    styleSampleText?: string;
  },
  route: "promo" | "matrix" = "promo"
) {
  return request<JobRow>(`/api/projects/${projectId}/${route}/generate`, {
    method: "POST",
    body: JSON.stringify(options)
  });
}

export const api = {
  projects: () => request<ProjectRecord[]>("/api/projects"),
  project: (id: string) => request<ProjectDetail>(`/api/projects/${id}`),
  createProject: (title: string, ratio: Ratio) =>
    request<ProjectRecord>("/api/projects", { method: "POST", body: JSON.stringify({ title, ratio, type: "trend-video", language: "zh" }) }),
  patchProject: (id: string, body: Partial<ProjectRecord> & { templateId?: string; sourceType?: string }) =>
    request<ProjectRecord>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  sources: () => request<SourceInfo[]>("/api/sources"),
  motionTemplates: () => request<MotionTemplateRegistry>("/api/motion/templates"),
  fetchSource: (projectId: string, source: string, options: Record<string, unknown>) =>
    request<{ items: unknown[] }>("/api/sources/fetch", { method: "POST", body: JSON.stringify({ projectId, source, options }) }),
  generateProductHuntVideo: (
    projectId: string,
    options: { date: string; topCount: number; language: Language; ratio: Ratio; style: string; prompt: string }
  ) =>
    request<JobRow>(`/api/projects/${projectId}/product-hunt/generate`, {
      method: "POST",
      body: JSON.stringify(options)
    }),
  extractCreatorStyle: (
    projectId: string,
    options: { name?: string; niche?: string; language: Language; sampleText?: string; samples?: CreatorStyleSample[] }
  ) =>
    request<{ agent: CreatorStyleAgent }>(`/api/projects/${projectId}/creator-style/extract`, {
      method: "POST",
      body: JSON.stringify(options)
    }),
  generatePromoVideo: (
    projectId: string,
    options: {
      prompt: string;
      source: SourceType;
      contentType: MatrixContentType | "auto";
      persona?: string;
      platform: MatrixPlatform;
      ratio: Ratio;
      language: Language;
      date?: string;
      topCount?: number;
      rssUrl?: string;
      styleName?: string;
      styleNiche?: string;
      styleAgent?: CreatorStyleAgent;
      styleSampleText?: string;
    }
  ) => requestPromoGenerate(projectId, options),
  generateMatrixVideo: (
    projectId: string,
    options: {
      prompt: string;
      source: SourceType;
      contentType: MatrixContentType | "auto";
      persona?: string;
      platform: MatrixPlatform;
      ratio: Ratio;
      language: Language;
      date?: string;
      topCount?: number;
      rssUrl?: string;
      styleName?: string;
      styleNiche?: string;
      styleAgent?: CreatorStyleAgent;
      styleSampleText?: string;
    }
  ) => requestPromoGenerate(projectId, options, "matrix"),
  generateScript: (projectId: string, language: Language = "zh") =>
    request<JobRow>(`/api/projects/${projectId}/script/generate`, { method: "POST", body: JSON.stringify({ language, scriptType: "trend-list" }) }),
  saveScript: (projectId: string, script: VideoScript) => request<VideoScript>(`/api/projects/${projectId}/script`, { method: "PATCH", body: JSON.stringify(script) }),
  regenerateScene: (projectId: string, sceneId: string, instruction?: string) =>
    request<VideoScript["scenes"][number]>(`/api/projects/${projectId}/script/regenerate-scene`, {
      method: "POST",
      body: JSON.stringify({ sceneId, instruction })
    }),
  generateTts: (projectId: string, options: Record<string, unknown> = {}) =>
    request<JobRow>(`/api/projects/${projectId}/tts/generate`, {
      method: "POST",
      body: JSON.stringify({ format: "wav", speed: 1, volume: 1, pitch: 1, ...options })
    }),
  generateSubtitles: (projectId: string) =>
    request<{ cues: SubtitleCue[] }>(`/api/projects/${projectId}/subtitles/generate`, { method: "POST", body: JSON.stringify({}) }),
  saveSubtitles: (projectId: string, cues: SubtitleCue[]) => request<{ cues: SubtitleCue[] }>(`/api/projects/${projectId}/subtitles`, { method: "PATCH", body: JSON.stringify({ cues }) }),
  generateCover: (projectId: string) => request<{ path: string }>(`/api/projects/${projectId}/cover/generate`, { method: "POST" }),
  // Render via the HTML-film pipeline (makeFilmHtml → Chrome posters → MP4).
  render: (projectId: string, settings: ExportSubmissionSettings) =>
    request<JobRow>(`/api/projects/${projectId}/render`, {
      method: "POST",
      body: JSON.stringify(settings)
    }),
  renderQuality: async (projectId: string): Promise<RenderQualityReport | null> => {
    const response = await fetch(`/api/projects/${projectId}/render/quality`);
    if (response.status === 404) return null;
    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      throw new Error(body?.error?.message ?? `Request failed: ${response.status}`);
    }
    return (await response.json()) as RenderQualityReport;
  },
  job: (id: string) => request<JobRow>(`/api/render-jobs/${id}`),
  settings: () => request<Record<string, string | undefined>>("/api/settings"),
  saveSettings: (settings: Record<string, string | undefined>) => request<Record<string, string | undefined>>("/api/settings", { method: "PATCH", body: JSON.stringify(settings) }),
  status: () => request<SystemStatusMap>("/api/system/status"),
  logs: (projectId: string) => request<LogRow[]>(`/api/projects/${projectId}/logs`),
  openFolder: (folderPath: string) =>
    request<{ ok: boolean }>("/api/system/open-folder", { method: "POST", body: JSON.stringify({ path: folderPath }) }),
  exportVideoUrl: (projectId: string) => `/api/projects/${projectId}/export/video`,
  /** Returns the preview URL (open in new tab) */
  previewUrl: (projectId: string) => `/api/projects/${projectId}/preview`
};

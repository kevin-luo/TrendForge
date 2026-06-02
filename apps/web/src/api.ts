import type { JobRow, LogRow, ProjectDetail, SourceInfo, SystemStatusMap } from "./types";
import type { ExportSettings, Language, ProjectRecord, Ratio, SubtitleCue, VideoScript } from "@trendforge/core";

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.error?.message ?? `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export const api = {
  projects: () => request<ProjectRecord[]>("/api/projects"),
  project: (id: string) => request<ProjectDetail>(`/api/projects/${id}`),
  createProject: (title: string, ratio: Ratio) =>
    request<ProjectRecord>("/api/projects", { method: "POST", body: JSON.stringify({ title, ratio, type: "trend-video", language: "zh" }) }),
  patchProject: (id: string, body: Partial<ProjectRecord> & { templateId?: string; sourceType?: string }) =>
    request<ProjectRecord>(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  sources: () => request<SourceInfo[]>("/api/sources"),
  fetchSource: (projectId: string, source: string, options: Record<string, unknown>) =>
    request<{ items: unknown[] }>("/api/sources/fetch", { method: "POST", body: JSON.stringify({ projectId, source, options }) }),
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
  generateSubtitles: (projectId: string) => request<{ cues: SubtitleCue[] }>(`/api/projects/${projectId}/subtitles/generate`, { method: "POST" }),
  saveSubtitles: (projectId: string, cues: SubtitleCue[]) => request<{ cues: SubtitleCue[] }>(`/api/projects/${projectId}/subtitles`, { method: "PATCH", body: JSON.stringify({ cues }) }),
  generateCover: (projectId: string) => request<{ path: string }>(`/api/projects/${projectId}/cover/generate`, { method: "POST" }),
  render: (projectId: string, settings: Partial<ExportSettings> & { ratio: Ratio }) =>
    request<JobRow>(`/api/projects/${projectId}/render`, {
      method: "POST",
      body: JSON.stringify({
        fps: 30,
        format: "mp4",
        burnSubtitles: true,
        exportSubtitles: true,
        includeBgm: false,
        audioOnly: false,
        exportCover: true,
        ...settings
      })
    }),
  job: (id: string) => request<JobRow>(`/api/render-jobs/${id}`),
  settings: () => request<Record<string, string | undefined>>("/api/settings"),
  saveSettings: (settings: Record<string, string | undefined>) => request<Record<string, string | undefined>>("/api/settings", { method: "PATCH", body: JSON.stringify(settings) }),
  status: () => request<SystemStatusMap>("/api/system/status"),
  logs: (projectId: string) => request<LogRow[]>(`/api/projects/${projectId}/logs`),
  openFolder: (folderPath: string) =>
    request<{ ok: boolean }>("/api/system/open-folder", { method: "POST", body: JSON.stringify({ path: folderPath }) }),
  /** Returns the preview URL (open in new tab) */
  previewUrl: (projectId: string) => `/api/projects/${projectId}/preview`
};

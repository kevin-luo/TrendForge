import type { ProjectRecord, TrendItem, VideoScript } from "@trendforge/core";

export function mapProject(row: {
  id: string;
  title: string;
  type: string;
  status: string;
  source_type: string | null;
  language: string;
  ratio: string;
  template_id: string;
  cover_path: string | null;
  final_video_path: string | null;
  created_at: string;
  updated_at: string;
}): ProjectRecord {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    status: row.status as ProjectRecord["status"],
    sourceType: row.source_type as ProjectRecord["sourceType"],
    language: row.language as ProjectRecord["language"],
    ratio: row.ratio as ProjectRecord["ratio"],
    templateId: row.template_id,
    coverPath: row.cover_path ?? undefined,
    finalVideoPath: row.final_video_path ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapTrendItem(row: {
  id: string;
  source: string;
  title: string;
  url: string | null;
  summary: string | null;
  content: string | null;
  author: string | null;
  score: number;
  comments: number;
  rank: number;
  thumbnail: string | null;
  raw_json: string | null;
  created_at?: string;
}): TrendItem {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    url: row.url ?? undefined,
    summary: row.summary ?? undefined,
    content: row.content ?? undefined,
    author: row.author ?? undefined,
    score: row.score,
    comments: row.comments,
    rank: row.rank,
    thumbnail: row.thumbnail ?? undefined,
    raw: row.raw_json ? JSON.parse(row.raw_json) : {}
  };
}

export function mapScript(row: { script_json: string }): VideoScript {
  return JSON.parse(row.script_json) as VideoScript;
}

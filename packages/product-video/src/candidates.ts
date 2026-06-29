import type { SceneShot, StoryboardScene, VideoStoryboard } from "@trendforge/core";
import { buildSubtitleTracks } from "./storyboard.js";

export type CandidateSpec = {
  id: "a" | "b" | "c";
  title: string;
  theme: "paper-ink" | "news-rank" | "product-deep" | "minimal-visual";
  productDuration: number;
  overviewDuration: number;
  summaryDuration: number;
};

export const candidateSpecs: CandidateSpec[] = [
  { id: "a", title: "纸墨快讯风", theme: "paper-ink", productDuration: 5.8, overviewDuration: 3, summaryDuration: 3 },
  { id: "b", title: "产品解读风", theme: "product-deep", productDuration: 7.8, overviewDuration: 4.5, summaryDuration: 4 },
  { id: "c", title: "极简视觉风", theme: "minimal-visual", productDuration: 6.5, overviewDuration: 3.5, summaryDuration: 3.5 }
];

export function createCandidateStoryboards(base: VideoStoryboard): VideoStoryboard[] {
  return candidateSpecs.map((spec) => {
    const scenes = base.scenes.map((scene): StoryboardScene => {
      const duration = scene.type === "product"
        ? spec.productDuration
        : scene.type === "overview"
          ? spec.overviewDuration
          : scene.type === "summary"
            ? spec.summaryDuration
            : 3;
      return {
        ...scene,
        duration,
        shots: retimeShots(scene.shots, duration),
        visualDirection: `${scene.visualDirection}；候选风格：${spec.title}`
      };
    });
    return {
      ...base,
      title: base.title,
      subtitle: `${base.subtitle} · ${spec.title}`,
      scenes,
      candidate: spec.id,
      theme: spec.theme,
      durationTarget: scenes.reduce((sum, scene) => sum + scene.duration, 0),
      subtitleTracks: buildSubtitleTracks(scenes),
      visualSearch: buildVisualSearch(base, scenes)
    };
  });
}

function buildVisualSearch(base: VideoStoryboard, scenes: StoryboardScene[]): VideoStoryboard["visualSearch"] {
  return {
    provider: base.visualSearch?.provider ?? "product_assets",
    queries: Array.from(new Set(scenes.flatMap((scene) => scene.brollQueries ?? []))).slice(0, 40),
    requiredPerScene: base.visualSearch?.requiredPerScene ?? 2
  };
}

function retimeShots(shots: SceneShot[] | undefined, duration: number): SceneShot[] | undefined {
  if (!shots?.length) return undefined;
  const original = shots.reduce((sum, shot) => sum + shot.duration, 0);
  if (!original) return shots;
  const scale = duration / original;
  let cursor = 0;
  return shots.map((shot, index) => {
    const shotDuration = index === shots.length - 1
      ? Math.max(0.8, Math.round((duration - cursor) * 10) / 10)
      : Math.max(0.8, Math.round(shot.duration * scale * 10) / 10);
    const next = { ...shot, start: Math.round(cursor * 10) / 10, duration: shotDuration };
    cursor += shotDuration;
    return next;
  });
}

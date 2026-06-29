import type { MotionCaptionTrack, MotionGraph, MotionLayer, RenderLintFrameSample, RenderLintIssue, RenderLintReport } from "@trendforge/motion-core";
import { estimateTextCapacity, flattenLayers, overlaps } from "@trendforge/motion-core";

export type RenderLintOptions = {
  jobId?: string;
  sampleFrames?: number[];
  framePathFor?: (frame: number) => string;
};

export function lintMotionGraph(graph: MotionGraph, options: RenderLintOptions = {}): RenderLintReport {
  const issues = [
    ...checkSubtitleSafeArea(graph),
    ...checkTextOverflow(graph),
    ...checkCaptionDensity(graph)
  ];
  return {
    jobId: options.jobId ?? graph.id,
    score: scoreFromIssues(issues),
    issues,
    frameSamples: createFrameSampleManifest(graph, options)
  };
}

export function createFrameSampleManifest(graph: MotionGraph, options: RenderLintOptions = {}): RenderLintFrameSample[] {
  const frames = options.sampleFrames ?? defaultSampleFrames(graph);
  return frames.map((frame) => ({
    frame,
    path: options.framePathFor?.(frame) ?? `frames/${graph.id}_${frame}.png`,
    hash: `pending-${graph.id}-${frame}`
  }));
}

function checkSubtitleSafeArea(graph: MotionGraph): RenderLintIssue[] {
  const layers = flattenLayers(graph);
  const captionAreas = captionSafeAreas(graph, layers);
  const issues: RenderLintIssue[] = [];
  for (const area of captionAreas) {
    for (const layer of layers) {
      if (layer.id === "background" || layer.safeAreaRole === "caption") continue;
      if (layer.kind === "group") continue;
      if (overlaps(layer.frame, area)) {
        issues.push({
          id: `subtitle-overlap-${layer.id}`,
          severity: "warn",
          message: `Layer ${layer.id} overlaps the subtitle safe area.`,
          suggestion: "Move the layer into title or action safe area, or shrink visual content height."
        });
      }
    }
  }
  return issues;
}

function checkTextOverflow(graph: MotionGraph): RenderLintIssue[] {
  return flattenLayers(graph)
    .filter((layer) => layer.kind === "text" && layer.content)
    .flatMap((layer): RenderLintIssue[] => {
      const fontSize = Number(layer.style?.fontSize ?? 32);
      const capacity = estimateTextCapacity(layer.frame, fontSize);
      const length = compactTextLength(layer.content ?? "");
      if (length <= capacity) return [];
      return [{
        id: `text-overflow-${layer.id}`,
        severity: "warn",
        message: `Text layer ${layer.id} has ${length} chars over estimated capacity ${capacity}.`,
        suggestion: "Shorten the copy, reduce font size, increase box width, or split into multiple beats."
      }];
    });
}

function checkCaptionDensity(graph: MotionGraph): RenderLintIssue[] {
  return (graph.captions ?? []).flatMap((track) => checkTrackDensity(track, graph.fps));
}

function checkTrackDensity(track: MotionCaptionTrack, fps: number): RenderLintIssue[] {
  return track.cues.flatMap((cue): RenderLintIssue[] => {
    const seconds = Math.max(0.1, (cue.endFrame - cue.startFrame) / fps);
    const charsPerSecond = compactTextLength(cue.text) / seconds;
    if (charsPerSecond <= 13) return [];
    return [{
      id: `caption-density-${cue.id}`,
      severity: "warn",
      frame: cue.startFrame,
      message: `Caption ${cue.id} runs at ${charsPerSecond.toFixed(1)} chars per second.`,
      suggestion: "Split the cue, shorten the sentence, or extend the cue duration."
    }];
  });
}

function captionSafeAreas(graph: MotionGraph, layers: MotionLayer[]) {
  const fromCaptions = (graph.captions ?? []).map((track) => track.safeArea);
  const fromLayers = layers.filter((layer) => layer.safeAreaRole === "caption").map((layer) => layer.frame);
  return [...fromCaptions, ...fromLayers];
}

function defaultSampleFrames(graph: MotionGraph): number[] {
  const end = Math.max(0, graph.durationFrames - 1);
  return Array.from(new Set([
    0,
    Math.round(end * 0.25),
    Math.round(end * 0.5),
    Math.round(end * 0.75),
    end
  ]));
}

function scoreFromIssues(issues: RenderLintIssue[]): number {
  const penalty = issues.reduce((sum, issue) => {
    if (issue.severity === "error") return sum + 18;
    if (issue.severity === "warn") return sum + 7;
    return sum + 2;
  }, 0);
  return Math.max(0, 100 - penalty);
}

function compactTextLength(value: string): number {
  return value.replace(/\s+/g, "").length;
}

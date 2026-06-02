import { createId, estimateReadDuration, type Scene, type SubtitleCue, type TtsResult } from "@trendforge/core";

export function generateSubtitlesFromScenes(scenes: Scene[], tts?: TtsResult): SubtitleCue[] {
  if (tts?.segments?.length) {
    return tts.segments.map((segment) => ({
      id: createId("cue"),
      start: segment.start ?? 0,
      end: segment.end ?? (segment.start ?? 0) + segment.duration,
      text: segment.text,
      keywords: extractKeywords(segment.text)
    }));
  }

  let cursor = 0;
  return scenes.map((scene) => {
    const duration = scene.duration ?? estimateReadDuration(scene.voiceText);
    const cue: SubtitleCue = {
      id: createId("cue"),
      start: cursor,
      end: cursor + duration,
      text: scene.voiceText,
      textEn: scene.voiceTextEn,
      keywords: extractKeywords(scene.screenText)
    };
    cursor += duration;
    return cue;
  });
}

export function splitCue(cue: SubtitleCue, offsetSeconds?: number): SubtitleCue[] {
  const midpoint = offsetSeconds ?? cue.start + (cue.end - cue.start) / 2;
  const chars = Math.ceil(cue.text.length / 2);
  return [
    { ...cue, id: createId("cue"), end: midpoint, text: cue.text.slice(0, chars).trim() },
    { ...cue, id: createId("cue"), start: midpoint, text: cue.text.slice(chars).trim() }
  ];
}

export function mergeCues(first: SubtitleCue, second: SubtitleCue): SubtitleCue {
  return {
    id: createId("cue"),
    start: Math.min(first.start, second.start),
    end: Math.max(first.end, second.end),
    text: [first.text, second.text].filter(Boolean).join(" "),
    textEn: [first.textEn, second.textEn].filter(Boolean).join(" ") || undefined,
    keywords: [...(first.keywords ?? []), ...(second.keywords ?? [])]
  };
}

export function realignCues(cues: SubtitleCue[], totalDuration: number): SubtitleCue[] {
  const currentDuration = cues[cues.length - 1]?.end ?? totalDuration;
  const factor = currentDuration > 0 ? totalDuration / currentDuration : 1;
  return cues.map((cue) => ({
    ...cue,
    start: Number((cue.start * factor).toFixed(3)),
    end: Number((cue.end * factor).toFixed(3))
  }));
}

function extractKeywords(text: string): string[] {
  return Array.from(new Set(text.match(/[A-Za-z0-9\u4e00-\u9fa5]{2,}/g)?.slice(0, 4) ?? []));
}

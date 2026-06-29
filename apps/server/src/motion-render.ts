/**
 * scriptToStoryboard — coerce a plain VideoScript into a VideoStoryboard.
 *
 * Lets projects that went through the manual script flow feed the unified
 * html-film export pipeline (storyboard → specs → makeFilmHtml → frames → MP4).
 */

import type {
  ProductVideoItem,
  Ratio,
  StoryboardScene,
  TrendItem,
  VideoScript,
  VideoStoryboard
} from "@trendforge/core";

/**
 * Build a minimal VideoStoryboard from a plain VideoScript. Mapping is
 * best-effort: script scene types and metadata are coerced into the storyboard
 * shape the motion-director expects.
 */
export function scriptToStoryboard(
  script: VideoScript,
  options: { ratio: Ratio; source?: VideoStoryboard["source"]; candidate?: "a" | "b" | "c" }
): VideoStoryboard {
  const sceneType = (scene: VideoScript["scenes"][number]): StoryboardScene["type"] => {
    switch (scene.type) {
      case "cover": return "cover";
      case "intro": return "overview";
      case "analysis": return "data";
      case "outro": return "summary";
      default: return scene.items?.length ? "product" : "item";
    }
  };

  const products: ProductVideoItem[] = [];
  const seen = new Set<number>();
  for (const scene of script.scenes) {
    for (const item of scene.items ?? []) {
      const rank = item.rank ?? products.length + 1;
      if (seen.has(rank)) continue;
      seen.add(rank);
      products.push(trendItemToProduct(item, rank));
    }
  }

  const scenes: StoryboardScene[] = script.scenes.map((scene) => {
    const meta = (scene.metadata ?? {}) as Record<string, unknown>;
    const keywords = Array.isArray(meta.keywords) ? meta.keywords.map(String) : undefined;
    const productRank = scene.items?.[0]?.rank;
    return {
      id: scene.id,
      type: sceneType(scene),
      duration: scene.duration ?? 6,
      title: scene.title,
      screenText: scene.screenText,
      narrationTextZh: scene.voiceText,
      narrationTextEn: scene.voiceTextEn ?? "",
      subtitleZh: scene.voiceText,
      subtitleEn: scene.voiceTextEn ?? "",
      productRank: productRank ?? undefined,
      visualDirection: scene.visualHint ?? "",
      keywords,
      brollQueries: Array.isArray(meta.brollQueries) ? meta.brollQueries.map(String) : undefined,
      energy: "fast"
    };
  });

  return {
    title: script.title,
    subtitle: script.subtitle ?? "",
    source: options.source ?? "manual",
    language: script.language,
    ratio: options.ratio,
    durationTarget: scenes.reduce((sum, scene) => sum + scene.duration, 0),
    scenes,
    products,
    subtitleTracks: [],
    candidate: options.candidate ?? "a",
    theme: "paper-ink",
    hashtags: script.hashtags,
    description: script.description
  };
}

function trendItemToProduct(item: TrendItem, rank: number): ProductVideoItem {
  return {
    rank,
    name: item.title,
    tagline: item.summary ?? "",
    oneLineZh: item.summary ?? item.title,
    oneLineEn: "",
    highlightsZh: [item.summary, item.content].filter((value): value is string => Boolean(value)).slice(0, 3),
    highlightsEn: [],
    whyInterestingZh: item.summary ?? "",
    whyInterestingEn: "",
    votes: item.score,
    comments: item.comments,
    website: item.url,
    thumbnailPath: item.thumbnail
  };
}

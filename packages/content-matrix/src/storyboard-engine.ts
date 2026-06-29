import { createId, type CameraMove, type ContentAnalysis, type CreatorStyleAgent, type Language, type MatrixContentType, type ProductVideoItem, type SceneShot, type ShotPace, type ShotTransition, type SourceType, type StoryboardScene, type SubtitleCue, type SubtitleTrack, type TrendItem, type VideoStoryboard } from "@trendforge/core";
import type { MatrixCandidate } from "./matrix-generator.js";

export type StoryboardEngineInput = {
  analysis: ContentAnalysis;
  candidate: MatrixCandidate;
  items?: TrendItem[];
  language: Language;
  source?: SourceType;
  styleAgent?: CreatorStyleAgent;
};

export class StoryboardEngine {
  create(input: StoryboardEngineInput): VideoStoryboard {
    const products = input.candidate.contentType === "tool_list" ? toProducts(input.items ?? []) : [];
    const scenes = createScenes(input.analysis, input.candidate, input.items ?? [], input.styleAgent);
    const subtitleTracks = buildTracks(scenes);
    const queries = Array.from(new Set(scenes.flatMap((scene) => scene.brollQueries ?? []))).slice(0, 40);
    return {
      id: createId("storyboard"),
      title: input.candidate.title,
      subtitle: `${input.candidate.name} · ${input.candidate.persona}`,
      contentType: input.candidate.contentType,
      persona: input.candidate.persona,
      platform: input.candidate.platform,
      source: storyboardSource(input.source),
      language: input.language,
      ratio: input.candidate.ratio,
      durationTarget: scenes.reduce((sum, scene) => sum + scene.duration, 0),
      scenes,
      products,
      subtitleTracks,
      publishPack: {
        titles: [input.candidate.title, input.analysis.topic, input.candidate.hook].filter(Boolean),
        description: publishDescription(input.analysis, input.styleAgent),
        hashtags: hashtagsFor(input.candidate.contentType),
        platformCopies: {
          douyin: `${input.candidate.title}\n${input.candidate.hook}\n${hashtagsFor(input.candidate.contentType).map((tag) => `#${tag}`).join(" ")}`,
          xiaohongshu: `${input.candidate.title}\n\n${input.analysis.keyPoints.slice(0, 4).join("\n")}\n\n${input.styleAgent?.description ?? "本地生成的视频脚本和字幕包已准备好。"}`,
          wechatChannels: `${input.candidate.title}。${input.candidate.hook}`,
          bilibili: `${input.candidate.title}\n\n${input.analysis.facts.join("\n")}`,
          youtube: `${input.candidate.title}\n\n${input.analysis.facts.join("\n")}`
        }
      },
      description: input.analysis.facts.join("\n"),
      hashtags: hashtagsFor(input.candidate.contentType),
      candidate: input.candidate.id,
      theme: themeFor(input.candidate.contentType, input.candidate.id),
      creatorStyle: input.styleAgent,
      audioDirection: audioDirection(input.candidate.contentType, input.styleAgent),
      visualSearch: {
        provider: input.candidate.contentType === "tool_list" ? "product_assets" : "local_first",
        queries,
        requiredPerScene: 2
      }
    };
  }
}

function createScenes(analysis: ContentAnalysis, candidate: MatrixCandidate, items: TrendItem[], styleAgent?: CreatorStyleAgent): StoryboardScene[] {
  const points = createPointPool(analysis, candidate, styleAgent);
  const type = candidate.contentType;
  const scenePlan = createScenePlan(type, items, candidate.id);
  const durations = fitDurations(
    scenePlan.map((item, index) => baseDuration(item.type, index, styleAgent)),
    candidate.durationTarget
  );
  return scenePlan.map((item, index) => {
    const sourceItem = item.itemIndex === undefined ? undefined : items[item.itemIndex];
    const point = sourceItem ? `${sourceItem.title}：${sourceItem.summary ?? sourceItem.content ?? candidate.hook}` : points[index] ?? analysis.topic;
    const styledPoint = item.type === "cover" ? coverHeadline(candidate.title, analysis.topic) : index === 0 ? candidate.hook || styleAgent?.examples.opener || point : point;
    const title = sceneTitle(item.type, type, index, sourceItem, styleAgent);
    const keywords = compactKeywords([analysis.topic, ...analysis.keyPoints, ...(styleAgent?.vocabulary ?? [])]);
    const duration = durations[index] ?? 4.8;
    const narrationText = narrationFor(styledPoint, styleAgent, index);
    const brollQueries = buildBrollQueries(type, item.type, analysis.topic, keywords, sourceItem, styleAgent);
    const energy = energyFor(styleAgent, candidate.id);
    const camera = cameraFor(item.type, index);
    const transition = transitionFor(item.type, index, energy);
    const shots = createShotPlan({
      sceneType: item.type,
      contentType: type,
      title,
      point: styledPoint,
      narrationText,
      duration,
      keywords,
      brollQueries,
      sourceItem,
      styleAgent,
      sceneIndex: index,
      energy
    });
    return {
      id: createId("scene"),
      type: item.type,
      duration,
      title,
      screenText: shortText(styledPoint, item.type === "cover" ? 24 : 54),
      narrationTextZh: narrationText,
      narrationTextEn: narrationText,
      subtitleZh: shortText(narrationText, subtitleLimit(styleAgent)),
      subtitleEn: shortText(narrationText, 76),
      productRank: sourceItem?.rank,
      visualDirection: visualDirection(type, item.type, styleAgent),
      assetHints: [sourceItem?.thumbnail].filter((value): value is string => Boolean(value)),
      keywords,
      shots,
      transition,
      camera,
      brollQueries,
      bgmCue: bgmCueFor(type, energy),
      sfxCue: sfxCueFor(transition, energy),
      energy
    };
  });
}

function buildTracks(scenes: StoryboardScene[]): SubtitleTrack[] {
  let cursor = 0;
  const zh: SubtitleCue[] = [];
  const en: SubtitleCue[] = [];
  const bilingual: SubtitleCue[] = [];
  for (const scene of scenes) {
    const start = cursor;
    const end = cursor + scene.duration;
    zh.push({ id: createId("cue"), sceneId: scene.id, start, end, text: scene.subtitleZh });
    en.push({ id: createId("cue"), sceneId: scene.id, start, end, text: scene.subtitleEn ?? scene.subtitleZh });
    bilingual.push({ id: createId("cue"), sceneId: scene.id, start, end, text: scene.subtitleZh, textEn: scene.subtitleEn });
    cursor = end;
  }
  return [{ language: "zh", cues: zh }, { language: "en", cues: en }, { language: "bilingual", cues: bilingual }];
}

function hashtagsFor(type: MatrixContentType): string[] {
  const map: Record<MatrixContentType, string[]> = {
    tool_list: ["AI工具", "工具推荐", "效率工具"],
    news_explain: ["AI新闻", "科技快讯", "新闻解读"],
    science_explain: ["知识科普", "AI科普", "概念解释"],
    history_story: ["历史故事", "历史科普", "冷知识"],
    opinion_comment: ["趋势观点", "程序员副业", "行业观察"]
  };
  return map[type];
}

function shortText(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function createPointPool(analysis: ContentAnalysis, candidate: MatrixCandidate, styleAgent?: CreatorStyleAgent): string[] {
  return [
    candidate.hook,
    ...analysis.keyPoints,
    ...analysis.facts,
    ...(styleAgent?.viralMechanics ?? []),
    ...(styleAgent?.sceneRules ?? [])
  ].filter(Boolean);
}

function createScenePlan(type: MatrixContentType, items: TrendItem[], candidateId: "a" | "b" | "c"): Array<{ type: StoryboardScene["type"]; itemIndex?: number }> {
  if (type === "tool_list" && items.length) {
    const limit = candidateId === "a" ? Math.min(3, items.length) : Math.min(5, items.length);
    return [{ type: "cover" }, { type: "overview" }, ...Array.from({ length: limit }, (_, itemIndex) => ({ type: "product" as const, itemIndex })), { type: "summary" }];
  }
  const middle: Record<MatrixContentType, StoryboardScene["type"][]> = {
    tool_list: ["overview", "item", "comparison", "data"],
    news_explain: ["hook", "background", "data", "quote", "summary"],
    science_explain: ["hook", "explain", "comparison", "data", "summary"],
    history_story: ["hook", "timeline", "quote", "data", "summary"],
    opinion_comment: ["hook", "quote", "data", "comparison", "summary"]
  };
  const list = middle[type];
  return [{ type: "cover" }, ...list.slice(0, candidateId === "a" ? 3 : candidateId === "b" ? 4 : 5).map((sceneType) => ({ type: sceneType }))];
}

function baseDuration(type: StoryboardScene["type"], index: number, styleAgent?: CreatorStyleAgent): number {
  if (type === "cover") return Math.max(2.6, styleAgent?.pacing.hookSeconds ?? 3.2);
  if (type === "summary") return styleAgent?.pacing.density === "high" ? 3.8 : 4.8;
  return Math.max(3.6, styleAgent?.pacing.sceneSeconds ? styleAgent.pacing.sceneSeconds * 0.78 : index <= 1 ? 4.8 : 5.6);
}

function fitDurations(values: number[], target: number): number[] {
  const sum = values.reduce((total, value) => total + value, 0);
  if (!sum) return values;
  const scale = target / sum;
  return values.map((value) => Math.max(2.6, Math.round(value * scale * 10) / 10));
}

function sceneTitle(type: StoryboardScene["type"], contentType: MatrixContentType, index: number, item?: TrendItem, styleAgent?: CreatorStyleAgent): string {
  if (type === "cover") return styleAgent?.coverTitleRules[0]?.replace("封面标题使用", "").trim() || titleForContentType(contentType);
  if (item) return item.title;
  const labels: Partial<Record<StoryboardScene["type"], string>> = {
    overview: "矩阵总览",
    hook: "为什么值得看",
    background: "背景压缩",
    timeline: "时间线",
    quote: "关键判断",
    data: "核心证据",
    explain: "机制解释",
    comparison: "对比拆解",
    summary: "发布建议",
    item: "重点信号"
  };
  return labels[type] ?? `镜头 ${index + 1}`;
}

function titleForContentType(type: MatrixContentType): string {
  const map: Record<MatrixContentType, string> = {
    tool_list: "工具信号",
    news_explain: "热点信号",
    science_explain: "知识拆解",
    history_story: "历史转折",
    opinion_comment: "观点判断"
  };
  return map[type];
}

function narrationFor(point: string, styleAgent: CreatorStyleAgent | undefined, index: number): string {
  if (!styleAgent) return point;
  if (index === 0) return styleAgent.examples.opener;
  const prefix = styleAgent.narrativeRhythm[index % styleAgent.narrativeRhythm.length];
  return shortText(`${point}。${prefix}`, 92);
}

function subtitleLimit(styleAgent?: CreatorStyleAgent): number {
  if (styleAgent?.pacing.density === "high") return 30;
  if (styleAgent?.pacing.density === "low") return 46;
  return 38;
}

function visualDirection(type: MatrixContentType, sceneType: StoryboardScene["type"], styleAgent?: CreatorStyleAgent): string {
  const style = styleAgent ? `creator-style:${styleAgent.name}:${styleAgent.pacing.density}` : "default-style";
  return `${type}:${sceneType}:${style}:fast-broll:kinetic-captions`;
}

function createShotPlan(input: {
  sceneType: StoryboardScene["type"];
  contentType: MatrixContentType;
  title: string;
  point: string;
  narrationText: string;
  duration: number;
  keywords: string[];
  brollQueries: string[];
  sourceItem?: TrendItem;
  styleAgent?: CreatorStyleAgent;
  sceneIndex: number;
  energy: StoryboardScene["energy"];
}): SceneShot[] {
  const density = input.styleAgent?.pacing.density ?? (input.energy === "viral" ? "high" : "medium");
  const shotDuration = density === "high" ? 1.15 : input.energy === "fast" ? 1.35 : 1.65;
  const count = Math.max(2, Math.min(6, Math.ceil(input.duration / shotDuration)));
  const parts = splitIntoBeats(input.point, count);
  let cursor = 0;
  return Array.from({ length: count }, (_, index) => {
    const remaining = input.duration - cursor;
    const duration = index === count - 1 ? Math.max(0.8, Math.round(remaining * 10) / 10) : Math.max(0.8, Math.round(Math.min(shotDuration, remaining) * 10) / 10);
    const beat = beatName(input.sceneType, index);
    const transitionIn = transitionFor(input.sceneType, input.sceneIndex + index, input.energy);
    const transitionOut = transitionFor(input.sceneType, input.sceneIndex + index + 1, input.energy);
    const camera = cameraFor(input.sceneType, input.sceneIndex + index);
    const pace = paceFor(input.energy);
    const broll = createBrollIntents(input.brollQueries, input.contentType, input.sourceItem, index, input.sceneType);
    const shot: SceneShot = {
      id: createId("shot"),
      start: Math.round(cursor * 10) / 10,
      duration,
      beat,
      onScreenText: shortText(parts[index] ?? input.title, index === 0 ? 20 : 28),
      narrationText: shortText(input.narrationText, 58),
      camera,
      transitionIn,
      transitionOut,
      pace,
      broll,
      sfxCue: sfxCueFor(transitionOut, input.energy),
      bgmCue: bgmCueFor(input.contentType, input.energy),
      visualMotifs: input.keywords.slice(index, index + 3)
    };
    cursor += duration;
    return shot;
  });
}

function buildBrollQueries(
  type: MatrixContentType,
  sceneType: StoryboardScene["type"],
  topic: string,
  keywords: string[],
  item?: TrendItem,
  styleAgent?: CreatorStyleAgent
): string[] {
  const typeWords: Record<MatrixContentType, string[]> = {
    tool_list: ["AI tool interface", "startup product demo", "workflow automation", "creator desk"],
    news_explain: ["technology newsroom", "AI chip data center", "market chart", "breaking tech news"],
    science_explain: ["simple science diagram", "animated concept", "laboratory close up", "network visualization"],
    history_story: ["archive footage", "old newspaper", "timeline map", "historic city"],
    opinion_comment: ["creator talking head", "developer desk", "trend chart", "social media feed"]
  };
  return Array.from(new Set([
    item?.title,
    item?.summary,
    topic,
    sceneTypeLabel(sceneType),
    ...keywords,
    ...(styleAgent?.vocabulary ?? []),
    ...typeWords[type]
  ].filter((value): value is string => Boolean(value)).map((value) => shortText(value, 48)))).slice(0, 8);
}

function createBrollIntents(queries: string[], type: MatrixContentType, item: TrendItem | undefined, offset: number, sceneType: StoryboardScene["type"]): SceneShot["broll"] {
  const mood: SceneShot["broll"][number]["mood"] = type === "tool_list" ? "product" : type === "science_explain" ? "science" : type === "history_story" ? "history" : type === "opinion_comment" ? "opinion" : "news";
  const fallbacks = fallbackVisualsFor(type, sceneType);
  const pool = queries.length ? queries : [item?.title ?? "creator visual"];
  return pool.slice(offset, offset + 3).map((query, index) => ({
    query,
    mood,
    source: item?.thumbnail ? "product_asset" : "generated",
    assetPath: index === 0 ? item?.thumbnail : undefined,
    fallbackVisual: fallbacks[(offset + index) % fallbacks.length]
  }));
}

function fallbackVisualsFor(type: MatrixContentType, sceneType: StoryboardScene["type"]): Array<NonNullable<SceneShot["broll"][number]["fallbackVisual"]>> {
  if (sceneType === "overview") return ["rank-board", "product-interface", "data-stream", "collage", "workflow-map"];
  if (sceneType === "product" || sceneType === "item") return ["product-interface", "workflow-map", "rank-board", "collage", "data-stream"];
  if (sceneType === "timeline" || sceneType === "background") return ["timeline", "news-wall", "collage", "data-stream"];
  if (sceneType === "explain" || sceneType === "comparison" || type === "science_explain") return ["workflow-map", "diagram", "data-stream", "collage"];
  if (sceneType === "quote" || type === "opinion_comment") return ["creator-desk", "keyword-wall", "news-wall", "data-stream"];
  if (sceneType === "summary") return ["rank-board", "creator-desk", "data-stream", "collage"];
  if (type === "news_explain") return ["news-wall", "data-stream", "timeline", "workflow-map"];
  if (type === "history_story") return ["timeline", "news-wall", "collage", "diagram"];
  return ["product-interface", "rank-board", "workflow-map", "collage", "data-stream", "diagram"];
}

function splitIntoBeats(text: string, count: number): string[] {
  const pieces = text.split(/[，。；,.、:：]/).map((part) => part.trim()).filter(Boolean);
  if (pieces.length >= count) return pieces.slice(0, count);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= count * 2) {
    const size = Math.ceil(words.length / count);
    return Array.from({ length: count }, (_, index) => words.slice(index * size, (index + 1) * size).join(" "));
  }
  return Array.from({ length: count }, (_, index) => pieces[index] ?? text);
}

function beatName(type: StoryboardScene["type"], index: number): string {
  const map: Partial<Record<StoryboardScene["type"], string[]>> = {
    cover: ["冷启动", "抛问题", "给结果"],
    overview: ["扫榜", "聚焦", "立期待"],
    product: ["露产品", "给卖点", "给场景", "给判断"],
    hook: ["钩子", "冲突", "收益"],
    explain: ["概念", "机制", "例子"],
    summary: ["收束", "行动", "记忆点"]
  };
  const fallback = ["切入", "证据", "反转", "结论"];
  return map[type]?.[index % (map[type]?.length ?? 1)] ?? fallback[index % fallback.length] ?? "切入";
}

function sceneTypeLabel(type: StoryboardScene["type"]): string {
  const labels: Partial<Record<StoryboardScene["type"], string>> = {
    overview: "fast overview montage",
    hook: "viral hook",
    background: "context b-roll",
    timeline: "timeline motion graphic",
    quote: "quote highlight",
    data: "data visualization",
    explain: "explainer animation",
    comparison: "side by side comparison",
    product: "product showcase",
    summary: "final takeaway"
  };
  return labels[type] ?? "short video b-roll";
}

function cameraFor(type: StoryboardScene["type"], index: number): CameraMove {
  if (type === "cover") return index % 2 === 0 ? "snap-zoom" : "push-in";
  if (type === "product") return ["push-in", "pan-right", "snap-zoom", "pan-left"][index % 4] as CameraMove;
  if (type === "timeline" || type === "background") return "pan-left";
  return ["push-in", "pan-left", "pan-right", "tilt-up", "snap-zoom"][index % 5] as CameraMove;
}

function transitionFor(type: StoryboardScene["type"], index: number, energy?: StoryboardScene["energy"]): ShotTransition {
  if (energy === "viral") return ["whip", "zoom", "flash", "glitch"][index % 4] as ShotTransition;
  if (type === "summary") return "match";
  if (type === "cover") return index % 2 === 0 ? "flash" : "zoom";
  return ["cut", "whip", "wipe", "zoom"][index % 4] as ShotTransition;
}

function paceFor(energy?: StoryboardScene["energy"]): ShotPace {
  if (energy === "viral" || energy === "fast") return "snap";
  if (energy === "calm") return "steady";
  return "fast";
}

function energyFor(styleAgent: CreatorStyleAgent | undefined, candidate: "a" | "b" | "c"): StoryboardScene["energy"] {
  if (styleAgent?.pacing.density === "high" || candidate === "a") return "viral";
  if (styleAgent?.pacing.density === "low" || candidate === "c") return "steady";
  return "fast";
}

function bgmCueFor(type: MatrixContentType, energy?: StoryboardScene["energy"]): string {
  if (energy === "viral") return "future-bass-128bpm";
  if (type === "history_story") return "cinematic-pulse-92bpm";
  if (type === "science_explain") return "minimal-electronic-104bpm";
  return "electronic-news-118bpm";
}

function sfxCueFor(transition: ShotTransition, energy?: StoryboardScene["energy"]): string {
  if (transition === "whip") return energy === "viral" ? "whoosh-hit" : "soft-whoosh";
  if (transition === "zoom") return "bass-pop";
  if (transition === "glitch") return "digital-glitch";
  if (transition === "flash") return "flash-hit";
  return "tap-cut";
}

function audioDirection(type: MatrixContentType, styleAgent?: CreatorStyleAgent): VideoStoryboard["audioDirection"] {
  const density = styleAgent?.pacing.density ?? "medium";
  return {
    voiceStyle: type === "history_story" ? "storytelling" : type === "opinion_comment" ? "commentary" : density === "high" ? "energetic" : "news",
    bgmMood: density === "high" ? "magic-loop" : type === "history_story" ? "cinematic" : type === "science_explain" ? "minimal" : "electronic",
    bpm: density === "high" ? 128 : density === "low" ? 92 : 116,
    sfx: ["tap-cut", "soft-whoosh", "bass-pop", "flash-hit"]
  };
}

function themeFor(type: MatrixContentType, candidate: "a" | "b" | "c"): VideoStoryboard["theme"] {
  if (type === "tool_list") return candidate === "a" ? "paper-ink" : candidate === "b" ? "product-deep" : "minimal-visual";
  if (type === "science_explain") return "minimal-visual";
  if (type === "opinion_comment") return "minimal-visual";
  return candidate === "a" ? "paper-ink" : candidate === "c" ? "minimal-visual" : "news-rank";
}

function storyboardSource(source: SourceType | undefined): VideoStoryboard["source"] {
  if (source === "product-hunt") return "product_hunt";
  if (source === "hacker-news") return "hacker_news";
  if (source === "x-twitter") return "x";
  if (source === "rss") return "rss";
  if (source === "reddit") return "reddit";
  return "manual";
}

function publishDescription(analysis: ContentAnalysis, styleAgent?: CreatorStyleAgent): string {
  const styleLine = styleAgent ? `风格：${styleAgent.name}｜${styleAgent.description}` : "本地矩阵视频生成。";
  return `${analysis.topic}\n\n${analysis.facts.slice(0, 4).join("\n")}\n\n${styleLine}`;
}

function coverHeadline(title: string, topic: string): string {
  const cleaned = title
    .replace(/^(快讯版|标准版|深度版|快讯|拆解|深挖)[：:]\s*/, "")
    .replace(/给.+?的信号$/, "")
    .replace(/[，。；,.].*$/, "")
    .trim();
  return shortText(cleaned || topic, 28);
}

function compactKeywords(values: string[]): string[] {
  const words = values
    .flatMap((value) => value.split(/[，。；,.、\s]/))
    .map((value) => value.trim())
    .filter((value) => value.length >= 2 && value.length <= 12)
    .filter((value) => !["一个", "这个", "工具", "视频", "方案", "结论"].includes(value));
  return Array.from(new Set(words)).slice(0, 4);
}

function toProducts(items: TrendItem[]): ProductVideoItem[] {
  return items.slice(0, 8).map((item, index) => {
    const rank = item.rank ?? index + 1;
    const tagline = item.summary || item.content || item.title;
    const highlights = tagline.split(/[，。；,.]/).map((part) => part.trim()).filter(Boolean).slice(0, 3);
    return {
      rank,
      name: item.title,
      tagline,
      oneLineZh: `${item.title} 的重点是 ${shortText(tagline, 28)}。`,
      oneLineEn: `${item.title}: ${shortText(tagline, 60)}`,
      highlightsZh: highlights.length ? highlights : ["效率提升", "上手成本低", "值得跟踪"],
      highlightsEn: highlights.length ? highlights : ["Efficient", "Easy to try", "Worth tracking"],
      targetUser: item.author ? `来自 ${item.author}` : "创作者 / 工具用户",
      whyInterestingZh: `${item.title} 值得关注，因为它提供了一个明确的内容信号。`,
      whyInterestingEn: `${item.title} is worth watching because it carries a clear content signal.`,
      votes: item.score,
      comments: item.comments,
      website: item.url,
      productHuntUrl: item.source === "product-hunt" ? item.url : undefined,
      thumbnailPath: item.thumbnail
    };
  });
}

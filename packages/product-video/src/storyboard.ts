import { createId, type CameraMove, type Language, type ProductVideoItem, type Ratio, type SceneShot, type ShotTransition, type StoryboardScene, type SubtitleCue, type SubtitleTrack, type TrendItem, type VideoStoryboard } from "@trendforge/core";
import type { ProductAsset } from "./assets.js";

export type StoryboardInput = {
  items: TrendItem[];
  assets: ProductAsset[];
  language: Language;
  ratio: Ratio;
  date: string;
  topCount: number;
  style: string;
  durationTarget?: number;
  candidate?: "a" | "b" | "c";
};

export function createProductHuntStoryboard(input: StoryboardInput): VideoStoryboard {
  const products = input.items.slice(0, input.topCount).map((item, index): ProductVideoItem => {
    const rank = item.rank ?? index + 1;
    const asset = input.assets.find((entry) => entry.rank === rank);
    const tagline = item.summary || item.content || "A new product worth watching from Product Hunt.";
    return {
      rank,
      name: item.title,
      tagline,
      oneLineZh: `${item.title} 主打 ${shortZh(tagline)}。`,
      oneLineEn: `${item.title} is a new product worth watching for ${shortEn(tagline)}.`,
      highlightsZh: buildHighlightsZh(item),
      highlightsEn: buildHighlightsEn(item),
      targetUser: "独立开发者 / AI 工具用户",
      whyInterestingZh: `${item.title} 值得看，因为它把一个具体工作流做得更轻、更快、更容易上手。`,
      whyInterestingEn: `${item.title} is interesting because it makes a focused workflow faster and easier to adopt.`,
      votes: item.score,
      comments: item.comments,
      website: item.url,
      productHuntUrl: item.url,
      logoPath: asset?.logoPath,
      screenshotPath: asset?.websiteDesktopPath ?? asset?.websiteMobilePath,
      thumbnailPath: asset?.thumbnailPath
    };
  });

  const coverScene: StoryboardScene = withShots({
      id: createId("scene"),
      type: "cover",
      duration: 2.8,
      title: `Product Hunt TOP ${products.length}`,
      screenText: `本期 ${products.length} 个值得关注的新产品`,
      narrationTextZh: `今天看 Product Hunt 上 ${products.length} 个值得关注的新产品。`,
      narrationTextEn: `Today, we look at ${products.length} new products from Product Hunt.`,
      subtitleZh: `今天看 Product Hunt 上 ${products.length} 个值得关注的新产品。`,
      subtitleEn: `Today, we look at ${products.length} new products from Product Hunt.`,
      visualDirection: "强封面，产品截图拼贴，大标题快切",
      keywords: ["Product Hunt", "TOP", input.date],
      brollQueries: ["Product Hunt launch page", "AI startup product demo", "creator desk workflow"],
      transition: "flash",
      camera: "snap-zoom",
      bgmCue: "future-bass-128bpm",
      sfxCue: "flash-hit",
      energy: "viral"
    }, "viral");
  const overviewScene: StoryboardScene = withShots({
      id: createId("scene"),
      type: "overview",
      duration: 3.4,
      title: "本期总览",
      screenText: products.map((product) => `#${product.rank} ${product.name}`).join(" / "),
      narrationTextZh: "先快速看完整榜单，再逐个拆解它们解决的问题。",
      narrationTextEn: "First, scan the list, then we break down what each product solves.",
      subtitleZh: "先快速看完整榜单，再逐个拆解它们解决的问题。",
      subtitleEn: "First, scan the list, then we break down what each product solves.",
      visualDirection: "榜单快速扫过，截图墙连续推进，关键词跟拍",
      keywords: products.flatMap((product) => product.highlightsZh.slice(0, 1)),
      assetHints: products.flatMap((product) => [product.screenshotPath, product.thumbnailPath, product.logoPath]).filter((value): value is string => Boolean(value)),
      brollQueries: ["Product Hunt top products", ...products.map((product) => `${product.name} product screenshot`)],
      transition: "whip",
      camera: "pan-right",
      bgmCue: "electronic-news-118bpm",
      sfxCue: "whoosh-hit",
      energy: "fast"
    }, "fast");
  const productScenes = products.map((product): StoryboardScene => withShots({
      id: createId("scene"),
      type: "product",
      duration: 5.8,
      title: `#${product.rank} ${product.name}`,
      screenText: `${product.highlightsZh.slice(0, 2).join(" / ")} · ${product.targetUser ?? "创作者"}`,
      narrationTextZh: `${product.name} 主打 ${shortZh(product.tagline)}，适合快速判断它是否值得继续跟踪。`,
      narrationTextEn: `${product.name}. ${product.oneLineEn} ${product.whyInterestingEn}`,
      subtitleZh: `${product.name}：${shortZh(product.tagline)}。`,
      subtitleEn: `${product.name}: ${shortEn(product.tagline)}.`,
      productRank: product.rank,
      visualDirection: "官网截图主镜头推近，卖点弹幕式浮现，数据条跟随节奏闪现",
      assetHints: [product.screenshotPath, product.thumbnailPath, product.logoPath].filter((value): value is string => Boolean(value)),
      keywords: product.highlightsZh,
      brollQueries: [`${product.name} product demo`, `${product.name} interface`, product.tagline, "AI tool workflow"],
      transition: product.rank % 2 === 0 ? "wipe" : "zoom",
      camera: product.rank % 2 === 0 ? "pan-left" : "push-in",
      bgmCue: "future-bass-128bpm",
      sfxCue: product.rank % 2 === 0 ? "soft-whoosh" : "bass-pop",
      energy: "fast"
    }, "fast"));
  const summaryScene: StoryboardScene = withShots({
      id: createId("scene"),
      type: "summary",
      duration: 3.6,
      title: "本期关键词",
      screenText: summaryKeywords(products).join(" / "),
      narrationTextZh: `本期关键词是：${summaryKeywords(products).join("、")}。适合继续跟踪这些产品的后续迭代。`,
      narrationTextEn: `This episode's keywords are ${summaryKeywords(products).join(", ")}. These products are worth tracking.`,
      subtitleZh: `本期关键词：${summaryKeywords(products).join("、")}。`,
      subtitleEn: `Keywords: ${summaryKeywords(products).join(", ")}.`,
      visualDirection: "关键词快速收束，产品截图缩成矩阵，结尾节拍锁定",
      keywords: summaryKeywords(products),
      assetHints: products.flatMap((product) => [product.screenshotPath, product.thumbnailPath]).filter((value): value is string => Boolean(value)),
      brollQueries: ["AI tools roundup", "productivity workflow", ...summaryKeywords(products)],
      transition: "match",
      camera: "pull-out",
      bgmCue: "future-bass-128bpm",
      sfxCue: "tap-cut",
      energy: "fast"
    }, "fast");
  const scenes: StoryboardScene[] = [coverScene, overviewScene, ...productScenes, summaryScene];

  const subtitleTracks = buildSubtitleTracks(scenes);
  return {
    id: createId("storyboard"),
    title: `Product Hunt TOP ${products.length}`,
    subtitle: `${input.date} · ${input.style}`,
    contentType: "tool_list",
    persona: "工具推荐号",
    platform: input.ratio === "16:9" ? "youtube" : "douyin",
    source: "product_hunt",
    language: input.language,
    ratio: input.ratio,
    durationTarget: scenes.reduce((sum, scene) => sum + scene.duration, 0),
    scenes,
    products,
    subtitleTracks,
    publishPack: buildPublishPack(products, input.date, input.style),
    description: `Product Hunt ${input.date} TOP ${products.length} 自动视频分镜。`,
    hashtags: ["ProductHunt", "AI工具", "独立开发"],
    audioDirection: {
      voiceStyle: "energetic",
      bgmMood: "magic-loop",
      bpm: 128,
      sfx: ["whoosh-hit", "bass-pop", "tap-cut", "flash-hit"]
    },
    visualSearch: {
      provider: "local_first",
      queries: Array.from(new Set(scenes.flatMap((scene) => scene.brollQueries ?? []))).slice(0, 40),
      requiredPerScene: 2
    }
  };
}

export function buildSubtitleTracks(scenes: StoryboardScene[]): SubtitleTrack[] {
  let cursor = 0;
  const zh: SubtitleCue[] = [];
  const en: SubtitleCue[] = [];
  const bilingual: SubtitleCue[] = [];
  for (const scene of scenes) {
    const start = cursor;
    const end = cursor + scene.duration;
    zh.push({ id: createId("cue"), sceneId: scene.id, start, end, text: scene.subtitleZh, keywords: scene.keywords });
    en.push({ id: createId("cue"), sceneId: scene.id, start, end, text: scene.subtitleEn, keywords: scene.keywords });
    bilingual.push({ id: createId("cue"), sceneId: scene.id, start, end, text: scene.subtitleZh, textEn: scene.subtitleEn, keywords: scene.keywords });
    cursor = end;
  }
  return [
    { language: "zh", cues: zh },
    { language: "en", cues: en },
    { language: "bilingual", cues: bilingual }
  ];
}

function buildHighlightsZh(item: TrendItem): string[] {
  const source = [item.summary, item.content, item.title].filter(Boolean).join(" ");
  const pieces = source.split(/[，。；,.]/).map((part) => part.trim()).filter(Boolean);
  return (pieces.length ? pieces : ["提升效率", "产品化明确", "上手成本低"]).slice(0, 3);
}

function buildHighlightsEn(item: TrendItem): string[] {
  const base = item.summary || item.content || item.title;
  const pieces = base.split(/[,.]/).map((part) => part.trim()).filter(Boolean);
  return (pieces.length ? pieces : ["Efficient", "Focused", "Easy to try"]).slice(0, 3);
}

function withShots(scene: StoryboardScene, energy: StoryboardScene["energy"]): StoryboardScene {
  const queries = scene.brollQueries ?? [scene.title, ...(scene.keywords ?? [])];
  return {
    ...scene,
    shots: createShots(scene, queries, energy)
  };
}

function createShots(scene: StoryboardScene, queries: string[], energy: StoryboardScene["energy"]): SceneShot[] {
  const pace = energy === "viral" ? "snap" : "fast";
  const target = energy === "viral" ? 1.05 : 1.25;
  const count = Math.max(2, Math.min(5, Math.ceil(scene.duration / target)));
  const beats = splitBeats(scene.screenText || scene.narrationTextZh, count);
  let cursor = 0;
  return Array.from({ length: count }, (_, index) => {
    const remaining = scene.duration - cursor;
    const duration = index === count - 1 ? Math.max(0.8, Math.round(remaining * 10) / 10) : Math.max(0.8, Math.round(Math.min(target, remaining) * 10) / 10);
    const transitionIn = index === 0 ? scene.transition ?? "flash" : transitions[(index + scene.title.length) % transitions.length] ?? "cut";
    const transitionOut = transitions[(index + 1 + scene.title.length) % transitions.length] ?? "cut";
    const shot: SceneShot = {
      id: createId("shot"),
      start: Math.round(cursor * 10) / 10,
      duration,
      beat: ["钩子", "素材", "卖点", "判断", "收束"][index] ?? "节奏点",
      onScreenText: shortZh(beats[index] ?? scene.title),
      narrationText: shortZh(scene.narrationTextZh),
      camera: cameraMoves[(index + scene.title.length) % cameraMoves.length] ?? "push-in",
      transitionIn,
      transitionOut,
      pace,
      broll: queries.slice(index, index + 3).map((query, queryIndex) => ({
        query,
        mood: "product",
        source: scene.assetHints?.[queryIndex] ? "product_asset" : "generated",
        assetPath: scene.assetHints?.[queryIndex],
        fallbackVisual: fallbackVisualFor(scene.type, index + queryIndex)
      })),
      sfxCue: transitionOut === "zoom" ? "bass-pop" : transitionOut === "whip" ? "whoosh-hit" : "tap-cut",
      bgmCue: scene.bgmCue ?? "future-bass-128bpm",
      visualMotifs: scene.keywords?.slice(index, index + 3)
    };
    cursor += duration;
    return shot;
  });
}

const transitions: ShotTransition[] = ["cut", "whip", "zoom", "wipe", "flash"];
const cameraMoves: CameraMove[] = ["push-in", "pan-right", "snap-zoom", "pan-left", "pull-out"];

function fallbackVisualFor(type: StoryboardScene["type"], index: number): NonNullable<SceneShot["broll"][number]["fallbackVisual"]> {
  const map: Partial<Record<StoryboardScene["type"], Array<NonNullable<SceneShot["broll"][number]["fallbackVisual"]>>>> = {
    cover: ["rank-board", "product-interface", "creator-desk", "data-stream"],
    overview: ["rank-board", "workflow-map", "data-stream", "product-interface"],
    product: ["product-interface", "workflow-map", "rank-board", "data-stream", "collage"],
    summary: ["rank-board", "creator-desk", "data-stream", "workflow-map"]
  };
  const list = map[type] ?? ["product-interface", "workflow-map", "data-stream", "collage"];
  return list[index % list.length] ?? "product-interface";
}

function splitBeats(text: string, count: number): string[] {
  const pieces = text.split(/[，。；,.、/]/).map((part) => part.trim()).filter(Boolean);
  return Array.from({ length: count }, (_, index) => pieces[index] ?? pieces[index % Math.max(1, pieces.length)] ?? text);
}

function summaryKeywords(products: ProductVideoItem[]): string[] {
  return Array.from(new Set(products.flatMap((product) => product.highlightsZh).map((value) => value.slice(0, 12)))).slice(0, 5);
}

function buildPublishPack(products: ProductVideoItem[], date: string, style: string) {
  const names = products.map((product) => product.name).join("、");
  const title = `Product Hunt 今日 ${products.length} 个值得关注的新产品`;
  const tags = ["ProductHunt", "AI工具", "工具推荐", "自媒体素材", "独立开发"];
  return {
    titles: [
      title,
      `今天 Product Hunt 上这 ${products.length} 个产品很有意思`,
      `AI 工具观察：${products[0]?.name ?? "新产品"} 等 ${products.length} 款新品`
    ],
    description: `${date} ${style}。本期覆盖：${names}。视频为无配音版本，可导入剪映添加 AI 配音、BGM 和二次字幕样式。`,
    hashtags: tags,
    platformCopies: {
      douyin: `${title}\n本期产品：${names}\n#${tags.join(" #")}`,
      xiaohongshu: `${title}\n\n适合做 AI 工具选题、产品观察和效率工具内容。\n\n${tags.map((tag) => `#${tag}`).join(" ")}`,
      wechatChannels: `${title}。本期产品：${names}。`,
      bilibili: `${title}\n\n本期围绕 Product Hunt 热门新品，整理产品定位、亮点和适合人群。`,
      youtube: `${title}\n\nA bilingual Product Hunt product brief generated by TrendForge. Products: ${products.map((product) => product.name).join(", ")}.`
    }
  };
}

function shortZh(value: string): string {
  return value.replace(/[。.!].*$/, "").slice(0, 28);
}

function shortEn(value: string): string {
  return value.replace(/[。.!].*$/, "").slice(0, 50);
}

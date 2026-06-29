import type { CreatorStyleAgent, SceneShot, StoryboardScene, VideoStoryboard } from "@trendforge/core";
import type { AssetSlot, MotionDesignPlan, MotionGraph, MotionIntensity, TypographySystem, VisualSceneSpec, VisualType } from "@trendforge/motion-core";
import { defaultSafeAreas } from "@trendforge/motion-core";
import { buildMotionGraph } from "@trendforge/motion-presets";
import { applyMotionDesignPlan, createLocalMotionDesignPlan } from "./design-plan.js";

export type MotionDirectorOptions = {
  fps?: number;
  styleAgent?: CreatorStyleAgent;
  candidate?: "a" | "b" | "c";
  designPlan?: MotionDesignPlan;
};

export type MotionDirectorResult = {
  specs: VisualSceneSpec[];
  graphs: MotionGraph[];
  designPlan: MotionDesignPlan;
};

export function createMotionDirectorPlan(storyboard: VideoStoryboard, options: MotionDirectorOptions = {}): MotionDirectorResult {
  const baseSpecs = storyboardToVisualSpecs(storyboard, options);
  const designPlan = options.designPlan ?? createLocalMotionDesignPlan({
    storyboard,
    specs: baseSpecs,
    candidate: options.candidate ?? storyboard.candidate
  });
  const specs = applyMotionDesignPlan(baseSpecs, designPlan);
  const graphs = specs.map((spec) => visualSpecToMotionGraph(spec, { fps: options.fps }));
  return { specs, graphs, designPlan };
}

export function storyboardToVisualSpecs(storyboard: VideoStoryboard, options: MotionDirectorOptions = {}): VisualSceneSpec[] {
  const styleAgent = options.styleAgent ?? storyboard.creatorStyle;
  const candidate = options.candidate ?? storyboard.candidate ?? "a";
  const safeAreas = defaultSafeAreas(storyboard.ratio);
  const specs = storyboard.scenes.flatMap((scene, sceneIndex) => {
    const shots = scene.shots?.length ? scene.shots : [fallbackShot(scene)];
    return shots.map((shot, shotIndex): VisualSceneSpec => {
      const visualType = chooseVisualType(scene, shot, styleAgent, candidate, sceneIndex + shotIndex);
      const density = styleAgent?.pacing.density ?? densityFor(scene.energy, candidate);
      return {
        id: `spec_${scene.id}_${shot.id}`,
        sceneId: scene.id,
        shotId: shot.id,
        ratio: storyboard.ratio,
        duration: shot.duration,
        visualType,
        contentSlots: {
          headline: headlineFor(scene, shot),
          body: bodyFor(scene, shot),
          image: scene.image,
          assets: sceneAssetsFor(scene, storyboard),
          chips: chipsFor(scene, shot, styleAgent),
          metrics: metricsFor(scene, storyboard),
          entities: entitiesFor(scene, storyboard),
          quote: scene.type === "quote" ? scene.screenText : undefined,
          sourceLabel: sourceLabelFor(storyboard),
          caption: captionFor(scene, shot),
          product: productFor(scene, storyboard)
        },
        motion: {
          pace: shot.pace,
          camera: biasCamera(shot.camera, styleAgent, sceneIndex + shotIndex),
          transitionIn: biasTransition(shot.transitionIn, styleAgent, sceneIndex),
          transitionOut: biasTransition(shot.transitionOut, styleAgent, sceneIndex + shotIndex + 1),
          beatSync: (storyboard.audioDirection?.bpm ?? 0) >= 100 || density === "high",
          intensity: intensityFor(density, scene.energy)
        },
        style: {
          themeId: storyboard.theme ?? "tech-signal",
          typography: typographyFor(storyboard, styleAgent),
          density
        },
        safeAreas
      };
    });
  });
  return differentiateHeadlines(specs);
}

/**
 * Content-side differentiation safety net: guarantee no two scenes render the
 * same headline. Upstream generators (or a thin script) can repeat a project's
 * title across scenes, which makes the exported film look like one frame on a
 * loop. When a headline repeats we re-derive it from the scene's own most
 * distinguishing content (product name/rank, an entity, the first chip), so each
 * scene reads differently even when the source copy is weak.
 */
function differentiateHeadlines(specs: VisualSceneSpec[]): VisualSceneSpec[] {
  const seen = new Map<string, number>();
  return specs.map((spec, index) => {
    const headline = (spec.contentSlots.headline ?? "").trim();
    if (!headline) return spec;
    const count = seen.get(headline) ?? 0;
    seen.set(headline, count + 1);
    if (count === 0) return spec;
    const product = spec.contentSlots.product;
    const distinguisher =
      (product?.name && !headline.includes(product.name) ? product.name : undefined)
      ?? (product?.rank !== undefined ? `#${product.rank}` : undefined)
      ?? spec.contentSlots.entities?.find((entity) => entity && !headline.includes(entity))
      ?? spec.contentSlots.chips?.find((chip) => chip && !headline.includes(chip))
      ?? `${index + 1}`;
    return { ...spec, contentSlots: { ...spec.contentSlots, headline: compact(`${headline} · ${distinguisher}`, 48) } };
  });
}

export function visualSpecToMotionGraph(spec: VisualSceneSpec, options: Pick<MotionDirectorOptions, "fps"> = {}): MotionGraph {
  return buildMotionGraph(spec, { fps: options.fps });
}

function chooseVisualType(scene: StoryboardScene, shot: SceneShot, styleAgent: CreatorStyleAgent | undefined, candidate: "a" | "b" | "c", offset: number): VisualType {
  const preferred = styleAgent?.directorPolicy?.preferredVisualTypes?.[offset % Math.max(1, styleAgent.directorPolicy.preferredVisualTypes.length)];
  if (preferred) return preferred as VisualType;
  const primary = shot.broll[0]?.fallbackVisual;
  if (scene.type === "cover" || scene.type === "overview") return "rank-race";
  if (scene.type === "product" || scene.type === "item" || primary === "product-interface" || primary === "screenshot") return "product-workspace";
  if (scene.type === "timeline" || primary === "timeline") return "timeline-rail";
  if (scene.type === "data" || primary === "data-stream" || primary === "keyword-wall") return "data-pulse";
  if (scene.type === "quote" || primary === "news-wall") return "news-evidence-wall";
  if (scene.type === "summary" || primary === "creator-desk") return "creator-desk";
  if (scene.type === "comparison" || candidate === "c") return "split-compare";
  if (scene.type === "explain" || primary === "diagram") return "whiteboard-explain";
  return "workflow-orbit";
}

function headlineFor(scene: StoryboardScene, shot: SceneShot): string {
  const sceneFirst = scene.type === "product" || scene.type === "summary" || scene.type === "data";
  const value = sceneFirst ? (scene.title || shot.onScreenText || scene.screenText) : (shot.onScreenText || scene.screenText || scene.title);
  return compact(value, 48);
}

// Full narration for the scene — makeFilmHtml splits it into short, time-phased
// subtitle cues (so a long line never loads all at once / gets truncated).
function captionFor(scene: StoryboardScene, shot: SceneShot): string | undefined {
  const raw = (scene.subtitleZh || shot.narrationText || scene.narrationTextZh || scene.screenText || "").trim();
  return raw || undefined;
}

// On-screen body copy: a concise value line (the screen text), distinct from the
// spoken caption.
function bodyFor(scene: StoryboardScene, shot: SceneShot): string | undefined {
  const raw = (scene.screenText || shot.onScreenText || "").trim();
  if (!raw) return undefined;
  return raw.length > 64 ? `${raw.slice(0, 64)}…` : raw;
}

function chipsFor(scene: StoryboardScene, shot: SceneShot, styleAgent?: CreatorStyleAgent): string[] {
  // Display chips stay audience-facing. Director labels and search terms stay
  // inside logs and metadata.
  return unique([
    ...(shot.visualMotifs ?? []),
    ...(scene.keywords ?? []),
    ...(styleAgent?.vocabulary ?? [])
  ]).map((value) => compact(value, 26)).slice(0, 6);
}

function metricsFor(scene: StoryboardScene, storyboard: VideoStoryboard): VisualSceneSpec["contentSlots"]["metrics"] {
  const product = productFor(scene, storyboard);
  if (product && (product.votes !== undefined || product.comments !== undefined)) {
    return [
      { label: "Rank", value: `#${product.rank}` },
      { label: "Votes", value: product.votes === undefined ? "-" : String(product.votes) },
      { label: "Comments", value: product.comments === undefined ? "-" : String(product.comments) }
    ];
  }
  // No real metrics → none (don't fabricate Shots/Seconds/Pace placeholder junk).
  return [];
}

function entitiesFor(scene: StoryboardScene, storyboard: VideoStoryboard): string[] {
  return unique([
    ...storyboard.products.map((product) => product.name),
    ...(scene.keywords ?? []),
    scene.title
  ]).map((value) => compact(value, 24)).slice(0, 8);
}

function productFor(scene: StoryboardScene, storyboard: VideoStoryboard) {
  if (scene.productRank !== undefined) return storyboard.products.find((product) => product.rank === scene.productRank);
  const byTitle = storyboard.products.find((product) => scene.title.includes(product.name));
  return byTitle;
}

function sceneAssetsFor(scene: StoryboardScene, storyboard: VideoStoryboard): AssetSlot[] {
  const assets: AssetSlot[] = [];
  const metadata = (scene as StoryboardScene & { metadata?: Record<string, unknown> }).metadata;
  const imageRole = normalizeAssetRole(stringFromRecord(metadata, "imageRole")) ?? normalizeAssetRole((scene as { imageRole?: unknown }).imageRole) ?? "illustration";
  if (scene.image?.trim()) {
    assets.push({
      role: imageRole,
      src: scene.image,
      source: normalizeAssetSource(stringFromRecord(metadata, "imageSource")) ?? "generated"
    });
  }
  for (const hint of scene.assetHints ?? []) {
    if (!hint?.trim()) continue;
    assets.push({
      role: inferAssetRoleFromPath(hint),
      src: hint,
      source: "local"
    });
  }
  const product = productFor(scene, storyboard);
  if (product) {
    if (product.screenshotPath) assets.push({ role: "screenshot", src: product.screenshotPath, source: "product_asset" });
    if (product.thumbnailPath) assets.push({ role: "thumbnail", src: product.thumbnailPath, source: "product_asset" });
    if (product.logoPath) assets.push({ role: "logo", src: product.logoPath, source: "product_asset" });
  }
  return uniqueAssetSlots(assets);
}

function sourceLabelFor(storyboard: VideoStoryboard): string {
  const labels: Record<VideoStoryboard["source"], string> = {
    product_hunt: "Product Hunt",
    manual: "Manual",
    hacker_news: "Hacker News",
    rss: "RSS",
    reddit: "Reddit",
    x: "X"
  };
  return labels[storyboard.source];
}

function uniqueAssetSlots(assets: AssetSlot[]): AssetSlot[] {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    const key = `${asset.role}:${asset.src}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeAssetRole(value: unknown): AssetSlot["role"] | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toLowerCase();
  const map: Record<string, AssetSlot["role"]> = {
    hero: "hero",
    "hero-image": "hero",
    "product-image": "screenshot",
    "brand-card": "logo",
    background: "background",
    bg: "background",
    logo: "logo",
    screenshot: "screenshot",
    illustration: "illustration",
    diagram: "diagram",
    texture: "texture",
    thumbnail: "thumbnail"
  };
  return map[trimmed];
}

function inferAssetRoleFromPath(value: string): AssetSlot["role"] {
  const lower = value.toLowerCase();
  if (lower.includes("hero")) return "hero";
  if (lower.includes("background") || lower.includes("bg")) return "background";
  if (lower.includes("logo")) return "logo";
  if (lower.includes("screen") || lower.includes("shot")) return "screenshot";
  if (lower.includes("diagram") || lower.includes("chart") || lower.includes("graph")) return "diagram";
  if (lower.includes("texture")) return "texture";
  if (lower.includes("thumb")) return "thumbnail";
  return "illustration";
}

function normalizeAssetSource(value: unknown): AssetSlot["source"] | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toLowerCase();
  const map: Record<string, AssetSlot["source"]> = {
    product_asset: "product_asset",
    generated: "generated",
    manual: "manual",
    local: "local"
  };
  return map[trimmed];
}

function stringFromRecord(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" ? value : undefined;
}

function densityFor(energy: StoryboardScene["energy"], candidate: "a" | "b" | "c"): VisualSceneSpec["style"]["density"] {
  if (energy === "viral" || candidate === "a") return "high";
  if (energy === "steady" || candidate === "c") return "low";
  return "medium";
}

function intensityFor(density: VisualSceneSpec["style"]["density"], energy: StoryboardScene["energy"]): MotionIntensity {
  if (energy === "viral" || density === "high") return 5;
  if (energy === "fast") return 4;
  if (density === "low") return 2;
  return 3;
}

function typographyFor(storyboard: VideoStoryboard, styleAgent?: CreatorStyleAgent): TypographySystem {
  if (styleAgent?.pacing.density === "high") return "creator-pop";
  if (storyboard.contentType === "science_explain") return "clean-explain";
  if (storyboard.contentType === "history_story") return "documentary";
  return "bold-news";
}

function biasCamera(camera: SceneShot["camera"], styleAgent: CreatorStyleAgent | undefined, index: number) {
  const bias = styleAgent?.directorPolicy?.cameraBias;
  return bias?.[index % Math.max(1, bias.length)] ?? camera;
}

function biasTransition(transition: SceneShot["transitionIn"], styleAgent: CreatorStyleAgent | undefined, index: number) {
  const bias = styleAgent?.directorPolicy?.transitionBias;
  return bias?.[index % Math.max(1, bias.length)] ?? transition;
}

function fallbackShot(scene: StoryboardScene): SceneShot {
  return {
    id: `${scene.id}_shot`,
    start: 0,
    duration: scene.duration,
    beat: "切入",
    onScreenText: scene.screenText,
    narrationText: scene.narrationTextZh,
    camera: scene.camera ?? "push-in",
    transitionIn: scene.transition ?? "flash",
    transitionOut: scene.transition ?? "cut",
    pace: scene.energy === "calm" ? "steady" : scene.energy === "steady" ? "fast" : "snap",
    broll: (scene.brollQueries ?? [scene.title]).slice(0, 3).map((query) => ({
      query,
      mood: "abstract",
      source: "generated",
      fallbackVisual: "workflow-map"
    }))
  };
}

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

function compact(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

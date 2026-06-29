import { extractJsonObject, TrendForgeError, type AppSettingMap, type VideoStoryboard } from "@trendforge/core";
import { createLocalMotionDesignPlan } from "@trendforge/motion-director";
import { motionDesignPlanSchema, type MotionDesignPlan, type MotionTemplateManifest, type VisualSceneSpec } from "@trendforge/motion-core";

export type MotionDesignGenerateInput = {
  storyboard: VideoStoryboard;
  specs: VisualSceneSpec[];
  candidate?: "a" | "b" | "c";
  templates: MotionTemplateManifest[];
};

export interface MotionDesignProvider {
  id: string;
  name: string;
  isEnabled(): Promise<boolean>;
  generate(input: MotionDesignGenerateInput): Promise<MotionDesignPlan>;
}

export class LocalMotionDesignProvider implements MotionDesignProvider {
  id = "local-motion-design";
  name = "Local Motion Design";

  async isEnabled(): Promise<boolean> {
    return true;
  }

  async generate(input: MotionDesignGenerateInput): Promise<MotionDesignPlan> {
    return createLocalMotionDesignPlan(input);
  }
}

export class DeepSeekMotionDesignProvider implements MotionDesignProvider {
  id = "deepseek-motion-design";
  name = "DeepSeek Motion Design";

  constructor(private readonly settings: AppSettingMap = process.env) {}

  async isEnabled(): Promise<boolean> {
    return Boolean(this.settings.DEEPSEEK_API_KEY);
  }

  async generate(input: MotionDesignGenerateInput): Promise<MotionDesignPlan> {
    if (!(await this.isEnabled())) return new LocalMotionDesignProvider().generate(input);
    const base = this.settings.DEEPSEEK_API_BASE ?? "https://api.deepseek.com";
    const model = this.settings.DEEPSEEK_MODEL ?? "deepseek-chat";
    const prompt = buildMotionDesignPrompt(input);
    const response = await fetch(`${base.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.settings.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.72,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a senior motion art director. Output strict JSON matching the requested schema."
          },
          { role: "user", content: prompt }
        ]
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new TrendForgeError("DEEPSEEK_MOTION_DESIGN_ERROR", "DeepSeek 动态设计生成失败", { status: response.status, body }, response.status);
    }
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonObject(content));
    } catch (error) {
      throw new TrendForgeError("MOTION_DESIGN_PARSE_ERROR", `动态设计 JSON 解析失败: ${(error as Error).message}`, { preview: content.slice(0, 500) }, 422);
    }
    // The full MotionDesignPlan schema is large and rigid (per-scene enums,
    // ranges, complete palette + typography). Expecting an LLM to emit it
    // byte-perfect is brittle and was the cause of "动态设计结构校验失败". Instead
    // we let DeepSeek drive the creative choices and merge them over a complete,
    // already-valid local base, normalizing enums/ranges. Genuine failures still
    // surface (no design signal at all, or unparseable) — we do NOT silently fall
    // back to the plain local look.
    if (!hasDesignSignal(parsed)) {
      throw new TrendForgeError(
        "MOTION_DESIGN_SCHEMA_ERROR",
        "动态设计结构校验失败：响应缺少 designSystem 或 sceneDesigns",
        { preview: content.slice(0, 500) },
        422
      );
    }
    const merged = coerceMotionDesignPlan(parsed, createLocalMotionDesignPlan(input));
    const result = motionDesignPlanSchema.safeParse(merged);
    if (!result.success) {
      throw new TrendForgeError("MOTION_DESIGN_SCHEMA_ERROR", "动态设计结构校验失败", { issues: result.error.flatten() }, 422);
    }
    return result.data as MotionDesignPlan;
  }
}

const VISUAL_TYPES = ["rank-race", "product-workspace", "news-evidence-wall", "data-pulse", "timeline-rail", "workflow-orbit", "creator-desk", "split-compare", "whiteboard-explain"] as const;
const LAYOUT_VARIANTS = ["poster-stack", "split-editorial", "data-magazine", "kinetic-type", "interface-depth", "evidence-grid", "timeline-broadside", "workflow-map"] as const;
const DECOR_LEVELS = ["minimal", "editorial", "maximal"] as const;
const SIGNATURES = ["snap-stagger", "poster-pop", "kinetic-slam", "soft-reveal", "data-tick", "orbit-sweep"] as const;
const DENSITIES = ["low", "medium", "high"] as const;

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
function strArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : undefined;
}
function enumOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}
function intOf(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : undefined;
}
function clamp(value: unknown, lo: number, hi: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(hi, Math.max(lo, value)) : undefined;
}

/** True when the LLM returned something we can actually treat as a design. */
export function hasDesignSignal(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  const plan = parsed as Record<string, unknown>;
  const ds = plan.designSystem as Record<string, unknown> | undefined;
  const dsSignal = Boolean(ds && typeof ds === "object" && (str(ds.themeId) || ds.palette || str(ds.stylePrompt)));
  const sdSignal = Array.isArray(plan.sceneDesigns) && plan.sceneDesigns.length > 0;
  return dsSignal || sdSignal;
}

/** Overlay the LLM's creative choices onto a complete, valid local base. */
export function coerceMotionDesignPlan(parsed: unknown, base: MotionDesignPlan): MotionDesignPlan {
  const plan = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, any>;
  const ds = (plan.designSystem && typeof plan.designSystem === "object" ? plan.designSystem : {}) as Record<string, any>;
  const pal = (ds.palette && typeof ds.palette === "object" ? ds.palette : {}) as Record<string, any>;
  const typo = (ds.typography && typeof ds.typography === "object" ? ds.typography : {}) as Record<string, any>;
  const accents = strArray(pal.accents);

  const designSystem: MotionDesignPlan["designSystem"] = {
    ...base.designSystem,
    source: "deepseek",
    themeId: str(ds.themeId) ?? base.designSystem.themeId,
    name: str(ds.name) ?? base.designSystem.name,
    stylePrompt: str(ds.stylePrompt) ?? base.designSystem.stylePrompt,
    palette: {
      background: str(pal.background) ?? base.designSystem.palette.background,
      surface: str(pal.surface) ?? base.designSystem.palette.surface,
      ink: str(pal.ink) ?? base.designSystem.palette.ink,
      muted: str(pal.muted) ?? base.designSystem.palette.muted,
      accents: accents && accents.length ? accents : base.designSystem.palette.accents
    },
    typography: {
      display: str(typo.display) ?? base.designSystem.typography.display,
      body: str(typo.body) ?? base.designSystem.typography.body,
      mono: str(typo.mono) ?? base.designSystem.typography.mono,
      headlineWeight: intOf(typo.headlineWeight) ?? base.designSystem.typography.headlineWeight,
      bodyWeight: intOf(typo.bodyWeight) ?? base.designSystem.typography.bodyWeight
    }
  };

  const llmScenes: Record<string, any>[] = Array.isArray(plan.sceneDesigns) ? plan.sceneDesigns.filter((item: unknown) => item && typeof item === "object") : [];
  const findScene = (sceneId: string, shotId: string, index: number): Record<string, any> =>
    llmScenes.find((item) => item.sceneId === sceneId && item.shotId === shotId)
    ?? llmScenes.find((item) => item.sceneId === sceneId)
    ?? llmScenes[index]
    ?? {};

  // Base scene designs are derived from the same specs, so they always align with
  // the storyboard. We only overlay the LLM's per-scene creative choices.
  const sceneDesigns = base.sceneDesigns.map((bd, index) => {
    const l = findScene(bd.sceneId, bd.shotId, index);
    const accentIndex = intOf(l.accentIndex);
    return {
      ...bd,
      templateId: str(l.templateId) ?? bd.templateId,
      visualType: enumOf(l.visualType, VISUAL_TYPES) ?? bd.visualType,
      layoutVariant: enumOf(l.layoutVariant, LAYOUT_VARIANTS) ?? bd.layoutVariant,
      accentIndex: accentIndex !== undefined && accentIndex >= 0 ? accentIndex : bd.accentIndex,
      typographyScale: clamp(l.typographyScale, 0.75, 1.35) ?? bd.typographyScale,
      density: enumOf(l.density, DENSITIES) ?? bd.density,
      rotation: clamp(l.rotation, -12, 12) ?? bd.rotation,
      decor: enumOf(l.decor, DECOR_LEVELS) ?? bd.decor,
      motionSignature: enumOf(l.motionSignature, SIGNATURES) ?? bd.motionSignature,
      emphasisWords: strArray(l.emphasisWords)?.slice(0, 8) ?? bd.emphasisWords,
      rationale: str(l.rationale) ?? bd.rationale
    };
  });

  return {
    ...base,
    id: str(plan.id) ?? base.id,
    name: str(plan.name) ?? base.name,
    generatedBy: "deepseek",
    designSystem,
    sceneDesigns,
    sourceRefs: [{ label: "DeepSeek Motion Design" }, ...(base.sourceRefs ?? [])]
  };
}

export function createMotionDesignProvider(settings: AppSettingMap = process.env): MotionDesignProvider {
  return settings.DEEPSEEK_API_KEY ? new DeepSeekMotionDesignProvider(settings) : new LocalMotionDesignProvider();
}

function buildMotionDesignPrompt(input: MotionDesignGenerateInput): string {
  const storyboard = {
    title: input.storyboard.title,
    subtitle: input.storyboard.subtitle,
    candidate: input.candidate ?? input.storyboard.candidate ?? "a",
    ratio: input.storyboard.ratio,
    theme: input.storyboard.theme,
    scenes: input.storyboard.scenes.map((scene) => ({
      id: scene.id,
      type: scene.type,
      title: scene.title,
      screenText: scene.screenText,
      keywords: scene.keywords,
      shots: scene.shots?.map((shot) => ({ id: shot.id, text: shot.onScreenText, duration: shot.duration, beat: shot.beat }))
    }))
  };
  const specs = input.specs.map((spec) => ({
    id: spec.id,
    sceneId: spec.sceneId,
    shotId: spec.shotId,
    visualType: spec.visualType,
    headline: spec.contentSlots.headline,
    chips: spec.contentSlots.chips,
    entities: spec.contentSlots.entities,
    product: spec.contentSlots.product ? {
      rank: spec.contentSlots.product.rank,
      name: spec.contentSlots.product.name,
      tagline: spec.contentSlots.product.tagline
    } : undefined
  }));
  const templates = input.templates.map((template) => ({
    id: template.id,
    visualType: template.visualType,
    category: template.category,
    tags: template.tags,
    bestFor: template.bestFor,
    output: template.output
  }));
  return [
    "You are designing the motion/visual system for a short vertical video. Return JSON ONLY.",
    "Shape: { designSystem: { themeId, name, stylePrompt, palette: { background, surface, ink, muted, accents[] }, typography: { display, body, mono, headlineWeight, bodyWeight } }, sceneDesigns: [ { sceneId, shotId, templateId, visualType, layoutVariant, accentIndex, typographyScale, density, rotation, decor, motionSignature, emphasisWords[] } ] }.",
    "Make each scene visually DISTINCT: vary accentIndex (integer index into palette.accents), layoutVariant, density and emphasisWords per scene so no two scenes look the same.",
    "palette.accents: 3-5 hex colors. Colors must be hex strings like #1B3A8A.",
    "themeId: 'paper-ink' (bold editorial), 'product-deep' (product UI depth), or 'minimal-visual' (calm explainer); or any 'od-*' open-design id.",
    "IMPORTANT: visualType IS the on-screen layout that gets rendered for the scene — choose it to fit that scene's content and vary it across scenes:",
    "  rank-race / timeline-rail → a numbered ranked list (use for overview / list / ranking scenes);",
    "  product-workspace / creator-desk → a big product hero image + name + highlights + metrics (use for a single product / tool spotlight);",
    "  data-pulse → a chart/metrics layout (use for stats, numbers, growth);",
    "  split-compare → two-column comparison (use for compare / pros-cons);",
    "  workflow-orbit / whiteboard-explain / news-evidence-wall → headline + hero + numbered points (use for explainers / takeaways / cover / intro / outro).",
    `visualType ∈ ${JSON.stringify(VISUAL_TYPES)}.`,
    `layoutVariant ∈ ${JSON.stringify(LAYOUT_VARIANTS)}.`,
    `density ∈ ${JSON.stringify(DENSITIES)}. decor ∈ ${JSON.stringify(DECOR_LEVELS)}. motionSignature ∈ ${JSON.stringify(SIGNATURES)}.`,
    "typographyScale ∈ [0.75, 1.35]; rotation ∈ [-12, 12]; emphasisWords ≤ 8 short strings.",
    "Each sceneDesign MUST reuse an existing sceneId and shotId from Specs below.",
    "templateId: pick from Templates, compose 'trendforge.<visualType>.<layoutVariant>', or choose a semantic family id such as 'trendforge.image-hero', 'trendforge.feature-stack', 'trendforge.metric-rank', 'trendforge.split-compare', or 'trendforge.outro-cta'.",
    "",
    `Storyboard:\n${JSON.stringify(storyboard, null, 2)}`,
    "",
    `Specs (one per scene — produce one sceneDesign each):\n${JSON.stringify(specs, null, 2)}`,
    "",
    `Templates:\n${JSON.stringify(templates, null, 2)}`
  ].join("\n");
}

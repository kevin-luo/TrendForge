import {
  createId,
  extractJsonObject,
  TrendForgeError,
  videoScriptSchema,
  type AppSettingMap,
  type Scene,
  type ScriptGenerateInput,
  type ScriptProvider,
  type VideoScript
} from "@trendforge/core";
import { buildScriptPrompt } from "./prompt.js";
import { MockScriptProvider } from "./mock.js";

export class DeepSeekProvider implements ScriptProvider {
  id = "deepseek";
  name = "DeepSeek";

  constructor(private readonly settings: AppSettingMap = process.env) {}

  async isEnabled(): Promise<boolean> {
    return Boolean(this.settings.DEEPSEEK_API_KEY);
  }

  async generate(input: ScriptGenerateInput): Promise<VideoScript> {
    if (!(await this.isEnabled())) return new MockScriptProvider().generate(input);
    const base = this.settings.DEEPSEEK_API_BASE ?? "https://api.deepseek.com";
    const model = this.settings.DEEPSEEK_MODEL ?? "deepseek-chat";
    const prompt = buildScriptPrompt(input);
    const response = await fetch(`${base.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.settings.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.65,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You output strict JSON only." },
          { role: "user", content: prompt }
        ]
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new TrendForgeError("DEEPSEEK_ERROR", "DeepSeek 脚本生成失败", { status: response.status, body }, response.status);
    }
    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";

    // ── 解析 ──────────────────────────────────────────────────────
    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonObject(content));
    } catch (parseError) {
      // JSON 解析失败时把原始内容截断输出，方便排查
      console.error("[DeepSeek] JSON parse error. Raw content (first 2000 chars):\n", content.slice(0, 2000));
      throw new TrendForgeError(
        "SCRIPT_PARSE_ERROR",
        `LLM 返回内容无法解析为 JSON: ${(parseError as Error).message}`,
        { preview: content.slice(0, 500) },
        422
      );
    }

    // ── 第一次严格校验 ────────────────────────────────────────────
    const result = videoScriptSchema.safeParse(parsed);
    if (!result.success) {
      // 详细 issues 写到 stderr，方便排查
      console.error("[DeepSeek] Schema validation failed (first pass).\nIssues:", JSON.stringify(result.error.flatten(), null, 2));
      console.error("[DeepSeek] Parsed object keys:", Object.keys(parsed as object));

      // ── 宽松修复后重试 ─────────────────────────────────────────
      const fixed = coerceLlmScript(parsed);
      const retry = videoScriptSchema.safeParse(fixed);
      if (!retry.success) {
        console.error("[DeepSeek] Schema validation failed (retry after coerce).\nIssues:", JSON.stringify(retry.error.flatten(), null, 2));
        throw new TrendForgeError(
          "SCRIPT_SCHEMA_ERROR",
          "LLM 返回结构校验失败",
          {
            firstPassIssues: result.error.flatten(),
            retryIssues: retry.error.flatten()
          },
          422
        );
      }
      console.warn("[DeepSeek] Used coerced script (first pass failed, retry passed).");
      return normalizeScript(retry.data as VideoScript);
    }
    return normalizeScript(result.data as VideoScript);
  }

  async regenerateScene(input: ScriptGenerateInput & { scene: Scene; instruction?: string }): Promise<Scene> {
    if (!(await this.isEnabled())) return new MockScriptProvider().regenerateScene(input);
    const regenerated = await this.generate({
      ...input,
      items: input.scene.items?.length ? input.scene.items : input.items,
      targetSeconds: input.scene.duration ?? 12
    });
    const first = regenerated.scenes[0] ?? input.scene;
    return { ...first, id: input.scene.id };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * 宽松修复 LLM 输出中常见的结构问题，再交给 zod 严格校验。
 * 不做任何内容判断，只补齐缺失字段。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function coerceLlmScript(raw: any): unknown {
  if (!raw || typeof raw !== "object") return raw;

  // scenes 可能放在 script.scenes / data.scenes / slides 等嵌套位置
  const scenes: unknown[] = Array.isArray(raw.scenes)
    ? raw.scenes
    : Array.isArray(raw.script?.scenes)
      ? raw.script.scenes
      : Array.isArray(raw.slides)
        ? raw.slides
        : [];

  // hashtags: LLM 有时返回逗号分隔的字符串
  const hashtags: string[] = Array.isArray(raw.hashtags)
    ? (raw.hashtags as unknown[]).map(String)
    : typeof raw.hashtags === "string"
      ? raw.hashtags.split(/[,，\s]+/).filter(Boolean)
      : [];

  return {
    title: raw.title ?? raw.script?.title ?? "AI 视频脚本",
    subtitle: raw.subtitle ?? raw.script?.subtitle,
    language: raw.language ?? "zh",
    voiceoverText: (() => {
      const v = raw.voiceoverText ?? raw.voiceover_text;
      if (typeof v === "string" && v.trim()) return v.trim();
      const fromScenes = (scenes as any[]).map((s) => s?.voiceText ?? s?.voice_text ?? "").filter(Boolean).join("\n");
      return fromScenes || "（暂无配音文本）";
    })(),
    hashtags,
    description: raw.description ?? "",
    scenes: scenes.map(coerceLlmScene)
  };
}

// scene.type 的宽松映射表（LLM 常见变体）
const TYPE_MAP: Record<string, string> = {
  // intro 变体
  opening: "intro",
  open: "intro",
  start: "intro",
  beginning: "intro",
  preface: "intro",
  hook: "intro",
  teaser: "intro",
  // outro 变体
  closing: "outro",
  close: "outro",
  end: "outro",
  ending: "outro",
  conclusion: "outro",
  wrap: "outro",
  wrapup: "outro",
  "wrap-up": "outro",
  cta: "outro",
  // item 变体
  product: "item",
  highlight: "item",
  detail: "item",
  feature: "item",
  segment: "item",
  list: "item",
  slide: "item",
  news: "item",
  story: "item",
  content: "item",
  body: "item",
  main: "item",
  section: "item",
  topic: "item",
  subject: "item",
  case: "item",
  spotlight: "item",
  // analysis 变体
  insight: "analysis",
  summary: "analysis",
  review: "analysis",
  commentary: "analysis",
  takeaway: "analysis",
  reflection: "analysis",
  observation: "analysis",
  discussion: "analysis",
  // cover 变体
  title: "cover",
  header: "cover",
  thumbnail: "cover",
  splash: "cover"
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function coerceLlmScene(raw: any): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const validTypes = ["cover", "intro", "item", "analysis", "outro"] as const;
  const rawType = String(raw.type ?? "item").toLowerCase().trim();

  // 1. 精确匹配
  let type: string = validTypes.find((t) => t === rawType) ?? "";
  // 2. 查映射表
  if (!type) type = TYPE_MAP[rawType] ?? "";
  // 3. 包含匹配
  if (!type) type = validTypes.find((t) => rawType.includes(t)) ?? "";
  // 4. 映射表中有包含匹配
  if (!type) {
    for (const [k, v] of Object.entries(TYPE_MAP)) {
      if (rawType.includes(k)) { type = v; break; }
    }
  }
  // 5. 最终回退
  if (!type) type = "item";

  // id: LLM 可能给数字（1,2,3）或根本不给，统一转成字符串
  const rawId = raw.id;
  const id: string =
    rawId === undefined || rawId === null
      ? createId("scene")
      : String(rawId).startsWith("scene_") || String(rawId).length > 8
        ? String(rawId)
        : createId("scene");

  // 字符串字段：先 coerce 成 string，再去掉空值，确保满足 min(1)
  const coerceStr = (...vals: unknown[]): string => {
    for (const v of vals) {
      const s = v == null ? "" : String(v).trim();
      if (s.length > 0) return s;
    }
    return "—";
  };

  return {
    id,
    type,
    duration: typeof raw.duration === "number" ? raw.duration : undefined,
    title: coerceStr(raw.title, raw.heading, raw.name, "场景"),
    screenText: coerceStr(raw.screenText, raw.screen_text, raw.text, raw.content, raw.title, "—"),
    voiceText: coerceStr(raw.voiceText, raw.voice_text, raw.narration, raw.script, raw.text, raw.content, raw.title, "—"),
    voiceTextEn: raw.voiceTextEn ?? raw.voice_text_en ?? undefined,
    visualHint: raw.visualHint ?? raw.visual_hint ?? undefined
    // items 故意不透传，避免缺少 raw 字段导致嵌套校验失败
  };
}

/** 确保每个 scene 都有 id（正常解析路径也调用此函数做最终保证）。 */
function normalizeScript(script: VideoScript): VideoScript {
  return {
    ...script,
    scenes: script.scenes.map((scene) => ({
      ...scene,
      id: scene.id ?? createId("scene")
    }))
  };
}

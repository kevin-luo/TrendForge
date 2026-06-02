import { z } from "zod";

// LLM 返回的 trendItem 可能缺少 raw，宽松处理
export const trendItemSchema = z.object({
  id: z.string(),
  source: z.string(),
  title: z.string().min(1),
  url: z.string().url().optional(),
  summary: z.string().optional(),
  content: z.string().optional(),
  author: z.string().optional(),
  score: z.number().optional(),
  comments: z.number().optional(),
  rank: z.number().optional(),
  thumbnail: z.string().optional(),
  publishedAt: z.string().optional(),
  raw: z.unknown().optional()           // LLM 往往不输出 raw，改为 optional
});

export const sceneSchema = z.object({
  id: z.string().optional(),            // LLM 不会生成 id，后处理补充
  type: z.enum(["cover", "intro", "item", "analysis", "outro"]),
  duration: z.number().positive().optional(),
  title: z.string().min(1),
  screenText: z.string().min(1),
  voiceText: z.string().min(1),
  voiceTextEn: z.string().optional(),
  items: z.array(trendItemSchema).optional(),
  visualHint: z.string().optional()
});

// 支持 LLM 可能返回的非标准 language 字符串，统一 coerce
const languageSchema = z
  .string()
  .transform((v) => {
    const lower = v.toLowerCase();
    if (lower.includes("bilingual") || lower.includes("双语")) return "bilingual";
    if (lower.startsWith("en")) return "en";
    return "zh"; // 默认中文
  })
  .pipe(z.enum(["zh", "en", "bilingual"]));

export const videoScriptSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  language: languageSchema,
  scenes: z.array(sceneSchema).min(1),
  voiceoverText: z.string().min(1),
  hashtags: z.array(z.string()).optional(),
  description: z.string().optional()
});

export const subtitleCueSchema = z.object({
  id: z.string(),
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string(),
  textEn: z.string().optional(),
  keywords: z.array(z.string()).optional()
});

export const exportSettingsSchema = z.object({
  ratio: z.enum(["9:16", "16:9", "1:1", "4:5", "16:10", "2.35:1", "custom"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.union([z.literal(24), z.literal(30), z.literal(60)]),
  format: z.enum(["mp4", "webm"]),
  burnSubtitles: z.boolean(),
  exportSubtitles: z.boolean(),
  includeBgm: z.boolean(),
  audioOnly: z.boolean(),
  exportCover: z.boolean()
});

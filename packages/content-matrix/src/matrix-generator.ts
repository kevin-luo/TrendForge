import { createId, type ContentAnalysis, type CreatorStyleAgent, type MatrixContentType, type MatrixPlatform, type Ratio } from "@trendforge/core";

export type MatrixCandidate = {
  id: "a" | "b" | "c";
  name: string;
  contentType: MatrixContentType;
  persona: string;
  platform: MatrixPlatform;
  ratio: Ratio;
  durationTarget: number;
  title: string;
  hook: string;
};

export type MatrixGenerateOptions = {
  analysis: ContentAnalysis;
  preferredContentType?: MatrixContentType | "auto";
  platform?: MatrixPlatform;
  ratio?: Ratio;
  persona?: string;
  styleAgent?: CreatorStyleAgent;
};

export class MatrixGenerator {
  generate(options: MatrixGenerateOptions): MatrixCandidate[] {
    const primary = options.preferredContentType && options.preferredContentType !== "auto"
      ? options.preferredContentType
      : options.analysis.contentTypeSuggestion[0] ?? "news_explain";
    const platform = options.platform ?? "douyin";
    const ratio = options.ratio ?? (platform === "bilibili" || platform === "youtube" ? "16:9" : "9:16");
    const persona = options.persona?.trim() || options.styleAgent?.name || personaFor(primary);
    const durations = durationSet(options.styleAgent);
    const angles = options.analysis.suggestedAngles.length ? options.analysis.suggestedAngles : [{
      id: createId("angle"),
      title: `${options.analysis.topic} 的 3 个重点`,
      audience: "泛内容受众",
      contentType: primary,
      hook: `${options.analysis.topic} 值得关注的变化有 3 个。`,
      reason: "默认角度"
    }];

    return [
      { id: "a", name: "快讯版", durationTarget: durations[0] ?? 42, contentType: primary, persona, platform, ratio, title: angles[0]?.title ?? `${options.analysis.topic} 快讯`, hook: angles[0]?.hook ?? "" },
      { id: "b", name: "标准版", durationTarget: durations[1] ?? 60, contentType: angles[1]?.contentType ?? primary, persona: `${persona} · 标准叙事`, platform, ratio, title: angles[1]?.title ?? `${options.analysis.topic} 标准解读`, hook: angles[1]?.hook ?? "" },
      { id: "c", name: "深度版", durationTarget: durations[2] ?? 90, contentType: angles[2]?.contentType ?? primary, persona: `${persona} · 深度拆解`, platform: platform === "douyin" ? "bilibili" : platform, ratio: platform === "douyin" ? "16:9" : ratio, title: angles[2]?.title ?? `${options.analysis.topic} 深度解释`, hook: angles[2]?.hook ?? "" }
    ];
  }
}

function durationSet(styleAgent?: CreatorStyleAgent): [number, number, number] {
  if (!styleAgent) return [42, 60, 90];
  if (styleAgent.pacing.density === "high") return [36, 58, 78];
  if (styleAgent.pacing.density === "low") return [55, 82, 110];
  return [45, 68, 92];
}

function personaFor(type: MatrixContentType): string {
  const map: Record<MatrixContentType, string> = {
    tool_list: "AI 工具推荐号",
    news_explain: "热点解读号",
    science_explain: "知识科普号",
    history_story: "历史故事号",
    opinion_comment: "观点评论号"
  };
  return map[type];
}

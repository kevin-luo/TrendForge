import { createId, type ContentAnalysis, type CreatorStyleAgent, type MatrixContentType, type TrendItem } from "@trendforge/core";
import { ContentTypeEngine } from "./content-type-engine.js";

export type AnalyzeInput = {
  text?: string;
  items?: TrendItem[];
  preferredContentType?: MatrixContentType | "auto";
  styleAgent?: CreatorStyleAgent;
};

export class ContentAnalyzer {
  private readonly contentTypeEngine = new ContentTypeEngine();

  analyze(input: AnalyzeInput): ContentAnalysis {
    const text = [input.text, ...(input.items ?? []).map((item) => `${item.title}. ${item.summary ?? item.content ?? ""}`)].filter(Boolean).join("\n");
    const topic = inferTopic(text, input.items);
    const suggestions = input.preferredContentType && input.preferredContentType !== "auto"
      ? [input.preferredContentType]
      : this.contentTypeEngine.recommend(text || topic);
    const stylePoints = input.styleAgent ? [input.styleAgent.examples.opener, ...input.styleAgent.viralMechanics, ...input.styleAgent.audienceTriggers] : [];
    const keyPoints = [...splitPoints(text || topic), ...stylePoints].filter(Boolean).slice(0, 8);
    const facts = keyPoints.length ? keyPoints : [`围绕「${topic}」生成内容矩阵。`];
    const angles = buildAngles(topic, suggestions, input.styleAgent);
    return {
      topic,
      contentTypeSuggestion: suggestions,
      keyPoints,
      entities: {
        products: (input.items ?? []).map((item) => item.title).slice(0, 8),
        companies: extractCapitalized(text).slice(0, 8),
        dates: extractDates(text)
      },
      facts,
      suggestedAngles: angles
    };
  }
}

function buildAngles(topic: string, suggestions: MatrixContentType[], styleAgent?: CreatorStyleAgent): ContentAnalysis["suggestedAngles"] {
  const baseTypes: MatrixContentType[] = suggestions.length ? suggestions : ["news_explain"];
  return [0, 1, 2].map((index) => {
    const contentType = baseTypes[index] ?? baseTypes[0] ?? "news_explain";
    const hook = styleAgent?.hookPatterns[index] ?? angleHook(topic, contentType);
    const trigger = styleAgent?.audienceTriggers[index] ?? (index === 0 ? "快讯受众" : index === 1 ? "实用主义受众" : "深度解释受众");
    return {
      id: createId("angle"),
      title: styleAgent ? styleTitle(topic, styleAgent, index) : angleTitle(topic, contentType, index),
      audience: trigger,
      contentType,
      hook,
      reason: styleAgent ? `${styleAgent.name} 风格：${styleAgent.viralMechanics[index] ?? styleAgent.description}` : "这个角度适合快速形成可发布的视频资产。"
    };
  });
}

function styleTitle(topic: string, styleAgent: CreatorStyleAgent, index: number): string {
  const prefixes = ["快讯", "拆解", "深挖"];
  const trigger = styleAgent.audienceTriggers[index] ?? styleAgent.niche;
  return `${prefixes[index] ?? "精选"}：${topic} 给${trigger}的信号`;
}

function inferTopic(text: string, items?: TrendItem[]): string {
  if (items?.[0]?.title) return items[0].title;
  const first = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  return first?.slice(0, 42) || "AI 热点观察";
}

function splitPoints(text: string): string[] {
  return text.split(/[\n。.!?？；;]/).map((part) => part.trim()).filter((part) => part.length > 4);
}

function extractCapitalized(text: string): string[] {
  return Array.from(new Set(text.match(/\b[A-Z][A-Za-z0-9-]{2,}\b/g) ?? []));
}

function extractDates(text: string): string[] {
  return Array.from(new Set(text.match(/\b20\d{2}[-/年]\d{1,2}([- /月]\d{1,2})?\b/g) ?? []));
}

function angleTitle(topic: string, type: MatrixContentType, index: number): string {
  const prefix = index === 0 ? "快讯版" : index === 1 ? "标准版" : "深度版";
  if (type === "tool_list") return `${prefix}：${topic} 值得关注的工具信号`;
  if (type === "science_explain") return `${prefix}：把 ${topic} 讲明白`;
  if (type === "history_story") return `${prefix}：${topic} 背后的关键转折`;
  if (type === "opinion_comment") return `${prefix}：我怎么看 ${topic}`;
  return `${prefix}：${topic} 的 3 个重点`;
}

function angleHook(topic: string, type: MatrixContentType): string {
  if (type === "tool_list") return `${topic} 里最值得先看的点是什么？`;
  if (type === "science_explain") return `很多人听过 ${topic}，真正关键的是这个机制。`;
  if (type === "history_story") return `${topic} 的结果，早在一个转折点里埋下了伏笔。`;
  if (type === "opinion_comment") return `${topic} 的表面变化背后，有一个更重要的判断。`;
  return `${topic} 发生后，真正要看的变化有 3 个。`;
}

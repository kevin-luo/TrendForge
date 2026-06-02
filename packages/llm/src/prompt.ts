import type { ScriptGenerateInput } from "@trendforge/core";

export function buildScriptPrompt(input: ScriptGenerateInput): string {
  const items = input.items.map((item, index) => ({
    rank: item.rank ?? index + 1,
    title: item.title,
    summary: item.summary,
    content: item.content,
    score: item.score,
    comments: item.comments,
    source: item.source,
    url: item.url
  }));
  return [
    "你是一个科技产品观察者和短视频脚本编辑。",
    "请把下面的热点内容整理成一个适合 60-90 秒短视频的中文脚本。",
    "要求信息密度高、表达自然、克制、具体。",
    "每条热点都要讲清楚它是什么、解决什么问题、为什么值得看。",
    "受众是程序员、独立开发者、AI 工具用户和自媒体用户。",
    "输出严格 JSON，字段必须匹配 VideoScript：title, subtitle, language, scenes, voiceoverText, hashtags, description。",
    "每个 scene 必须包含 id, type, title, screenText, voiceText，可选 voiceTextEn, duration, visualHint。",
    `语言：${input.language}`,
    `脚本类型：${input.scriptType}`,
    `目标时长：${input.targetSeconds ?? 75} 秒`,
    `热点内容：${JSON.stringify(items, null, 2)}`
  ].join("\n");
}

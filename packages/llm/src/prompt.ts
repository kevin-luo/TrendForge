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
    url: item.url,
    thumbnail: item.thumbnail
  }));
  return [
    "你是一个科技产品观察者和短视频脚本编辑。",
    "请把下面的真实热点内容整理成一个适合 60-90 秒短视频的中文图文海报视频方案。",
    "要求信息密度高、表达自然、克制、具体。",
    "所有判断和描述都基于输入里的 title, summary, content, score, comments, url, thumbnail。",
    "每条热点都要讲清楚它是什么、解决什么问题、为什么值得看；缺少的信息用谨慎表达处理。",
    "结构建议：1 个 cover，1 个 intro，每个产品 1 个 item，1 个 analysis，1 个 outro。",
    "每个 item 场景请保留产品顺序，标题直接使用产品名。",
    "screenText 写 45-80 个中文字符，包含价值点、使用场景或差异化。",
    "voiceText 写 90-140 个中文字符，讲清楚是什么、为什么值得关注、适合谁。",
    "visualHint 写画面提示，说明产品图、品牌图、界面细节和信息层级该如何展示。",
    "每个 scene 可包含 metadata 对象，字段建议：layout, motion, highlights, metrics, imageRole, posterTone。",
    "metadata.layout 可选 hero-image-left, hero-image-right, image-top, split-brief, metric-focus。",
    "metadata.motion 可选 push-in, drift-left, drift-right, reveal-up, scanline。",
    "metadata.highlights 输出 2-4 条短要点，每条 8-18 个中文字符。",
    "metadata.metrics 输出最多 3 个指标文案，比如 Product Hunt 排名、票数、评论数。",
    "受众是程序员、独立开发者、AI 工具用户和自媒体用户。",
    "输出严格 JSON，字段必须匹配 VideoScript：title, subtitle, language, scenes, voiceoverText, hashtags, description。",
    "每个 scene 必须包含 id, type, title, screenText, voiceText，可选 voiceTextEn, duration, visualHint, metadata。",
    `语言：${input.language}`,
    `脚本类型：${input.scriptType}`,
    `目标时长：${input.targetSeconds ?? 75} 秒`,
    `热点内容：${JSON.stringify(items, null, 2)}`
  ].join("\n");
}

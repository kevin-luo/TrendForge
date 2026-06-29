import { createId, nowIso, type CreatorStyleAgent, type CreatorStyleSample, type Language } from "@trendforge/core";

export type ExtractCreatorStyleInput = {
  name?: string;
  niche?: string;
  language?: Language;
  samples: CreatorStyleSample[];
};

export class CreatorStyleExtractor {
  extract(input: ExtractCreatorStyleInput): CreatorStyleAgent {
    const text = input.samples.map((sample) => `${sample.title ?? ""}\n${sample.text}`).join("\n");
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const sentences = splitSentences(text);
    const hookPatterns = inferHookPatterns(lines, sentences);
    const vocabulary = inferVocabulary(text);
    const mechanics = inferViralMechanics(text, sentences);
    const name = input.name?.trim() || inferName(text) || "Creator Style Agent";
    const niche = input.niche?.trim() || inferNiche(text);
    const language = input.language ?? "zh";
    const density = inferDensity(sentences);
    const agent: CreatorStyleAgent = {
      id: createId("style"),
      name,
      niche,
      language,
      description: `${name} 的内容风格画像：${niche}，强调${mechanics.slice(0, 3).join("、")}。`,
      hookPatterns,
      narrativeRhythm: inferRhythm(sentences, density),
      vocabulary,
      sentenceRules: inferSentenceRules(sentences, vocabulary),
      sceneRules: inferSceneRules(mechanics),
      subtitleRules: inferSubtitleRules(density),
      coverTitleRules: inferCoverRules(text),
      audienceTriggers: inferAudienceTriggers(text),
      viralMechanics: mechanics,
      pacing: {
        hookSeconds: density === "high" ? 3 : 4,
        sceneSeconds: density === "high" ? 5 : density === "medium" ? 7 : 9,
        totalSeconds: density === "high" ? 60 : density === "medium" ? 75 : 90,
        density
      },
      examples: {
        opener: hookPatterns[0] ?? "先给你一个判断，这件事的关键在这里。",
        transition: density === "high" ? "接着看第二个信号。" : "把这个信息放到现实里看，变化会更清楚。",
        ending: "最后给一个可执行判断：先看信号，再决定动作。"
      },
      rawSummary: summarizeRaw(lines, mechanics),
      skillMarkdown: "",
      createdAt: nowIso()
    };
    return { ...agent, skillMarkdown: toSkillMarkdown(agent) };
  }
}

function splitSentences(text: string): string[] {
  return text.split(/[。！？!?；;\n]/).map((part) => part.trim()).filter((part) => part.length >= 4);
}

function inferHookPatterns(lines: string[], sentences: string[]): string[] {
  const candidates = [...lines, ...sentences]
    .filter((line) => line.length >= 8)
    .filter((line) => /为什么|你以为|很多人|今天|如果|先说|结论|真相|关键|爆火|离谱|普通人|一条视频|3个|三个|Top|TOP|AI/.test(line))
    .slice(0, 4);
  if (candidates.length) return candidates.map((line) => trimText(line, 42));
  return [
    "先说结论，这个热点真正值得看的地方有三个。",
    "很多人只看到了表面变化，核心信号藏在后面。",
    "如果你做自媒体，这个选题可以拆成三个爆点。"
  ];
}

function inferVocabulary(text: string): string[] {
  const zhWords = Array.from(new Set(text.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,12}/g) ?? []))
    .filter((word) => !/^\d+$/.test(word))
    .filter((word) => !["这个", "一个", "我们", "他们", "今天", "视频", "内容"].includes(word));
  const preferred = zhWords.filter((word) => /AI|工具|流量|爆火|信号|效率|普通人|认知|趋势|逻辑|产品|历史|真相|关键|成本/.test(word));
  return Array.from(new Set([...preferred, ...zhWords])).slice(0, 16);
}

function inferViralMechanics(text: string, sentences: string[]): string[] {
  const mechanics: string[] = [];
  if (/[0-9一二三四五六七八九十]+个|Top|TOP|清单|榜单/.test(text)) mechanics.push("数字清单降低理解成本");
  if (/为什么|真相|关键|底层|本质/.test(text)) mechanics.push("问题式开场制造继续看的理由");
  if (/很多人|你以为|普通人|大多数/.test(text)) mechanics.push("大众误区带出反差");
  if (/案例|比如|举个例子|故事|转折/.test(text)) mechanics.push("案例承接抽象判断");
  if (/结论|建议|行动|收藏|关注/.test(text)) mechanics.push("结尾给出可执行动作");
  if (sentences.some((sentence) => sentence.length <= 18)) mechanics.push("短句密集推进节奏");
  return mechanics.length ? mechanics.slice(0, 8) : ["强钩子开场", "分段解释", "结尾给判断"];
}

function inferRhythm(sentences: string[], density: CreatorStyleAgent["pacing"]["density"]): string[] {
  const average = sentences.length ? Math.round(sentences.reduce((sum, sentence) => sum + sentence.length, 0) / sentences.length) : 24;
  return [
    `平均句长约 ${average} 字，画面字幕适合分成 1-2 行`,
    density === "high" ? "每 4-6 秒切换一个视觉主题" : density === "medium" ? "每 6-8 秒切换一个视觉主题" : "每 8-10 秒给一个完整解释段",
    "开场先给判断，再补证据和例子",
    "结尾回到观众行动或判断"
  ];
}

function inferDensity(sentences: string[]): CreatorStyleAgent["pacing"]["density"] {
  if (!sentences.length) return "medium";
  const average = sentences.reduce((sum, sentence) => sum + sentence.length, 0) / sentences.length;
  if (average <= 18) return "high";
  if (average <= 32) return "medium";
  return "low";
}

function inferSentenceRules(sentences: string[], vocabulary: string[]): string[] {
  return [
    "每段先放观点，再放理由",
    "标题词反复出现，保持选题记忆点",
    vocabulary.length ? `高频词优先使用：${vocabulary.slice(0, 6).join("、")}` : "用明确名词替代空泛形容词",
    sentences.some((sentence) => /，/.test(sentence)) ? "长句拆成两条字幕，保留停顿感" : "短句连续推进，减少停顿"
  ];
}

function inferSceneRules(mechanics: string[]): string[] {
  return [
    "第 1 镜给钩子和判断",
    "第 2 镜交代背景或榜单规则",
    "中段每镜只讲一个信息点",
    mechanics.includes("案例承接抽象判断") ? "关键镜头配一个具体案例" : "关键镜头配一个数字或对比",
    "收尾镜给观点、行动和平台文案方向"
  ];
}

function inferSubtitleRules(density: CreatorStyleAgent["pacing"]["density"]): string[] {
  return [
    density === "high" ? "单条字幕控制在 18-24 字" : "单条字幕控制在 24-32 字",
    "重点词可做双色强调",
    "英文字幕放在中文下方，字号低一级",
    "每个镜头至少出现一次关键词"
  ];
}

function inferCoverRules(text: string): string[] {
  const numberDriven = /[0-9一二三四五六七八九十]+个|Top|TOP/.test(text);
  return [
    numberDriven ? "封面标题使用数字 + 强名词" : "封面标题使用观点 + 冲突词",
    "主标题控制在 8-14 字",
    "副标题补充平台、时间或受众",
    "封面视觉保留 1 个主主体和 1 个高亮词"
  ];
}

function inferAudienceTriggers(text: string): string[] {
  const triggers = [];
  if (/普通人|小白|新手/.test(text)) triggers.push("普通人也能理解");
  if (/赚钱|副业|商业|增长/.test(text)) triggers.push("商业结果");
  if (/效率|工具|自动化/.test(text)) triggers.push("效率提升");
  if (/历史|故事|人物/.test(text)) triggers.push("故事反转");
  if (/AI|模型|科技/.test(text)) triggers.push("技术趋势");
  return triggers.length ? triggers : ["省时间", "看懂趋势", "可执行判断"];
}

function inferName(text: string): string | undefined {
  const match = text.match(/博主[:：]\s*([^\n，。]{2,24})/);
  return match?.[1]?.trim();
}

function inferNiche(text: string): string {
  if (/历史|朝代|人物|战争/.test(text)) return "历史故事";
  if (/科普|科学|原理|机制/.test(text)) return "知识科普";
  if (/AI|工具|模型|Product Hunt/.test(text)) return "AI 工具与科技趋势";
  if (/商业|创业|增长|产品/.test(text)) return "商业与产品洞察";
  return "热点解读";
}

function summarizeRaw(lines: string[], mechanics: string[]): string {
  return [`样本共 ${lines.length} 行。`, `主要爆点机制：${mechanics.join("、")}。`].join(" ");
}

function toSkillMarkdown(agent: CreatorStyleAgent): string {
  return [
    `# ${agent.name}`,
    "",
    `定位：${agent.niche}`,
    "",
    "## 开场模式",
    ...agent.hookPatterns.map((item) => `- ${item}`),
    "",
    "## 分镜规则",
    ...agent.sceneRules.map((item) => `- ${item}`),
    "",
    "## 文案规则",
    ...agent.sentenceRules.map((item) => `- ${item}`),
    "",
    "## 字幕规则",
    ...agent.subtitleRules.map((item) => `- ${item}`),
    "",
    "## 封面标题规则",
    ...agent.coverTitleRules.map((item) => `- ${item}`),
    "",
    "## 爆点机制",
    ...agent.viralMechanics.map((item) => `- ${item}`)
  ].join("\n");
}

function trimText(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

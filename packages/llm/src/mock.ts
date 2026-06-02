import {
  createId,
  estimateReadDuration,
  type Scene,
  type ScriptGenerateInput,
  type ScriptProvider,
  type TrendItem,
  type VideoScript
} from "@trendforge/core";

export class MockScriptProvider implements ScriptProvider {
  id = "mock-script";
  name = "Local Mock Script";

  async isEnabled(): Promise<boolean> {
    return true;
  }

  async generate(input: ScriptGenerateInput): Promise<VideoScript> {
    const items = normalizeItems(input.items);
    const topTitles = items.slice(0, 3).map((item) => item.title).join(" / ");
    const scenes: Scene[] = [
      {
        id: createId("scene"),
        type: "cover",
        duration: 5,
        title: "今日 AI 产品信号",
        screenText: topTitles || "本地 AI 视频工作流",
        voiceText: "今天看三个值得关注的产品信号，重点放在它们解决的问题和可能带来的使用场景。",
        voiceTextEn: "Today we look at three product signals and why they matter.",
        visualHint: "large title, low-saturation cyan glow, data grid"
      },
      {
        id: createId("scene"),
        type: "intro",
        duration: 7,
        title: "筛选逻辑",
        screenText: "看价值、看效率、看落地场景",
        voiceText: "这不是单纯看热度，我们重点看三件事：用户痛点是否清楚，效率提升是否明显，落地场景是否真实。",
        voiceTextEn: "We focus on user pain, efficiency gains, and realistic workflows.",
        visualHint: "HUD checklist, subtle scan lines"
      }
    ];

    items.slice(0, 5).forEach((item, index) => {
      const voiceText = `${item.title} 排在第 ${index + 1} 位。${item.summary ?? item.content ?? "它提供了一个值得观察的新方向。"} 它值得看的地方，是把一个具体流程压缩成更短的操作路径。`;
      scenes.push({
        id: createId("scene"),
        type: "item",
        duration: estimateReadDuration(voiceText),
        title: item.title,
        screenText: item.summary ?? item.title,
        voiceText,
        voiceTextEn: `${item.title} is worth watching because it compresses a real workflow into fewer steps.`,
        items: [item],
        visualHint: "rank number, product card, source badge, animated data bar"
      });
    });

    scenes.push(
      {
        id: createId("scene"),
        type: "analysis",
        duration: 9,
        title: "共同趋势",
        screenText: "工具正在从单点能力走向可组合工作流",
        voiceText: "这些热点的共同趋势很清楚：AI 工具正在从单点功能，走向可以嵌入真实工作流的系统能力。",
        voiceTextEn: "The shared signal is workflow-level AI tooling.",
        visualHint: "network lines, grouped cards"
      },
      {
        id: createId("scene"),
        type: "outro",
        duration: 6,
        title: "下一步观察",
        screenText: "关注真实使用成本和长期维护能力",
        voiceText: "后续真正值得跟踪的是它们的真实使用成本、团队协作体验，以及长期维护能力。",
        voiceTextEn: "The next thing to watch is real adoption cost and maintainability.",
        visualHint: "closing grid, export-ready title lockup"
      }
    );

    return {
      title: "今日 AI 产品信号",
      subtitle: "热点、效率与真实工作流",
      language: input.language,
      scenes,
      voiceoverText: scenes.map((scene) => scene.voiceText).join("\n"),
      hashtags: ["AI工具", "独立开发", "Productivity", "TrendForge"],
      description: "从热点内容中筛选值得关注的 AI 产品和开发者工具。"
    };
  }

  async regenerateScene(input: ScriptGenerateInput & { scene: Scene; instruction?: string }): Promise<Scene> {
    const regenerated = await this.generate({ ...input, items: input.scene.items ?? input.items });
    const base = regenerated.scenes.find((scene) => scene.type === input.scene.type) ?? regenerated.scenes[0] ?? input.scene;
    return {
      ...base,
      id: input.scene.id,
      title: input.scene.title,
      visualHint: input.instruction ?? input.scene.visualHint
    };
  }
}

function normalizeItems(items: TrendItem[]): TrendItem[] {
  if (items.length) return items;
  return [
    {
      id: createId("item"),
      source: "manual",
      title: "TrendForge 本地视频工作台",
      summary: "把热点内容整理成脚本、配音、字幕和可导出视频的本地工具。",
      rank: 1,
      raw: { fallback: true }
    }
  ];
}

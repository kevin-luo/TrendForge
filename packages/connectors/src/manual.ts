import { createId, type FetchOptions, type SourceConnector, type TrendItem } from "@trendforge/core";

export class ManualConnector implements SourceConnector {
  id = "manual" as const;
  name = "Manual Input";
  description = "Paste text, links, articles, or notes and convert them into trend items.";
  requiresAuth = false;

  async isEnabled(): Promise<boolean> {
    return true;
  }

  async fetchTrending(options: FetchOptions): Promise<TrendItem[]> {
    const text = options.manualText?.trim() ?? "";
    const links = options.manualLinks ?? [];
    if (!text && links.length === 0) {
      return [
        {
          id: createId("manual"),
          source: this.id,
          title: "本地 AI 工具趋势观察",
          summary: "用户可以粘贴热点文字、链接或文章，TrendForge 会把它整理为可编辑的视频制作素材。",
          content: "TrendForge 支持本地优先的视频生产流程，包含热点采集、AI 脚本、配音、字幕、封面和多比例导出。",
          rank: 1,
          raw: { fallback: true }
        }
      ];
    }
    const mainTitle = text.split(/\r?\n/).find((line) => line.trim().length > 0)?.slice(0, 80) ?? "手动输入内容";
    return [
      {
        id: createId("manual"),
        source: this.id,
        title: mainTitle,
        summary: text.slice(0, 180),
        content: [text, ...links].filter(Boolean).join("\n"),
        rank: 1,
        raw: { text, links }
      }
    ];
  }
}

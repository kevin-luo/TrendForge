import { createId, type FetchOptions, type SearchOptions, type SourceConnector, type TrendItem } from "@trendforge/core";

export class RedditConnector implements SourceConnector {
  id = "reddit" as const;
  name = "Reddit";
  description = "Fetch hot, new, or top posts from a subreddit using public JSON or configured credentials.";
  requiresAuth = false;

  constructor(
    private readonly clientId?: string,
    private readonly clientSecret?: string,
    private readonly userAgent?: string
  ) {}

  async isEnabled(): Promise<boolean> {
    return true;
  }

  async fetchTrending(options: FetchOptions): Promise<TrendItem[]> {
    const subreddit = options.subreddit ?? "LocalLLaMA";
    const mode = options.mode === "new" || options.mode === "top" ? options.mode : "hot";
    const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/${mode}.json?limit=${Math.min(options.limit ?? 10, 25)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": this.userAgent ?? "TrendForge/0.1" },
      signal: AbortSignal.timeout(options.timeoutMs ?? 15000)
    });
    if (!response.ok) return fallbackRedditItems("Reddit 请求失败，已使用本地示例内容。");
    const json = (await response.json()) as {
      data?: { children?: Array<{ data: Record<string, unknown> }> };
    };
    return (json.data?.children ?? []).map((child, index) => {
      const data = child.data;
      return {
        id: createId("reddit"),
        source: this.id,
        title: String(data.title ?? "Untitled Reddit Post"),
        url: data.url ? String(data.url) : undefined,
        summary: data.selftext ? String(data.selftext).slice(0, 240) : undefined,
        content: data.selftext ? String(data.selftext) : undefined,
        author: data.author ? String(data.author) : undefined,
        score: Number(data.score ?? 0),
        comments: Number(data.num_comments ?? 0),
        rank: index + 1,
        publishedAt: data.created_utc ? new Date(Number(data.created_utc) * 1000).toISOString() : undefined,
        raw: data
      };
    });
  }

  async search(query: string, options: SearchOptions): Promise<TrendItem[]> {
    return this.fetchTrending({ ...options, query });
  }
}

function fallbackRedditItems(message = "Reddit 网络请求未返回内容，已使用本地示例内容。"): TrendItem[] {
  return [
    {
      id: createId("reddit-fallback"),
      source: "reddit",
      title: "LocalLLaMA 热议：本地模型工作流正在进入产品化阶段",
      summary: message,
      content: "开发者关注点从单次模型效果转向可复用工作流、评测、数据管理和本地部署体验。",
      score: 86,
      comments: 21,
      rank: 1,
      raw: { fallback: true }
    },
    {
      id: createId("reddit-fallback"),
      source: "reddit",
      title: "AI 工具链讨论：从聊天助手到自动化生产台",
      summary: "社区讨论集中在可观测任务、可编辑输出和本地资产管理。",
      content: "这类讨论适合生成趋势解读视频，强调工具从辅助问答进入端到端生产流程。",
      score: 72,
      comments: 18,
      rank: 2,
      raw: { fallback: true }
    }
  ];
}

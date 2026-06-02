import { createId, type FetchOptions, type SearchOptions, type SourceConnector, type TrendItem } from "@trendforge/core";

export class XTwitterConnector implements SourceConnector {
  id = "x-twitter" as const;
  name = "X / Twitter";
  description = "Optional keyword search connector for X API users.";
  requiresAuth = true;

  constructor(private readonly bearerToken?: string) {}

  async isEnabled(): Promise<boolean> {
    return Boolean(this.bearerToken);
  }

  async fetchTrending(_options: FetchOptions): Promise<TrendItem[]> {
    if (!(await this.isEnabled())) return disabledXItems();
    return this.search("AI tools", { query: "AI tools" });
  }

  async search(query: string, options: SearchOptions): Promise<TrendItem[]> {
    if (!(await this.isEnabled())) return disabledXItems();
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${Math.min(options.limit ?? 10, 20)}&tweet.fields=created_at,public_metrics,author_id`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.bearerToken}` },
      signal: AbortSignal.timeout(options.timeoutMs ?? 15000)
    });
    if (!response.ok) return disabledXItems("X API 请求失败，检查 Bearer Token 和接口权限。");
    const json = (await response.json()) as { data?: Array<Record<string, unknown>> };
    return (json.data ?? []).map((tweet, index) => ({
      id: createId("x"),
      source: this.id,
      title: String(tweet.text ?? "Untitled Tweet").slice(0, 90),
      content: String(tweet.text ?? ""),
      author: tweet.author_id ? String(tweet.author_id) : undefined,
      score: Number((tweet.public_metrics as Record<string, unknown> | undefined)?.like_count ?? 0),
      comments: Number((tweet.public_metrics as Record<string, unknown> | undefined)?.reply_count ?? 0),
      rank: index + 1,
      publishedAt: tweet.created_at ? String(tweet.created_at) : undefined,
      raw: tweet
    }));
  }
}

function disabledXItems(message = "X/Twitter 尚未配置 Bearer Token，设置完成后即可启用。"): TrendItem[] {
  return [
    {
      id: createId("x-disabled"),
      source: "x-twitter",
      title: "X/Twitter 未启用",
      summary: message,
      rank: 1,
      raw: { disabled: true }
    }
  ];
}

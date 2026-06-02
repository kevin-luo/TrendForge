import { createId, type FetchOptions, type SourceConnector, type TrendItem } from "@trendforge/core";
import { connectorCache } from "./cache.js";

type ProductHuntPost = {
  id: string;
  name: string;
  tagline?: string;
  description?: string;
  votesCount?: number;
  commentsCount?: number;
  url?: string;
  website?: string;
  thumbnail?: { url?: string };
};

export class ProductHuntConnector implements SourceConnector {
  id = "product-hunt" as const;
  name = "Product Hunt";
  description = "Fetch daily product launches from the Product Hunt GraphQL API.";
  requiresAuth = true;

  constructor(private readonly token?: string) {}

  async isEnabled(): Promise<boolean> {
    return true;
  }

  async fetchTrending(options: FetchOptions): Promise<TrendItem[]> {
    const limit = Math.min(options.limit ?? 10, 20);
    const cacheKey = `ph:${limit}:${Boolean(this.token)}`;
    const cached = connectorCache.get<TrendItem[]>(cacheKey);
    if (cached) return cached;
    if (!this.token) return mockProductHuntItems(limit);

    const response = await fetch("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: `
          query Posts($limit: Int!) {
            posts(first: $limit, order: RANKING) {
              edges {
                node {
                  id
                  name
                  tagline
                  description
                  votesCount
                  commentsCount
                  url
                  website
                  thumbnail { url }
                }
              }
            }
          }
        `,
        variables: { limit }
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 15000)
    });
    if (!response.ok) return mockProductHuntItems(limit);
    const json = (await response.json()) as {
      data?: { posts?: { edges?: Array<{ node: ProductHuntPost }> } };
    };
    const posts = json.data?.posts?.edges?.map((edge) => edge.node) ?? [];
    return connectorCache.set(
      cacheKey,
      posts.map((post, index) => ({
        id: createId("ph"),
        source: this.id,
        title: post.name,
        url: post.website ?? post.url,
        summary: post.tagline,
        content: post.description,
        score: post.votesCount ?? 0,
        comments: post.commentsCount ?? 0,
        thumbnail: post.thumbnail?.url,
        rank: index + 1,
        raw: post
      })),
      5 * 60 * 1000
    );
  }
}

export function mockProductHuntItems(limit = 8): TrendItem[] {
  const items = [
    ["VectorPilot", "把 Figma 设计稿转成可维护前端代码的本地 AI 工具。"],
    ["ShipPulse", "面向独立开发者的产品发布监控和增长提醒工作台。"],
    ["PromptDesk", "团队提示词资产管理、评审和版本控制工具。"],
    ["LocalLens", "本地优先的截图搜索与视觉知识库。"],
    ["BuildRadar", "追踪 GitHub、HN、PH 热门工具的产品情报面板。"]
  ];
  return items.slice(0, limit).map(([title, summary], index) => ({
    id: createId("phmock"),
    source: "product-hunt",
    title: title ?? "Mock Product",
    summary,
    content: `${summary} 这个产品的核心价值在于减少信息整理和发布决策的成本。`,
    score: 120 - index * 13,
    comments: 24 - index * 2,
    rank: index + 1,
    raw: { fallback: true }
  }));
}

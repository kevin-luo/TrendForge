import { createId, type FetchOptions, type SourceConnector, type TrendItem } from "@trendforge/core";
import { connectorCache } from "./cache.js";
import { fetchJson } from "./http.js";

type HnStory = {
  id: number;
  by?: string;
  descendants?: number;
  score?: number;
  time?: number;
  title?: string;
  type?: string;
  url?: string;
  text?: string;
};

export class HackerNewsConnector implements SourceConnector {
  id = "hacker-news" as const;
  name = "Hacker News";
  description = "Fetch top, new, or best stories from the public Hacker News API.";
  requiresAuth = false;

  async isEnabled(): Promise<boolean> {
    return true;
  }

  async fetchTrending(options: FetchOptions): Promise<TrendItem[]> {
    const mode = options.mode === "newstories" || options.mode === "beststories" ? options.mode : "topstories";
    const limit = Math.min(options.limit ?? 12, 30);
    const cacheKey = `hn:${mode}:${limit}`;
    const cached = connectorCache.get<TrendItem[]>(cacheKey);
    if (cached) return cached;

    const ids = await fetchJson<number[]>(`https://hacker-news.firebaseio.com/v0/${mode}.json`, {
      label: `Hacker News ${mode}`,
      timeoutMs: options.timeoutMs
    });
    const stories = await Promise.all(
      ids.slice(0, limit).map((id) =>
        fetchJson<HnStory>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
          label: `Hacker News item ${id}`,
          timeoutMs: options.timeoutMs
        }).catch(() => undefined)
      )
    );
    return connectorCache.set(
      cacheKey,
      stories
        .filter((story): story is HnStory => Boolean(story?.title))
        .map((story, index) => ({
          id: createId("hn"),
          source: this.id,
          title: story.title ?? "Untitled",
          url: story.url ?? `https://news.ycombinator.com/item?id=${story.id}`,
          summary: story.text?.replace(/<[^>]+>/g, " ").slice(0, 240),
          author: story.by,
          score: story.score ?? 0,
          comments: story.descendants ?? 0,
          rank: index + 1,
          publishedAt: story.time ? new Date(story.time * 1000).toISOString() : undefined,
          raw: story
        })),
      5 * 60 * 1000
    );
  }
}

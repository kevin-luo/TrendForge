import { XMLParser } from "fast-xml-parser";
import { createId, type FetchOptions, type SearchOptions, type SourceConnector, type TrendItem } from "@trendforge/core";
import { fetchText } from "./http.js";
import { connectorCache } from "./cache.js";

type RssItem = Record<string, unknown>;

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "#text" in value) return String((value as Record<string, unknown>)["#text"]);
  return undefined;
}

export class RssConnector implements SourceConnector {
  id = "rss" as const;
  name = "RSS";
  description = "Fetch one or more RSS feeds and normalize entries into trend items.";
  requiresAuth = false;

  async isEnabled(): Promise<boolean> {
    return true;
  }

  async fetchTrending(options: FetchOptions): Promise<TrendItem[]> {
    const urls = options.rssUrls?.filter(Boolean) ?? [];
    if (urls.length === 0) {
      return [
        {
          id: createId("rss"),
          source: this.id,
          title: "RSS 数据源尚未配置",
          summary: "在设置页添加 RSS 源后可以拉取内容。当前提供本地占位条目用于验证视频链路。",
          rank: 1,
          raw: { fallback: true }
        }
      ];
    }

    const limit = Math.min(options.limit ?? 20, 50);
    const cacheKey = `rss:${urls.join("|")}:${limit}:${options.query ?? ""}`;
    const cached = connectorCache.get<TrendItem[]>(cacheKey);
    if (cached) return cached;

    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
    const entries: TrendItem[] = [];
    for (const url of urls) {
      const xml = await fetchText(url, { label: `RSS ${url}`, timeoutMs: options.timeoutMs });
      const parsed = parser.parse(xml) as Record<string, unknown>;
      const channel = (parsed.rss as Record<string, unknown> | undefined)?.channel as Record<string, unknown> | undefined;
      const atomFeed = parsed.feed as Record<string, unknown> | undefined;
      const items = toArray((channel?.item ?? atomFeed?.entry) as RssItem | RssItem[] | undefined);
      for (const item of items) {
        const title = textValue(item.title) ?? "Untitled RSS Item";
        const linkValue = item.link;
        const link =
          typeof linkValue === "string"
            ? linkValue
            : Array.isArray(linkValue)
              ? textValue(linkValue[0])
              : linkValue && typeof linkValue === "object" && "href" in linkValue
                ? String((linkValue as Record<string, unknown>).href)
                : undefined;
        const content = textValue(item.description) ?? textValue(item.summary) ?? textValue(item.content);
        entries.push({
          id: createId("rss"),
          source: this.id,
          title,
          url: link,
          summary: content?.replace(/<[^>]+>/g, " ").slice(0, 240),
          content: content?.replace(/<[^>]+>/g, " "),
          author: textValue(item.author),
          publishedAt: textValue(item.pubDate) ?? textValue(item.updated),
          rank: entries.length + 1,
          raw: item
        });
      }
    }
    const query = options.query?.toLowerCase();
    const filtered = query ? entries.filter((item) => `${item.title} ${item.summary ?? ""}`.toLowerCase().includes(query)) : entries;
    return connectorCache.set(cacheKey, filtered.slice(0, limit), 5 * 60 * 1000);
  }

  async search(query: string, options: SearchOptions): Promise<TrendItem[]> {
    return this.fetchTrending({ ...options, query });
  }
}

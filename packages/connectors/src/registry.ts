import type { AppSettingMap, SourceConnector, SourceType } from "@trendforge/core";
import { HackerNewsConnector } from "./hacker-news.js";
import { ManualConnector } from "./manual.js";
import { ProductHuntConnector } from "./product-hunt.js";
import { RedditConnector } from "./reddit.js";
import { RssConnector } from "./rss.js";
import { XTwitterConnector } from "./x-twitter.js";

export function createConnectors(settings: AppSettingMap = process.env): SourceConnector[] {
  return [
    new ManualConnector(),
    new HackerNewsConnector(),
    new RssConnector(),
    new ProductHuntConnector(settings.PRODUCT_HUNT_TOKEN),
    new RedditConnector(settings.REDDIT_CLIENT_ID, settings.REDDIT_CLIENT_SECRET, settings.REDDIT_USER_AGENT),
    new XTwitterConnector(settings.X_BEARER_TOKEN)
  ];
}

export function getConnector(id: SourceType, settings: AppSettingMap = process.env): SourceConnector {
  const connector = createConnectors(settings).find((item) => item.id === id);
  if (connector) return connector;
  return new ManualConnector();
}

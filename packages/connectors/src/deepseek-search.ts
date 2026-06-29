import { createId, type FetchOptions, type SearchOptions, type SourceConnector, type TrendItem } from "@trendforge/core";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export class DeepSeekSearchConnector implements SourceConnector {
  id = "manual" as const;
  name = "DeepSeek \u8054\u7F51\u641C\u7D22";
  description = "DeepSeek web search connector for product discovery.";
  requiresAuth = true;

  constructor(private readonly apiKey: string, private readonly baseUrl?: string) {}

  async isEnabled(): Promise<boolean> { return Boolean(this.apiKey); }

  async fetchTrending(options: FetchOptions): Promise<TrendItem[]> {
    return this.fetch(options.query ?? "", options);
  }

  async search(query: string, options: SearchOptions): Promise<TrendItem[]> {
    return this.fetch(query, options);
  }

  private async fetch(query: string, _options?: Record<string, unknown>): Promise<TrendItem[]> {
    const { searchProducts } = await import("@trendforge/llm");
    const items = await searchProducts(query, this.apiKey, this.baseUrl);
    
    // Download product images to local storage
    const imageDir = path.resolve(process.cwd(), "storage", "cache", "product-images");
    await mkdir(imageDir, { recursive: true });

    for (const item of items) {
      const imageUrl = (item.raw as any)?.imageUrl as string | undefined;
      if (!imageUrl) continue;
      try {
        const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        const ext = imageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] ?? "png";
        const fname = `${item.id}.${ext}`;
        await writeFile(path.join(imageDir, fname), buf);
        (item.raw as any).localImagePath = path.join(imageDir, fname);
      } catch {
        // image download failed, skip
      }
    }
    return items;
  }
}

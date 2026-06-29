import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TrendItem } from "@trendforge/core";

export type ProductAsset = {
  rank: number;
  slug: string;
  dir: string;
  logoPath?: string;
  thumbnailPath?: string;
  websiteDesktopPath?: string;
  websiteMobilePath?: string;
  phPagePath?: string;
  metadataPath: string;
  success: boolean;
  errors: string[];
};

export type ProductAssetCollectorOptions = {
  projectDir: string;
  timeoutMs?: number;
  log?: (message: string, context?: Record<string, unknown>) => Promise<void> | void;
};

const fallbackPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64"
);

export class ProductAssetCollector {
  constructor(private readonly options: ProductAssetCollectorOptions) {}

  async collect(items: TrendItem[]): Promise<ProductAsset[]> {
    const assets: ProductAsset[] = [];
    for (const [index, item] of items.entries()) {
      assets.push(await this.collectOne(item, item.rank ?? index + 1));
    }
    return assets;
  }

  private async collectOne(item: TrendItem, rank: number): Promise<ProductAsset> {
    const slug = slugify(item.title);
    const dir = path.join(this.options.projectDir, "assets", "products", `${String(rank).padStart(2, "0")}_${slug}`);
    await mkdir(dir, { recursive: true });
    const errors: string[] = [];
    const asset: ProductAsset = {
      rank,
      slug,
      dir,
      metadataPath: path.join(dir, "metadata.json"),
      success: false,
      errors
    };

    await this.options.log?.("采集产品素材", { rank, title: item.title, url: item.url });

    const thumbnailPath = path.join(dir, "ph-thumbnail.png");
    if (item.thumbnail) {
      const downloaded = await downloadFile(item.thumbnail, thumbnailPath, this.options.timeoutMs ?? 12000).catch((error: unknown) => {
        errors.push(`Product Hunt thumbnail 下载失败：${errorMessage(error)}`);
        return false;
      });
      if (downloaded) asset.thumbnailPath = thumbnailPath;
    }

    if (item.url) {
      const screenshot = await tryPlaywrightScreenshots(item.url, dir, this.options.timeoutMs ?? 18000).catch((error: unknown) => {
        errors.push(`官网截图失败：${errorMessage(error)}`);
        return undefined;
      });
      asset.websiteDesktopPath = screenshot?.desktop;
      asset.websiteMobilePath = screenshot?.mobile;
    }

    const logoPath = path.join(dir, "logo.png");
    await writeFile(logoPath, fallbackPng);
    asset.logoPath = logoPath;

    if (!asset.thumbnailPath) {
      await writeFile(thumbnailPath, fallbackPng);
      asset.thumbnailPath = thumbnailPath;
    }

    asset.success = Boolean(asset.websiteDesktopPath || asset.websiteMobilePath || asset.thumbnailPath);
    await writeFile(
      asset.metadataPath,
      JSON.stringify(
        {
          rank,
          slug,
          title: item.title,
          website: item.url,
          thumbnail: item.thumbnail,
          logoPath: asset.logoPath,
          thumbnailPath: asset.thumbnailPath,
          websiteDesktopPath: asset.websiteDesktopPath,
          websiteMobilePath: asset.websiteMobilePath,
          success: asset.success,
          errors
        },
        null,
        2
      ),
      "utf8"
    );
    return asset;
  }
}

async function tryPlaywrightScreenshots(url: string, dir: string, timeoutMs: number): Promise<{ desktop?: string; mobile?: string } | undefined> {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;
  const mod = (await dynamicImport("playwright").catch(() => undefined)) as
    | { chromium?: { launch: (options: Record<string, unknown>) => Promise<unknown> } }
    | undefined;
  if (!mod?.chromium) return undefined;

  const browser = (await mod.chromium.launch({ headless: true })) as {
    newPage: (options: Record<string, unknown>) => Promise<{
      goto: (target: string, options: Record<string, unknown>) => Promise<unknown>;
      screenshot: (options: Record<string, unknown>) => Promise<unknown>;
      close: () => Promise<void>;
    }>;
    close: () => Promise<void>;
  };
  try {
    const desktop = path.join(dir, "website-desktop.png");
    const mobile = path.join(dir, "website-mobile.png");
    const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await desktopPage.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
    await desktopPage.screenshot({ path: desktop, fullPage: false });
    await desktopPage.close();

    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await mobilePage.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
    await mobilePage.screenshot({ path: mobile, fullPage: false });
    await mobilePage.close();
    return { desktop, mobile };
  } finally {
    await browser.close();
  }
}

async function downloadFile(url: string, outputPath: string, timeoutMs: number): Promise<boolean> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) return false;
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, buffer);
  return true;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "product";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

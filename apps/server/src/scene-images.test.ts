import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { StoryboardScene } from "@trendforge/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSceneFallbackSvg, downloadImageToFile, fetchSceneImages } from "./scene-images.js";

describe("scene images", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds an escaped fallback svg with portrait dimensions", () => {
    const svg = buildSceneFallbackSvg({
      topic: 'AI <Trend> & "Signals"',
      index: 0,
      title: 'Title <A> & "B"',
      body: "Body > details",
      keywords: ["One & Two", "Motion"],
      visualDirection: "scan & zoom"
    });

    expect(svg).toContain('width="1080"');
    expect(svg).toContain('height="1920"');
    expect(svg).toContain('viewBox="0 0 1080 1920"');
    expect(svg).toContain("Title &lt;A&gt; &amp; &quot;B&quot;");
    expect(svg).toContain("Body &gt; details");
    expect(svg).toContain("One &amp; Two");
    expect(svg).toContain("SCENE 01");
  });

  it("promotes asset hints to the scene image before any generator runs", async () => {
    const assetDir = await mkdtemp(path.join(tmpdir(), "trendforge-scene-"));
    const scenes: StoryboardScene[] = [
      {
        id: "scene_1",
        type: "item",
        duration: 3,
        title: "Hinted scene",
        screenText: "Use the hinted asset",
        narrationTextZh: "",
        narrationTextEn: "",
        subtitleZh: "",
        subtitleEn: "",
        visualDirection: "",
        assetHints: ["local-hint.png"]
      }
    ];
    const calls: string[] = [];

    const result = await fetchSceneImages(scenes, {
      projectId: "project_1",
      topic: "Trend topic",
      assetDir,
      searchImage: async () => {
        calls.push("search");
        return undefined;
      },
      generateImage: async () => {
        calls.push("generate");
        return undefined;
      }
    });

    expect(result[0]?.image).toBe("local-hint.png");
    expect(result[0]?.assetHints).toEqual(["local-hint.png"]);
    expect(calls).toEqual([]);
  });

  it("keeps an existing scene image intact", async () => {
    const assetDir = await mkdtemp(path.join(tmpdir(), "trendforge-scene-"));
    const scenes: StoryboardScene[] = [
      {
        id: "scene_1",
        type: "overview",
        duration: 3,
        title: "Existing image",
        screenText: "Existing image",
        narrationTextZh: "",
        narrationTextEn: "",
        subtitleZh: "",
        subtitleEn: "",
        visualDirection: "",
        image: "scene-image.png",
        assetHints: ["local-hint.png"]
      }
    ];
    const calls: string[] = [];

    const result = await fetchSceneImages(scenes, {
      projectId: "project_1",
      topic: "Trend topic",
      assetDir,
      searchImage: async () => {
        calls.push("search");
        return undefined;
      },
      generateImage: async () => {
        calls.push("generate");
        return undefined;
      }
    });

    expect(result[0]?.image).toBe("scene-image.png");
    expect(result[0]?.assetHints).toEqual(["local-hint.png"]);
    expect(calls).toEqual([]);
  });

  it("writes a DeepSeek search image into both image and asset hints", async () => {
    const assetDir = await mkdtemp(path.join(tmpdir(), "trendforge-scene-"));
    const scenes: StoryboardScene[] = [
      {
        id: "scene_1",
        type: "overview",
        duration: 3,
        title: "Search first",
        screenText: "Search first",
        narrationTextZh: "",
        narrationTextEn: "",
        subtitleZh: "",
        subtitleEn: "",
        visualDirection: ""
      }
    ];
    const calls: string[] = [];

    const result = await fetchSceneImages(scenes, {
      projectId: "project_1",
      topic: "Trend topic",
      assetDir,
      searchImage: async (_subject, outPath) => {
        calls.push("search");
        return outPath;
      },
      generateImage: async () => {
        calls.push("generate");
        return undefined;
      }
    });

    expect(calls).toEqual(["search"]);
    expect(result[0]?.assetHints?.[0]).toContain(".jpg");
    expect(result[0]?.image).toContain(".jpg");
  });

  it("writes a local svg fallback when external generation stays disabled", async () => {
    const assetDir = await mkdtemp(path.join(tmpdir(), "trendforge-scene-"));
    const scenes: StoryboardScene[] = [
      {
        id: "scene_1",
        type: "overview",
        duration: 3,
        title: "External success",
        screenText: "External success",
        narrationTextZh: "",
        narrationTextEn: "",
        subtitleZh: "",
        subtitleEn: "",
        visualDirection: ""
      },
      {
        id: "scene_2",
        type: "item",
        duration: 3,
        title: "Fallback scene",
        screenText: "Use the local card",
        narrationTextZh: "",
        narrationTextEn: "",
        subtitleZh: "",
        subtitleEn: "",
        visualDirection: "scan",
        keywords: ["K & L"]
      }
    ];
    const logs: Array<{ level: "info" | "warn"; message: string }> = [];

    const result = await fetchSceneImages(scenes, {
      projectId: "project_1",
      topic: "Trend topic",
      assetDir,
      log: (entry) => {
        logs.push({ level: entry.level, message: entry.message });
      }
    });

    expect(result.every((scene) => Boolean(scene.image))).toBe(true);
    expect(result[0]?.image).toContain(".svg");
    expect(result[1]?.image).toContain(".svg");

    const svg = await readFile(result[1]!.image!, "utf8");
    expect(svg).toContain("Fallback scene");
    expect(svg).toContain("K &amp; L");
    expect(logs.some((entry) => entry.level === "warn" && entry.message.includes("外部配图生成失败"))).toBe(true);
    expect(logs.some((entry) => entry.level === "info" && entry.message === "本地 SVG fallback 已生成")).toBe(true);
  });

  it("downloads an image url into a local file", async () => {
    const assetDir = await mkdtemp(path.join(tmpdir(), "trendforge-download-"));
    const outPath = path.join(assetDir, "image.jpg");
    const bytes = Buffer.from("fake-image-data-beyond-threshold".repeat(100));
    vi.stubGlobal("fetch", async () => new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg" } }));

    const written = await downloadImageToFile("https://example.com/image.jpg", outPath, 1000);
    const file = written ? await readFile(written) : Buffer.alloc(0);

    expect(written).toBe(outPath);
    expect(file.length).toBe(bytes.length);
  });
});

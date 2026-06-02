import { mkdtemp, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SilentTtsProvider } from "./silent.js";

describe("SilentTtsProvider", () => {
  it("creates local audio files", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "trendforge-tts-"));
    const result = await new SilentTtsProvider().synthesize({
      text: "测试配音生成。",
      voice: "silent",
      format: "wav",
      outputDir: dir
    });
    const file = await stat(result.audioPath);
    expect(file.size).toBeGreaterThan(44);
    expect(result.duration).toBeGreaterThan(0);
  });
});

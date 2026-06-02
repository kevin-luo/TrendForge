import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createId, estimateReadDuration, splitTextForVoice, type TtsInput, type TtsProvider, type TtsResult } from "@trendforge/core";
import { createSilentWav } from "./wav.js";

export class SilentTtsProvider implements TtsProvider {
  id = "silent";
  name = "Silent Local Audio";

  async isEnabled(): Promise<boolean> {
    return true;
  }

  async synthesize(input: TtsInput): Promise<TtsResult> {
    const outputDir = input.outputDir ?? process.cwd();
    await mkdir(outputDir, { recursive: true });
    const parts = splitTextForVoice(input.text, 160);
    let cursor = 0;
    const segments = [];
    for (let index = 0; index < parts.length; index += 1) {
      const text = parts[index] ?? "";
      const duration = estimateReadDuration(text, input.language);
      const audioPath = path.join(outputDir, `${input.filename ?? "voice"}_${String(index + 1).padStart(3, "0")}.wav`);
      await writeFile(audioPath, createSilentWav(duration));
      segments.push({
        id: createId("ttsseg"),
        text,
        audioPath,
        duration,
        start: cursor,
        end: cursor + duration
      });
      cursor += duration;
    }
    const totalPath = path.join(outputDir, `${input.filename ?? "voice"}.wav`);
    await writeFile(totalPath, createSilentWav(Math.max(cursor, 1)));
    return {
      audioPath: totalPath,
      duration: Math.max(cursor, 1),
      segments
    };
  }
}

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createId,
  estimateReadDuration,
  splitTextForVoice,
  TrendForgeError,
  type AppSettingMap,
  type TtsInput,
  type TtsProvider,
  type TtsResult
} from "@trendforge/core";
import { SilentTtsProvider } from "./silent.js";

type DoubaoResponse = {
  data?: string;
  audio?: string;
  duration?: number;
  code?: number;
  message?: string;
};

export class DoubaoTtsProvider implements TtsProvider {
  id = "doubao";
  name = "Volcengine Doubao TTS";

  constructor(private readonly settings: AppSettingMap = process.env) {}

  async isEnabled(): Promise<boolean> {
    return Boolean(
      this.settings.VOLCENGINE_APP_ID &&
        this.settings.VOLCENGINE_ACCESS_TOKEN &&
        this.settings.VOLCENGINE_CLUSTER &&
        this.settings.VOLCENGINE_TTS_ENDPOINT
    );
  }

  async synthesize(input: TtsInput): Promise<TtsResult> {
    if (!(await this.isEnabled())) return new SilentTtsProvider().synthesize(input);
    const outputDir = input.outputDir ?? process.cwd();
    await mkdir(outputDir, { recursive: true });
    const parts = splitTextForVoice(input.text, 180);
    let cursor = 0;
    const segments = [];

    for (let index = 0; index < parts.length; index += 1) {
      const text = parts[index] ?? "";
      const result = await this.synthesizePart(text, input);
      const extension = input.format === "mp3" ? "mp3" : "wav";
      const audioPath = path.join(outputDir, `${input.filename ?? "voice"}_${String(index + 1).padStart(3, "0")}.${extension}`);
      await writeFile(audioPath, Buffer.from(result.audioBase64, "base64"));
      const duration = result.duration || estimateReadDuration(text, input.language);
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

    return {
      audioPath: segments[0]?.audioPath ?? "",
      duration: Math.max(cursor, 1),
      segments
    };
  }

  private async synthesizePart(text: string, input: TtsInput): Promise<{ audioBase64: string; duration?: number }> {
    const endpoint = this.settings.VOLCENGINE_TTS_ENDPOINT;
    if (!endpoint) throw new TrendForgeError("TTS_CONFIG_MISSING", "豆包 TTS endpoint 缺失", undefined, 400);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.settings.VOLCENGINE_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        app: {
          appid: this.settings.VOLCENGINE_APP_ID,
          token: this.settings.VOLCENGINE_ACCESS_TOKEN,
          cluster: this.settings.VOLCENGINE_CLUSTER
        },
        user: { uid: "trendforge-local" },
        audio: {
          voice_type: input.voice || this.settings.VOLCENGINE_VOICE_TYPE,
          encoding: input.format,
          speed_ratio: input.speed ?? Number(this.settings.TTS_DEFAULT_SPEED ?? 1),
          volume_ratio: input.volume ?? Number(this.settings.TTS_DEFAULT_VOLUME ?? 1),
          pitch_ratio: input.pitch ?? Number(this.settings.TTS_DEFAULT_PITCH ?? 1)
        },
        request: {
          reqid: createId("doubao"),
          text,
          text_type: "plain",
          operation: "query"
        }
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new TrendForgeError("DOUBAO_TTS_ERROR", "豆包 TTS 请求失败", { status: response.status, body }, response.status);
    }
    const json = (await response.json()) as DoubaoResponse;
    const audioBase64 = json.data ?? json.audio;
    if (!audioBase64) throw new TrendForgeError("DOUBAO_TTS_EMPTY", json.message ?? "豆包 TTS 未返回音频", json, 502);
    return { audioBase64, duration: json.duration };
  }
}

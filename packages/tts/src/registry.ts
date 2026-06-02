import type { AppSettingMap, TtsProvider } from "@trendforge/core";
import { DoubaoTtsProvider } from "./doubao.js";
import { SilentTtsProvider } from "./silent.js";

export function createTtsProvider(settings: AppSettingMap = process.env): TtsProvider {
  return settings.VOLCENGINE_ACCESS_TOKEN ? new DoubaoTtsProvider(settings) : new SilentTtsProvider();
}

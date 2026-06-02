import type { AppSettingMap, ScriptProvider } from "@trendforge/core";
import { DeepSeekProvider } from "./deepseek.js";
import { MockScriptProvider } from "./mock.js";

export function createScriptProvider(settings: AppSettingMap = process.env): ScriptProvider {
  return settings.DEEPSEEK_API_KEY ? new DeepSeekProvider(settings) : new MockScriptProvider();
}

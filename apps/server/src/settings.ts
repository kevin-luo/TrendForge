import { maskSecret, nowIso, type AppSettingMap } from "@trendforge/core";
import { prisma } from "./prisma.js";

const publicSettingKeys = [
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_API_BASE",
  "DEEPSEEK_MODEL",
  "VOLCENGINE_APP_ID",
  "VOLCENGINE_ACCESS_TOKEN",
  "VOLCENGINE_CLUSTER",
  "VOLCENGINE_VOICE_TYPE",
  "VOLCENGINE_TTS_ENDPOINT",
  "TTS_DEFAULT_SPEED",
  "TTS_DEFAULT_VOLUME",
  "TTS_DEFAULT_PITCH",
  "PRODUCT_HUNT_TOKEN",
  "REDDIT_CLIENT_ID",
  "REDDIT_CLIENT_SECRET",
  "REDDIT_USER_AGENT",
  "X_API_KEY",
  "X_API_SECRET",
  "X_BEARER_TOKEN",
  "FFMPEG_PATH",
  "FFPROBE_PATH",
  "PROXY_URL"
] as const;

const publicSettingKeySet = new Set<string>(publicSettingKeys);

const defaultSettings: AppSettingMap = {
  DEEPSEEK_API_KEY: "",
  DEEPSEEK_API_BASE: "https://api.deepseek.com",
  DEEPSEEK_MODEL: "deepseek-chat",
  VOLCENGINE_APP_ID: "",
  VOLCENGINE_ACCESS_TOKEN: "",
  VOLCENGINE_CLUSTER: "",
  VOLCENGINE_VOICE_TYPE: "",
  VOLCENGINE_TTS_ENDPOINT: "",
  TTS_DEFAULT_SPEED: "1",
  TTS_DEFAULT_VOLUME: "1",
  TTS_DEFAULT_PITCH: "1",
  PRODUCT_HUNT_TOKEN: "",
  REDDIT_CLIENT_ID: "",
  REDDIT_CLIENT_SECRET: "",
  REDDIT_USER_AGENT: "TrendForge/0.1",
  X_API_KEY: "",
  X_API_SECRET: "",
  X_BEARER_TOKEN: "",
  FFMPEG_PATH: "ffmpeg",
  FFPROBE_PATH: "ffprobe",
  PROXY_URL: ""
};

export async function getSettings(): Promise<AppSettingMap> {
  const rows = await prisma.appSetting.findMany();
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value ?? undefined]));
  return { ...defaultSettings, ...process.env, ...stored };
}

export async function updateSettings(values: AppSettingMap): Promise<AppSettingMap> {
  for (const [key, value] of Object.entries(values)) {
    if (!publicSettingKeySet.has(key)) continue;
    await prisma.appSetting.upsert({
      where: { key },
      update: { value, updated_at: nowIso() },
      create: { key, value, updated_at: nowIso() }
    });
  }
  return getSettings();
}

export function publicSettings(settings: AppSettingMap): AppSettingMap {
  return Object.fromEntries(publicSettingKeys.map((key) => [key, isSecretKey(key) ? maskSecret(settings[key]) : settings[key]]));
}

function isSecretKey(key: string): boolean {
  return key.includes("KEY") || key.includes("TOKEN") || key.includes("SECRET");
}

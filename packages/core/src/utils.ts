import { randomUUID } from "node:crypto";
import type { Ratio } from "./types.js";

export class TrendForgeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly statusCode = 500
  ) {
    super(message);
  }
}

export function createId(prefix = "tf"): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function ratioToSize(ratio: Ratio): { width: number; height: number } {
  switch (ratio) {
    case "16:9":
      return { width: 1920, height: 1080 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "4:5":
      return { width: 1080, height: 1350 };
    case "16:10":
      return { width: 1920, height: 1200 };
    case "2.35:1":
      return { width: 1920, height: 817 };
    case "9:16":
    case "custom":
    default:
      return { width: 1080, height: 1920 };
  }
}

export function estimateReadDuration(text: string, language = "zh"): number {
  const clean = text.trim();
  if (clean.length === 0) return 1;
  const unitsPerSecond = language === "en" ? 2.6 : 4.2;
  return Math.max(2, Math.ceil(clean.length / unitsPerSecond));
}

export function maskSecret(value: string | undefined): string | undefined {
  if (!value) return value;
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export function redactSecrets<T>(input: T): T {
  const text = JSON.stringify(input, (_key, value) => {
    if (typeof value === "string") {
      return value.replace(/([A-Za-z0-9_\-]{8,})/g, (match) => {
        if (match.length < 16) return match;
        return `${match.slice(0, 4)}••••${match.slice(-4)}`;
      });
    }
    return value;
  });
  return JSON.parse(text) as T;
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timer = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new TrendForgeError("TIMEOUT", `${label} timed out`, { timeoutMs }, 408)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timer]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const withoutFence = trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start >= 0 && end > start) return withoutFence.slice(start, end + 1);
  return withoutFence;
}

export function splitTextForVoice(text: string, maxLength = 180): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[。！？!?；;.\n])/)
    .map((part) => part.trim())
    .filter(Boolean);
  const result: string[] = [];
  let current = "";
  for (const sentence of sentences.length ? sentences : [text]) {
    if ((current + sentence).length > maxLength && current) {
      result.push(current.trim());
      current = sentence;
    } else {
      current += current ? ` ${sentence}` : sentence;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

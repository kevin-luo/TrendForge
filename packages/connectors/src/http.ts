import { TrendForgeError, withTimeout } from "@trendforge/core";

export async function fetchJson<T>(
  url: string,
  options: RequestInit & { timeoutMs?: number; label?: string } = {}
): Promise<T> {
  const { timeoutMs = 12000, label = url, ...requestOptions } = options;
  const response = await withTimeout(fetch(url, requestOptions), timeoutMs, label);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new TrendForgeError("HTTP_ERROR", `${label} returned ${response.status}`, { url, body }, response.status);
  }
  return (await response.json()) as T;
}

export async function fetchText(
  url: string,
  options: RequestInit & { timeoutMs?: number; label?: string } = {}
): Promise<string> {
  const { timeoutMs = 12000, label = url, ...requestOptions } = options;
  const response = await withTimeout(fetch(url, requestOptions), timeoutMs, label);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new TrendForgeError("HTTP_ERROR", `${label} returned ${response.status}`, { url, body }, response.status);
  }
  return response.text();
}

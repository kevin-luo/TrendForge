import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RenderPayload } from "@trendforge/core";
import { renderNeoSignalHtml } from "@trendforge/templates";

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  console.error("Usage: pnpm --filter @trendforge/renderer render:html <render-data.json> <output.html>");
  process.exit(1);
}

const payload = JSON.parse(await readFile(path.resolve(input), "utf8")) as RenderPayload;
await writeFile(path.resolve(output), renderNeoSignalHtml(payload), "utf8");
console.log(`Rendered HTML: ${output}`);

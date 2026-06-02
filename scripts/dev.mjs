import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const pnpmExecPath = process.env.npm_execpath;
const apiHealthUrl = process.env.DEV_API_HEALTH_URL ?? "http://127.0.0.1:4790/api/health";
const startupTimeoutMs = Number(process.env.DEV_API_TIMEOUT_MS ?? 30000);
const children = new Set();
let stopping = false;

function start(name, args) {
  const command = pnpmExecPath ? process.execPath : process.platform === "win32" ? "cmd.exe" : "pnpm";
  const commandArgs = pnpmExecPath
    ? [pnpmExecPath, ...args]
    : process.platform === "win32"
      ? ["/d", "/s", "/c", ["pnpm", ...args].map(quoteCmdArg).join(" ")]
      : args;
  const child = spawn(command, commandArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });
  children.add(child);
  child.on("exit", (code) => {
    children.delete(child);
    if (!stopping && name === "server") {
      console.error(`[dev] server exited with code ${code ?? 0}`);
      stopAll(code ?? 1);
    }
  });
  return child;
}

function quoteCmdArg(value) {
  return /[\s"]/u.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

function stopAll(code = 0) {
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}

async function waitForApi() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < startupTimeoutMs) {
    if (await isApiReady()) return;
    await delay(500);
  }
  throw new Error(`[dev] API health check timed out: ${apiHealthUrl}`);
}

async function isApiReady() {
  try {
    const response = await fetch(apiHealthUrl);
    return response.ok;
  } catch {
    return false;
  }
}

process.once("SIGINT", () => stopAll(0));
process.once("SIGTERM", () => stopAll(0));

if (await isApiReady()) {
  console.log("[dev] API already ready on http://127.0.0.1:4790");
} else {
  console.log("[dev] starting server on http://127.0.0.1:4790");
  start("server", ["--filter", "@trendforge/server", "dev"]);
  await waitForApi();
}
console.log("[dev] API ready, starting web");
start("web", ["--filter", "@trendforge/web", "dev"]);

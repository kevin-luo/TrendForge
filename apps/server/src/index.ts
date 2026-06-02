import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { createConnectors, getConnector } from "@trendforge/connectors";
import {
  createId,
  nowIso,
  ratioToSize,
  TrendForgeError,
  type ExportSettings,
  type Ratio,
  type TrendItem,
  type SourceType,
  type SubtitleCue,
  type TtsResult,
  type VideoScript
} from "@trendforge/core";
import { FfmpegService } from "@trendforge/ffmpeg";
import { createScriptProvider } from "@trendforge/llm";
import { renderScenePosters } from "@trendforge/renderer/html-renderer";
import { exportAss, exportSrt, exportVtt, generateSubtitlesFromScenes } from "@trendforge/subtitles";
import { renderNeoSignalHtml } from "@trendforge/templates";
import { createTtsProvider } from "@trendforge/tts";
import { writeCoverSvg } from "./cover.js";
import { env } from "./env.js";
import { JobRunner } from "./jobs.js";
import { writeLog } from "./logging.js";
import { mapProject, mapScript, mapTrendItem } from "./mappers.js";
import { prisma } from "./prisma.js";
import { getSettings, publicSettings, updateSettings } from "./settings.js";
import { StorageService } from "./storage.js";

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });
const storage = new StorageService(env.storageDir);
const jobs = new JobRunner();

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof TrendForgeError) {
    reply.status(error.statusCode).send({ error: { code: error.code, message: error.message, details: error.details } });
    return;
  }
  reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : String(error) } });
});

await app.register(cors, { origin: true });
await app.register(multipart);
await storage.ensureRoot();

const webDist = path.resolve(process.cwd(), "../web/dist");
if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist, prefix: "/" });
}

app.get("/api/health", async () => ({ ok: true, time: nowIso() }));

app.get("/api/projects", async () => {
  const rows = await prisma.project.findMany({ orderBy: { updated_at: "desc" } });
  return rows.map(mapProject);
});

app.post("/api/projects", async (request) => {
  const body = request.body as Partial<{ title: string; type: string; language: string; ratio: Ratio; sourceType: SourceType }>;
  const project = await prisma.project.create({
    data: {
      id: createId("project"),
      title: body.title?.trim() || "未命名视频项目",
      type: body.type ?? "trend-video",
      status: "draft",
      source_type: body.sourceType,
      language: body.language ?? "zh",
      ratio: body.ratio ?? "9:16",
      template_id: "neo-signal",
      created_at: nowIso(),
      updated_at: nowIso()
    }
  });
  const mapped = mapProject(project);
  await storage.ensureProject(mapped);
  await writeLog({ projectId: project.id, level: "info", message: "项目创建" });
  return mapped;
});

app.get("/api/projects/:id", async (request) => {
  const { id } = request.params as { id: string };
  const project = await prisma.project.findUnique({
    where: { id },
    include: { trend_items: true, video_scripts: true, subtitles: true, assets: true, render_jobs: true }
  });
  if (!project) throw new TrendForgeError("PROJECT_NOT_FOUND", "项目不存在", { id }, 404);
  return {
    ...mapProject(project),
    trendItems: project.trend_items.map(mapTrendItem),
    script: project.video_scripts[0] ? mapScript(project.video_scripts[0]) : undefined,
    subtitles: project.subtitles,
    assets: project.assets,
    jobs: project.render_jobs
  };
});

app.patch("/api/projects/:id", async (request) => {
  const { id } = request.params as { id: string };
  const body = request.body as Partial<{ title: string; status: string; ratio: string; templateId: string; sourceType: string }>;
  const project = await prisma.project.update({
    where: { id },
    data: {
      title: body.title,
      status: body.status,
      ratio: body.ratio,
      template_id: body.templateId,
      source_type: body.sourceType,
      updated_at: nowIso()
    }
  });
  return mapProject(project);
});

app.delete("/api/projects/:id", async (request) => {
  const { id } = request.params as { id: string };
  await prisma.project.delete({ where: { id } });
  return { ok: true };
});

app.get("/api/sources", async () => {
  const settings = await getSettings();
  const connectors = createConnectors(settings);
  return Promise.all(
    connectors.map(async (connector) => ({
      id: connector.id,
      name: connector.name,
      description: connector.description,
      requiresAuth: connector.requiresAuth,
      enabled: await connector.isEnabled()
    }))
  );
});

app.post("/api/sources/fetch", async (request) => {
  const body = request.body as { projectId?: string; source: SourceType; options?: Record<string, unknown> };
  const settings = await getSettings();
  const connector = getConnector(body.source, settings);
  const items = await connector.fetchTrending({ ...(body.options ?? {}), source: body.source });
  if (body.projectId) {
    await prisma.trendItem.deleteMany({ where: { project_id: body.projectId } });
    for (const item of items) {
      await prisma.trendItem.create({
        data: {
          id: item.id,
          project_id: body.projectId,
          source: item.source,
          title: item.title,
          url: item.url,
          summary: item.summary,
          content: item.content,
          author: item.author,
          score: item.score ?? 0,
          comments: item.comments ?? 0,
          rank: item.rank ?? 0,
          thumbnail: item.thumbnail,
          raw_json: JSON.stringify(item.raw),
          created_at: nowIso()
        }
      });
    }
    await writeFile(storage.projectPath(body.projectId, "source", "items.json"), JSON.stringify(items, null, 2), "utf8");
  }
  return { items };
});

app.post("/api/sources/search", async (request) => {
  const body = request.body as { source: SourceType; query: string; options?: Record<string, unknown> };
  const connector = getConnector(body.source, await getSettings());
  const items = connector.search ? await connector.search(body.query, { ...(body.options ?? {}), query: body.query }) : await connector.fetchTrending({ ...(body.options ?? {}), query: body.query });
  return { items };
});

app.post("/api/projects/:id/script/generate", async (request) => {
  const { id } = request.params as { id: string };
  const body = request.body as Partial<{ language: "zh" | "en" | "bilingual"; scriptType: "trend-list" | "single-news" | "comparison" | "text-to-video" | "product-daily" }>;
  const job = await jobs.create(id, "generate_script", async (_jobId, update) => {
    await update(10, "读取热点条目");
    const items = (await prisma.trendItem.findMany({ where: { project_id: id }, orderBy: { rank: "asc" } })).map(mapTrendItem);
    await update(35, "生成脚本");
    const provider = createScriptProvider(await getSettings());
    await writeLog({ projectId: id, level: "info", message: `脚本引擎：${provider.name}` });
    await update(42, `生成脚本（${provider.name}）`);
    const script = await provider.generate({
      projectId: id,
      items,
      language: body.language ?? "zh",
      scriptType: body.scriptType ?? "trend-list"
    });
    const enrichedScript = enrichScriptWithItems(script, items);
    await update(75, "保存脚本");
    await saveScript(id, enrichedScript);
    await prisma.project.update({ where: { id }, data: { status: "scripting", updated_at: nowIso() } });
    await update(95, "脚本生成完成");
    return storage.projectPath(id, "script", "script.json");
  });
  return job;
});

app.patch("/api/projects/:id/script", async (request) => {
  const { id } = request.params as { id: string };
  const script = request.body as VideoScript;
  await saveScript(id, script);
  return script;
});

app.post("/api/projects/:id/script/regenerate-scene", async (request) => {
  const { id } = request.params as { id: string };
  const body = request.body as { sceneId: string; instruction?: string };
  const script = await latestScript(id);
  const scene = script.scenes.find((item) => item.id === body.sceneId);
  if (!scene) throw new TrendForgeError("SCENE_NOT_FOUND", "场景不存在", body, 404);
  const items = (await prisma.trendItem.findMany({ where: { project_id: id }, orderBy: { rank: "asc" } })).map(mapTrendItem);
  const provider = createScriptProvider(await getSettings());
  const next = await provider.regenerateScene({
    projectId: id,
    items,
    language: script.language,
    scriptType: "trend-list",
    scene,
    instruction: body.instruction
  });
  const enriched = enrichScriptWithItems({ ...script, scenes: [next] }, items).scenes[0] ?? next;
  const updated = { ...script, scenes: script.scenes.map((item) => (item.id === scene.id ? { ...enriched, id: scene.id } : item)) };
  await saveScript(id, updated);
  return enriched;
});

app.get("/api/tts/providers", async () => {
  const settings = await getSettings();
  return [
    { id: "doubao", name: "Volcengine Doubao TTS", enabled: Boolean(settings.VOLCENGINE_ACCESS_TOKEN) },
    { id: "silent", name: "Silent Local Audio", enabled: true }
  ];
});

app.post("/api/projects/:id/tts/generate", async (request) => {
  const { id } = request.params as { id: string };
  const body = request.body as Partial<{ voice: string; speed: number; volume: number; pitch: number; format: "mp3" | "wav" }>;
  const job = await jobs.create(id, "generate_tts", async (_jobId, update) => {
    await update(15, "读取脚本");
    const script = await latestScript(id);
    const provider = createTtsProvider(await getSettings());
    await update(42, "生成配音");
    const result = await provider.synthesize({
      text: script.voiceoverText,
      voice: body.voice ?? process.env.VOLCENGINE_VOICE_TYPE ?? "default",
      format: body.format ?? "wav",
      speed: body.speed,
      volume: body.volume,
      pitch: body.pitch,
      language: script.language,
      outputDir: storage.projectPath(id, "audio"),
      filename: "voice"
    });
    await writeFile(storage.projectPath(id, "audio", "tts-result.json"), JSON.stringify(result, null, 2), "utf8");
    await prisma.asset.create({
      data: {
        id: createId("asset"),
        project_id: id,
        type: "audio",
        path: result.audioPath,
        meta_json: JSON.stringify(result),
        created_at: nowIso()
      }
    });
    await prisma.project.update({ where: { id }, data: { status: "voicing", updated_at: nowIso() } });
    await update(95, "配音生成完成");
    return result.audioPath;
  });
  return job;
});

app.post("/api/projects/:id/tts/generate-scene", async (request) => {
  const { id } = request.params as { id: string };
  const body = request.body as { sceneId: string; voice?: string; format?: "mp3" | "wav" };
  const script = await latestScript(id);
  const scene = script.scenes.find((item) => item.id === body.sceneId);
  if (!scene) throw new TrendForgeError("SCENE_NOT_FOUND", "场景不存在", body, 404);
  const provider = createTtsProvider(await getSettings());
  const result = await provider.synthesize({
    text: scene.voiceText,
    voice: body.voice ?? "default",
    format: body.format ?? "wav",
    language: script.language,
    outputDir: storage.projectPath(id, "audio"),
    filename: `scene_${script.scenes.indexOf(scene) + 1}`
  });
  return result;
});

app.post("/api/projects/:id/tts/upload", async (request) => {
  const { id } = request.params as { id: string };
  const file = await request.file();
  if (!file) throw new TrendForgeError("UPLOAD_MISSING", "音频文件缺失", undefined, 400);
  const target = storage.projectPath(id, "audio", file.filename);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, await file.toBuffer());
  return { path: target };
});

app.get("/api/projects/:id/tts/audio", async (request, reply) => {
  const { id } = request.params as { id: string };
  const asset = await prisma.asset.findFirst({ where: { project_id: id, type: "audio" }, orderBy: { created_at: "desc" } });
  if (!asset) throw new TrendForgeError("AUDIO_NOT_FOUND", "配音文件不存在", { id }, 404);
  return reply.send(createReadStream(asset.path));
});

app.post("/api/projects/:id/subtitles/generate", async (request) => {
  const { id } = request.params as { id: string };
  const script = await latestScript(id);
  const ttsMeta = await readTtsResult(id);
  const cues = generateSubtitlesFromScenes(script.scenes, ttsMeta);
  await saveSubtitles(id, cues);
  await prisma.project.update({ where: { id }, data: { status: "subtitling", updated_at: nowIso() } });
  return { cues };
});

app.patch("/api/projects/:id/subtitles", async (request) => {
  const { id } = request.params as { id: string };
  const body = request.body as { cues: SubtitleCue[] };
  await saveSubtitles(id, body.cues);
  return { cues: body.cues };
});

app.get("/api/projects/:id/subtitles/export", async (request) => {
  const { id } = request.params as { id: string };
  const format = ((request.query as { format?: string }).format ?? "srt").toLowerCase();
  const row = await prisma.subtitle.findFirst({ where: { project_id: id, format }, orderBy: { updated_at: "desc" } });
  if (!row) throw new TrendForgeError("SUBTITLE_NOT_FOUND", "字幕文件不存在", { format }, 404);
  return { path: row.path };
});

app.post("/api/projects/:id/cover/generate", async (request) => {
  const { id } = request.params as { id: string };
  const project = await prisma.project.findUniqueOrThrow({ where: { id } });
  const script = await latestScript(id);
  const output = storage.projectPath(id, "cover", "cover.svg");
  await writeCoverSvg(output, script, project.ratio as Ratio);
  await prisma.project.update({ where: { id }, data: { cover_path: output, updated_at: nowIso() } });
  await prisma.asset.create({
    data: { id: createId("asset"), project_id: id, type: "cover", path: output, meta_json: JSON.stringify({ ratio: project.ratio }), created_at: nowIso() }
  });
  return { path: output };
});

app.patch("/api/projects/:id/cover", async (request) => {
  const { id } = request.params as { id: string };
  const body = request.body as { title?: string; subtitle?: string };
  const script = await latestScript(id);
  const updated = { ...script, title: body.title ?? script.title, subtitle: body.subtitle ?? script.subtitle };
  await saveScript(id, updated);
  return updated;
});

app.get("/api/projects/:id/cover/export", async (request) => {
  const { id } = request.params as { id: string };
  const project = await prisma.project.findUniqueOrThrow({ where: { id } });
  return { path: project.cover_path };
});

app.post("/api/projects/:id/render", async (request) => {
  const { id } = request.params as { id: string };
  const body = request.body as Partial<ExportSettings>;
  const job = await jobs.create(id, "render_video", async (_jobId, update) => {
    const renderStartedAt = Date.now();
    await update(5, "读取项目数据");
    const project = await prisma.project.findUniqueOrThrow({ where: { id } });
    await prisma.project.update({ where: { id }, data: { status: "rendering", final_video_path: null, updated_at: nowIso() } });
    const script = await latestScript(id);
    const ratio = body.ratio ?? (project.ratio as Ratio);
    const size = body.width && body.height ? { width: body.width, height: body.height } : ratioToSize(ratio);
    const tts = await readTtsResult(id);
    const cues = await latestCues(id);

    // Duration: TTS first, then sum of scene durations (default 6s/scene)
    const baseSceneDurations = script.scenes.map((scene) => scene.duration ?? 6);
    const sceneDuration = baseSceneDurations.reduce((sum, value) => sum + value, 0);
    const duration = Math.max(tts?.duration ?? 0, sceneDuration, 10);
    const sceneDurations = fitSceneDurations(baseSceneDurations, duration);

    const fps = body.fps ?? 30;
    const payload = {
      projectId: id,
      composition: "neo-signal",
      ratio,
      width: size.width,
      height: size.height,
      fps,
      duration,
      script,
      audio: tts ? { path: tts.audioPath, duration: tts.duration } : undefined,
      subtitles: cues,
      theme: {}
    };

    await update(12, "生成 HTML 模板");
    const htmlDir = storage.projectPath(id, "render");
    await mkdir(htmlDir, { recursive: true });
    const htmlPath = storage.projectPath(id, "render", "neo-signal.html");
    await writeFile(htmlPath, renderNeoSignalHtml(payload), "utf8");
    await writeFile(storage.projectPath(id, "render", "render-data.json"), JSON.stringify(payload, null, 2), "utf8");

    const exportsDir = storage.projectPath(id, "exports");
    await mkdir(exportsDir, { recursive: true });
    const ext = body.format === "webm" ? "webm" : "mp4";
    const ffmpeg = await createFfmpegServiceFromSettings();

    await update(20, "渲染场景画面");
    const posters = await renderScenePosters({
      html: htmlPath,
      width: size.width,
      height: size.height,
      outputDir: storage.projectPath(id, "render"),
      onProgress: async (written, total) => {
        await update(20 + Math.round((written / total) * 24), `渲染场景画面 ${written}/${total}`);
      }
    });

    await update(50, "合成动态视频");
    const rawVideo = storage.projectPath(id, "exports", `raw.${ext}`);
    await ffmpeg.sceneImagesToVideo(
      posters.scenes.map((poster, index) => ({ path: poster.path, duration: sceneDurations[index] ?? 6 })),
      size.width,
      size.height,
      fps,
      rawVideo,
      ext === "webm" ? "libvpx-vp9" : "libx264"
    );
    await update(76, `视频画面完成，用时 ${formatElapsed(Date.now() - renderStartedAt)}`);
    let finalPath = rawVideo;

    if (tts?.audioPath && existsSync(tts.audioPath)) {
      await update(82, "合成配音");
      const withAudio = storage.projectPath(id, "exports", `with_audio.${ext}`);
      await ffmpeg.mergeAudioForExport(finalPath, tts.audioPath, withAudio, ext);
      finalPath = withAudio;
    }

    const outputPath = storage.projectPath(id, "exports", `final.${ext}`);
    if (finalPath !== outputPath) {
      await ffmpeg.run(ffmpeg.ffmpegBin, ["-y", "-i", finalPath, "-c", "copy", outputPath]);
    }

    await prisma.project.update({ where: { id }, data: { status: "exported", final_video_path: outputPath, updated_at: nowIso() } });
    await update(96, `导出完成，用时 ${formatElapsed(Date.now() - renderStartedAt)}`);
    return outputPath;
  });
  return job;
});

app.get("/api/render-jobs/:id", async (request) => {
  const { id } = request.params as { id: string };
  const job = await prisma.renderJob.findUnique({ where: { id }, include: { logs: { orderBy: { created_at: "asc" } } } });
  if (!job) throw new TrendForgeError("JOB_NOT_FOUND", "任务不存在", { id }, 404);
  return job;
});

app.post("/api/render-jobs/:id/cancel", async (request) => {
  const { id } = request.params as { id: string };
  await jobs.cancel(id);
  return { ok: true };
});

app.post("/api/tools/video/import", async (request) => {
  const file = await request.file();
  if (!file) throw new TrendForgeError("UPLOAD_MISSING", "视频文件缺失", undefined, 400);
  const dir = path.join(env.storageDir, "imports");
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, file.filename);
  await writeFile(target, await file.toBuffer());
  return { path: target };
});

app.post("/api/tools/video/extract-audio", async (request) => {
  const body = request.body as { videoPath: string; outputPath?: string };
  const output = body.outputPath ?? `${body.videoPath}.audio.m4a`;
  return { path: await (await createFfmpegServiceFromSettings()).extractAudio(body.videoPath, output) };
});

app.post("/api/tools/video/merge-audio", async (request) => {
  const body = request.body as { videoPath: string; audioPath: string; outputPath: string };
  return { path: await (await createFfmpegServiceFromSettings()).mergeAudio(body.videoPath, body.audioPath, body.outputPath) };
});

app.post("/api/tools/video/burn-subtitles", async (request) => {
  const body = request.body as { videoPath: string; subtitlePath: string; outputPath: string };
  return { path: await (await createFfmpegServiceFromSettings()).burnSubtitles(body.videoPath, body.subtitlePath, body.outputPath) };
});

app.post("/api/tools/video/crop", async (request) => {
  const body = request.body as { videoPath: string; ratio: Ratio; outputPath: string };
  return { path: await (await createFfmpegServiceFromSettings()).cropToRatio(body.videoPath, body.ratio, body.outputPath) };
});

app.post("/api/tools/video/export", async (request) => {
  const body = request.body as { videoPath: string; width: number; height: number; outputPath: string };
  return { path: await (await createFfmpegServiceFromSettings()).resize(body.videoPath, body.width, body.height, body.outputPath) };
});

// ── 预览：直接返回已生成的 HTML 模板 ──────────────────────────────
app.get("/api/projects/:id/preview", async (request, reply) => {
  const { id } = request.params as { id: string };
  const htmlPath = storage.projectPath(id, "render", "neo-signal.html");
  if (!existsSync(htmlPath)) {
    // No render yet — serve a live preview from current script
    try {
      const project = await prisma.project.findUniqueOrThrow({ where: { id }, include: { video_scripts: true } });
      const scriptRow = project.video_scripts[0];
      if (!scriptRow) throw new TrendForgeError("SCRIPT_NOT_FOUND", "请先生成脚本", { id }, 404);
      const script = mapScript(scriptRow);
      const ratio = project.ratio as Ratio;
      const size = ratioToSize(ratio);
      const html = renderNeoSignalHtml({
        projectId: id,
        composition: "neo-signal",
        ratio,
        width: size.width,
        height: size.height,
        fps: 30,
        duration: script.scenes.reduce((s, sc) => s + (sc.duration ?? 6), 0),
        script,
        subtitles: [],
        theme: {}
      });
      reply.header("Content-Type", "text/html; charset=utf-8");
      return reply.send(html);
    } catch {
      throw new TrendForgeError("PREVIEW_NOT_READY", "请先生成脚本后再预览", { id }, 404);
    }
  }
  reply.header("Content-Type", "text/html; charset=utf-8");
  return reply.send(createReadStream(htmlPath));
});

app.post("/api/system/open-folder", async (request) => {
  const { path: folderPath } = request.body as { path: string };
  const { exec } = await import("node:child_process");
  const dir = existsSync(folderPath) ? folderPath : path.dirname(folderPath);
  exec(`explorer "${dir.replace(/\//g, "\\")}"`);
  return { ok: true };
});

app.get("/api/settings", async () => publicSettings(await getSettings()));
app.patch("/api/settings", async (request) => publicSettings(await updateSettings(request.body as Record<string, string>)));

app.get("/api/system/status", async () => {
  const settings = await getSettings();
  const ffmpeg = await (await createFfmpegServiceFromSettings()).check();
  const ffmpegReady = ffmpeg.ffmpeg && ffmpeg.ffprobe;
  return {
    sourceConnectors: { id: "source-connectors", label: "Source Connectors", status: "ready", message: "内置就绪" },
    aiModel: {
      id: "deepseek-script-engine",
      label: "DeepSeek Script Engine",
      status: settings.DEEPSEEK_API_KEY ? "ready" : "missing",
      message: settings.DEEPSEEK_API_KEY ? "在线" : "配置 Key"
    },
    voice: { id: "doubao-tts", label: "Volcengine Doubao TTS", status: "ready", message: "内置就绪" },
    subtitles: { id: "bilingual-subtitle-engine", label: "Bilingual Subtitle Engine", status: "ready", message: "内置就绪" },
    renderEngine: { id: "hyperframes-renderer", label: "HyperFrames HTML Video Renderer", status: "ready", message: "内置就绪" },
    ffmpegExport: { id: "ffmpeg-export", label: "FFmpeg Export", status: ffmpegReady ? "ready" : "missing", message: ffmpegReady ? "内置就绪" : "等待内置二进制" },
    storage: { id: "local-project-studio", label: "Local Project Studio", status: "ready", message: env.storageDir }
  };
});

app.get("/api/projects/:id/logs", async (request) => {
  const { id } = request.params as { id: string };
  return prisma.log.findMany({ where: { project_id: id }, orderBy: { created_at: "desc" }, take: 200 });
});

app.get("/api/logs", async () => prisma.log.findMany({ orderBy: { created_at: "desc" }, take: 200 }));

if (!existsSync(path.join(webDist, "index.html"))) {
  app.get("/*", async (_request, reply) =>
    reply.status(404).send({ error: { code: "WEB_DIST_MISSING", message: "前端开发服务运行在 http://127.0.0.1:4788" } })
  );
}

await app.listen({ host: "127.0.0.1", port: env.apiPort });

async function createFfmpegServiceFromSettings(): Promise<FfmpegService> {
  const settings = await getSettings();
  return new FfmpegService(normalizeToolPath(settings.FFMPEG_PATH, "ffmpeg"), normalizeToolPath(settings.FFPROBE_PATH, "ffprobe"));
}

function normalizeToolPath(value: string | undefined, fallback: string): string {
  const next = value?.trim();
  if (next && next !== fallback) return next;
  return discoverToolPath(fallback);
}

function discoverToolPath(command: string): string {
  const fileName = command.endsWith(".exe") ? command : `${command}.exe`;
  const repoRoot = path.resolve(process.cwd(), "../..");
  const candidates = [
    path.join(repoRoot, "tools", "ffmpeg", "bin", fileName),
    path.join(repoRoot, "storage", "tools", "ffmpeg", "bin", fileName),
    path.join("C:\\", "ffmpeg", "bin", fileName),
    path.join("C:\\", "ProgramData", "chocolatey", "bin", fileName),
    path.join(process.env.USERPROFILE ?? "", "scoop", "shims", fileName),
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Links", fileName)
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? command;
}

async function saveScript(projectId: string, script: VideoScript): Promise<void> {
  const existing = await prisma.videoScript.findFirst({ where: { project_id: projectId } });
  if (existing) {
    await prisma.videoScript.update({
      where: { id: existing.id },
      data: {
        title: script.title,
        script_json: JSON.stringify(script),
        voiceover_text: script.voiceoverText,
        updated_at: nowIso()
      }
    });
  } else {
    await prisma.videoScript.create({
      data: {
        id: createId("script"),
        project_id: projectId,
        title: script.title,
        script_json: JSON.stringify(script),
        voiceover_text: script.voiceoverText,
        created_at: nowIso(),
        updated_at: nowIso()
      }
    });
  }
  await writeFile(storage.projectPath(projectId, "script", "script.json"), JSON.stringify(script, null, 2), "utf8");
}

async function latestScript(projectId: string): Promise<VideoScript> {
  const row = await prisma.videoScript.findFirst({ where: { project_id: projectId }, orderBy: { updated_at: "desc" } });
  if (!row) throw new TrendForgeError("SCRIPT_NOT_FOUND", "脚本不存在，请先生成脚本", { projectId }, 404);
  return mapScript(row);
}

async function saveSubtitles(projectId: string, cues: SubtitleCue[]): Promise<void> {
  const dir = storage.projectPath(projectId, "subtitles");
  await mkdir(dir, { recursive: true });
  const files = {
    srt: path.join(dir, "subtitle.srt"),
    ass: path.join(dir, "subtitle.ass"),
    vtt: path.join(dir, "subtitle.vtt")
  };
  await Promise.all([
    writeFile(files.srt, exportSrt(cues), "utf8"),
    writeFile(files.ass, exportAss(cues), "utf8"),
    writeFile(files.vtt, exportVtt(cues), "utf8")
  ]);
  for (const [format, filePath] of Object.entries(files)) {
    const existing = await prisma.subtitle.findFirst({ where: { project_id: projectId, format } });
    const data = { path: filePath, cues_json: JSON.stringify(cues), updated_at: nowIso() };
    if (existing) await prisma.subtitle.update({ where: { id: existing.id }, data });
    else
      await prisma.subtitle.create({
        data: { id: createId("subtitle"), project_id: projectId, format, created_at: nowIso(), ...data }
      });
  }
}

async function latestCues(projectId: string): Promise<SubtitleCue[]> {
  const row = await prisma.subtitle.findFirst({ where: { project_id: projectId, format: "srt" }, orderBy: { updated_at: "desc" } });
  return row?.cues_json ? (JSON.parse(row.cues_json) as SubtitleCue[]) : [];
}

async function readTtsResult(projectId: string): Promise<TtsResult | undefined> {
  const file = storage.projectPath(projectId, "audio", "tts-result.json");
  if (!existsSync(file)) return undefined;
  return JSON.parse(await readFile(file, "utf8")) as TtsResult;
}

function enrichScriptWithItems(script: VideoScript, items: TrendItem[]): VideoScript {
  let cursor = 0;
  const scenes = script.scenes.map((scene) => {
    if (scene.type !== "item") return scene;
    const matched = matchTrendItem(scene.title, items) ?? items[cursor];
    if (!matched) return scene;
    cursor = Math.min(items.length, Math.max(cursor + 1, items.indexOf(matched) + 1));
    const sourceMetrics = [
      matched.rank ? `Product Hunt #${matched.rank}` : undefined,
      matched.score ? `${matched.score} upvotes` : undefined,
      matched.comments ? `${matched.comments} comments` : undefined
    ].filter((value): value is string => Boolean(value));
    const metadata = normalizeSceneMetadata(scene.metadata, matched, sourceMetrics);
    return {
      ...scene,
      title: scene.title || matched.title,
      screenText: enrichScreenText(scene.screenText, matched),
      visualHint: scene.visualHint ?? `${matched.title} 产品图文海报`,
      items: [matched],
      metadata
    };
  });
  return {
    ...script,
    scenes,
    voiceoverText: scenes.map((scene) => scene.voiceText).join("\n")
  };
}

function matchTrendItem(title: string, items: TrendItem[]): TrendItem | undefined {
  const normalizedTitle = normalizeText(title);
  return items.find((item) => {
    const normalizedItem = normalizeText(item.title);
    return normalizedTitle.includes(normalizedItem) || normalizedItem.includes(normalizedTitle);
  });
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function enrichScreenText(value: string, item: TrendItem): string {
  const parts = [value.trim(), item.summary?.trim(), item.content?.trim()].filter(Boolean);
  const unique = Array.from(new Set(parts));
  return unique.join(" ").slice(0, 180);
}

function normalizeSceneMetadata(
  metadata: Record<string, unknown> | undefined,
  item: TrendItem,
  sourceMetrics: string[]
): Record<string, unknown> {
  const next = metadata && typeof metadata === "object" ? { ...metadata } : {};
  next.layout = safeChoice(String(next.layout ?? ""), ["hero-image-left", "hero-image-right", "image-top", "split-brief", "metric-focus"], item.rank && item.rank % 2 === 0 ? "hero-image-left" : "hero-image-right");
  next.motion = safeChoice(String(next.motion ?? ""), ["push-in", "drift-left", "drift-right", "reveal-up", "scanline"], item.rank && item.rank % 2 === 0 ? "drift-left" : "push-in");
  next.highlights = readStringArray(next.highlights).length
    ? readStringArray(next.highlights).slice(0, 4)
    : [item.summary, item.content].filter(Boolean).join(" ").split(/[。；;.]/).map((text) => text.trim()).filter(Boolean).slice(0, 3);
  next.metrics = readStringArray(next.metrics).length ? readStringArray(next.metrics).slice(0, 3) : sourceMetrics;
  next.imageRole = next.imageRole ?? (item.thumbnail ? "product-image" : "brand-card");
  next.posterTone = next.posterTone ?? "科技产品日榜";
  return next;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function safeChoice(value: string, choices: string[], fallback: string): string {
  return choices.includes(value) ? value : fallback;
}

function fitSceneDurations(values: number[], totalDuration: number): number[] {
  if (!values.length) return [];
  const sum = values.reduce((total, value) => total + value, 0);
  if (sum <= 0) return values.map(() => totalDuration / values.length);
  const scale = totalDuration / sum;
  return values.map((value) => Math.max(1.5, value * scale));
}

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}分${String(rest).padStart(2, "0")}秒` : `${rest}秒`;
}

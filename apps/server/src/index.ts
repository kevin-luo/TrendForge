import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { createConnectors, getConnector } from "@trendforge/connectors";
import { ContentAnalyzer, CreatorStyleExtractor } from "@trendforge/content-matrix";
import {
  createId,
  nowIso,
  ratioToSize,
  TrendForgeError,
  type CreatorStyleAgent,
  type CreatorStyleSample,
  type ExportSettings,
  type Ratio,
  type Language,
  type MatrixContentType,
  type MatrixPlatform,
  type TrendItem,
  type SourceType,
  type StoryboardScene,
  type SubtitleCue,
  type TtsResult,
  type VideoScript,
  type VideoStoryboard
} from "@trendforge/core";
import { FfmpegService } from "@trendforge/ffmpeg";
import { createMotionDesignProvider, createScriptProvider, searchProducts } from "@trendforge/llm";
import type { AssetSlot, VisualSceneSpec } from "@trendforge/motion-core";
import { applyMotionDesignPlan, createLocalMotionDesignPlan, storyboardToVisualSpecs } from "@trendforge/motion-director";
import { makeFilmHtml } from "@trendforge/motion-render";
import { ProductAssetCollector, buildSubtitleTracks, createProductHuntStoryboard } from "@trendforge/product-video";
import { renderFrames } from "@trendforge/renderer/html-renderer";
import { motionEngineAdapters, motionPresetManifests, openDesignMotionSystems } from "@trendforge/motion-presets";
import { exportAss, exportSrt, exportVtt, generateSubtitlesFromScenes } from "@trendforge/subtitles";
import { createTtsProvider } from "@trendforge/tts";
import { writeCoverSvg } from "./cover.js";
import { env } from "./env.js";
import { JobRunner } from "./jobs.js";
import { writeLog } from "./logging.js";
import { mapProject, mapScript, mapTrendItem } from "./mappers.js";
import { downloadImageToFile, fetchSceneImages } from "./scene-images.js";
import { scriptToStoryboard } from "./motion-render.js";
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

app.get("/api/motion/templates", async () => ({
  engines: motionEngineAdapters,
  templates: motionPresetManifests,
  designSystems: openDesignMotionSystems
}));

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

app.get("/api/projects/:id/export/video", async (request, reply) => {
  const { id } = request.params as { id: string };
  const project = await prisma.project.findUnique({ where: { id }, select: { final_video_path: true } });
  if (!project?.final_video_path) throw new TrendForgeError("EXPORT_NOT_READY", "导出文件不存在", { id }, 404);
  if (!existsSync(project.final_video_path)) throw new TrendForgeError("EXPORT_NOT_READY", "导出文件不存在", { id, path: project.final_video_path }, 404);

  const ext = path.extname(project.final_video_path).toLowerCase();
  const contentType = ext === ".webm" ? "video/webm" : "video/mp4";
  const fileName = `final${ext === ".webm" ? ".webm" : ".mp4"}`;

  reply.header("Content-Type", contentType);
  reply.header("Content-Disposition", `attachment; filename="${fileName}"`);
  return reply.send(createReadStream(project.final_video_path));
});

app.get("/api/projects/:id/render/quality", async (request) => {
  const { id } = request.params as { id: string };
  return readRenderQualitySummary(id);
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

app.post("/api/projects/:id/product-hunt/generate", async (request) => {
  const { id } = request.params as { id: string };
  const body = request.body as Partial<{ date: string; topCount: number; language: "zh" | "en" | "bilingual"; ratio: Ratio; style: string; prompt: string }>;
  const job = await jobs.create(id, "product_hunt_video", async (_jobId, update) => {
    await update(5, "获取 Product Hunt 热榜");
    const settings = await getSettings();
    const connector = getConnector("product-hunt", settings);
    const topCount = Math.max(3, Math.min(body.topCount ?? 5, 10));
    const items = await connector.fetchTrending({ source: "product-hunt", limit: topCount, date: body.date });
    await prisma.trendItem.deleteMany({ where: { project_id: id } });
    for (const item of items) {
      await prisma.trendItem.create({
        data: {
          id: item.id,
          project_id: id,
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
    await writeFile(storage.projectPath(id, "source", "products.json"), JSON.stringify(items, null, 2), "utf8");

    await update(20, "采集产品素材");
    const collector = new ProductAssetCollector({
      projectDir: storage.projectDir(id),
      log: (message, context) => writeLog({ projectId: id, level: "info", message, context })
    });
    const assets = await collector.collect(items);

    await update(38, "生成分镜和字幕");
    const storyboard = createProductHuntStoryboard({
      items,
      assets,
      language: body.language ?? "bilingual",
      ratio: body.ratio ?? "9:16",
      date: body.date ?? nowIso().slice(0, 10),
      topCount,
      style: body.style ?? "快讯榜单"
    });
    await writeFile(storage.projectPath(id, "script", "storyboard.json"), JSON.stringify(storyboard, null, 2), "utf8");
    await writeFile(storage.projectPath(id, "script", "prompt.md"), body.prompt ?? "", "utf8");
    await saveScript(id, storyboardToVideoScript(storyboard));
    await saveSubtitles(id, storyboard.subtitleTracks.find((track) => track.language === "bilingual")?.cues ?? []);
    await writeStoryboardArtifacts(id, storyboard);

    await prisma.project.update({
      where: { id },
      data: {
        status: "scripting",
        ratio: body.ratio ?? "9:16",
        updated_at: nowIso()
      }
    });
    await update(96, "分镜与字幕已生成，可进入设计/预览/导出");
    return storage.projectPath(id, "script", "storyboard.json");
  });
  return job;
});

app.post("/api/projects/:id/creator-style/extract", async (request) => {
  const { id } = request.params as { id: string };
  const body = request.body as Partial<{ name: string; niche: string; language: Language; samples: CreatorStyleSample[]; sampleText: string }>;
  const samples = normalizeStyleSamples(body.samples, body.sampleText);
  const agent = new CreatorStyleExtractor().extract({
    name: body.name,
    niche: body.niche,
    language: body.language ?? "zh",
    samples
  });
  await writeProjectJson(id, "style", "creator-style-agent.json", agent);
  await writeProjectText(id, "style", "creator-style-agent.md", agent.skillMarkdown);
  await writeLog({ projectId: id, level: "info", message: "创作者风格 agent 已提取", context: { name: agent.name, niche: agent.niche } });
  return { agent };
});

app.post("/api/projects/:id/promo/generate", async (request) => {
  const { id } = request.params as { id: string };
  const body = request.body as PromoGenerateRequest;
  return createPromoGenerateJob(id, body);
});

app.post("/api/projects/:id/matrix/generate", async (request) => {
  const { id } = request.params as { id: string };
  const body = request.body as PromoGenerateRequest;
  return createPromoGenerateJob(id, body);
});

async function createPromoGenerateJob(projectId: string, body: PromoGenerateRequest) {
  const job = await jobs.create(projectId, "promo_video", async (_jobId, update) => {
    const startedAt = Date.now();
    const source = body.source ?? "manual";
    const language = body.language ?? "bilingual";
    const ratio = body.ratio ?? "9:16";
    const prompt = body.prompt?.trim() || "整理今天值得关注的 AI 热点，生成适合短视频发布的宣传方案。";
    await prisma.project.update({ where: { id: projectId }, data: { status: "collecting", source_type: source, ratio, updated_at: nowIso() } });
    await writeProjectText(projectId, "source", "input.md", prompt);

    await update(8, "读取输入与数据源");
    const settings = await getSettings();
    let items = await fetchMatrixItems(source, settings, body, prompt, projectId);

    if (source === "product-hunt") {
      await update(18, "生成产品视觉分镜");
      items = await attachProductAssets(projectId, items);
    }

    await saveTrendItems(projectId, items);
    await writeProjectJson(projectId, "source", "items.json", items);

    await update(28, "提取创作者风格");
    const styleAgent = body.styleAgent ?? (hasStyleSamples(body) ? new CreatorStyleExtractor().extract({
      name: body.styleName,
      niche: body.styleNiche,
      language,
      samples: normalizeStyleSamples(body.styleSamples, body.styleSampleText)
    }) : undefined);
    if (styleAgent) {
      await writeProjectJson(projectId, "style", "creator-style-agent.json", styleAgent);
      await writeProjectText(projectId, "style", "creator-style-agent.md", styleAgent.skillMarkdown);
    }

    await update(38, "分析内容与爆点角度");
    const analysis = new ContentAnalyzer().analyze({
      text: prompt,
      items,
      preferredContentType: body.contentType ?? "auto",
      styleAgent
    });
    await writeProjectJson(projectId, "analysis", "content-analysis.json", analysis);

    await update(48, "DeepSeek 生成脚本内容");
    const scriptProvider = createScriptProvider(settings);
    await writeLog({ projectId, level: "info", message: `内容引擎：${scriptProvider.name}` });
    const rawScript = await scriptProvider.generate({
      projectId,
      items,
      language,
      scriptType: matrixScriptType(body.contentType)
    });
    const script = enrichScriptWithItems(rawScript, items);
    await saveScript(projectId, script);

    await update(60, "生成分镜");
    const built = scriptToStoryboard(script, { ratio, candidate: "a", source: storyboardSourceFor(source) });
    await update(68, "生成配图");
    const imageProvider = createSceneImageProvider(source, settings, projectId);
    const scenesWithArt = await fetchSceneImages(built.scenes, {
      projectId,
      topic: prompt,
      assetDir: storage.projectPath(projectId, "assets", "web"),
      searchImage: imageProvider.searchImage,
      generateImage: imageProvider.generateImage,
      log: (entry) => writeLog({ projectId, level: entry.level, message: entry.message, context: entry.context })
    });
    const storyboard: VideoStoryboard = { ...built, scenes: scenesWithArt, subtitleTracks: buildSubtitleTracks(scenesWithArt) };
    await writeStoryboardArtifacts(projectId, storyboard);
    await saveSubtitles(projectId, storyboard.subtitleTracks.find((track) => track.language === "bilingual")?.cues ?? storyboard.subtitleTracks[0]?.cues ?? []);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        title: storyboard.title ?? prompt.slice(0, 28),
        status: "scripting",
        source_type: source,
        ratio,
        updated_at: nowIso()
      }
    });
    await update(96, `宣传分镜与字幕已生成，可进入设计、预览和导出，用时 ${formatElapsed(Date.now() - startedAt)}`);
    return storage.projectPath(projectId, "script", "storyboard.json");
  });
  return job;
}

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
    const ratio = body.ratio ?? (project.ratio as Ratio);
    const size = body.width && body.height ? { width: body.width, height: body.height } : ratioToSize(ratio);
    const tts = await readTtsResult(id);
    const fps = body.fps ?? 30;
    const deviceScaleFactor = normalizeDeviceScaleFactor(body.deviceScaleFactor);
    const renderProfile = resolveRenderProfile(body.renderProfile, body.qualityProfile, size.width, size.height, deviceScaleFactor);
    const encodeProfile = renderProfile;

    // Render via the DeepSeek-designed HTML film template (makeFilmHtml) on a
    // seek-driven virtual clock: makeFilmHtml exposes window.seek(frame) and all
    // animation is a pure function of the integer frame, so we screenshot every
    // frame in Chrome and assemble them with ffmpeg. This replaces the old
    // static-poster + zoompan Ken Burns path, which shook because zoompan rounds
    // its pan/zoom to integer pixels each frame. Subtitles are not yet burned in;
    // audio is still muxed below.
    await update(12, "生成 HTML 模板");
    const storyboard = await loadOrBuildStoryboard(id, "a", ratio);

    // P0: reconnect the DeepSeek design plan to the export path. Previously the
    // export ignored it (raw specs → makeFilmHtml), so every scene looked the
    // same. Now we generate the plan and apply its design system (token palette/
    // typography) + per-scene tokens (accentIndex/typographyScale). DeepSeek is
    // the authoritative look — on failure we let the error surface (it is logged
    // via the job) instead of silently reverting to the plain template.
    await update(16, "生成动态设计方案");
    const baseSpecs = storyboardToVisualSpecs(storyboard, { fps, candidate: "a" });
    const designProvider = createMotionDesignProvider(await getSettings());
    await writeLog({ projectId: id, level: "info", message: `动态设计引擎：${designProvider.name}` });
    const designPlan = await designProvider.generate({ storyboard, specs: baseSpecs, candidate: "a", templates: motionPresetManifests });
    // Route ①: honor DeepSeek's per-scene visualType — it directly drives the
    // on-screen layout. makeFilmHtml renders every visualType richly, so no need
    // to preserve the rule-chosen base type anymore.
    const specs = applyMotionDesignPlan(baseSpecs, designPlan);

    const baseSpecDurations = specs.map((spec) => spec.duration);
    const filmDuration = Math.max(tts?.duration ?? 0, baseSpecDurations.reduce((sum, value) => sum + value, 0), 10);
    // Fit per-scene durations to the film length, then write them back onto the
    // specs so the HTML timeline (scene frame windows) and the rendered frame
    // count stay byte-for-byte aligned.
    const specDurations = fitSceneDurations(baseSpecDurations, filmDuration);
    specs.forEach((spec, index) => { spec.duration = specDurations[index] ?? spec.duration; });
    const totalFrames = specs.reduce((sum, spec) => sum + Math.max(1, Math.round(spec.duration * fps)), 0);
    const frameDuration = totalFrames / fps;

    const htmlDir = storage.projectPath(id, "render");
    await mkdir(htmlDir, { recursive: true });
    const htmlPath = storage.projectPath(id, "render", "film.html");
    await writeFile(htmlPath, makeFilmHtml(inlineSceneImages(specs), { fps, designSystem: designPlan.designSystem, width: size.width, height: size.height }), "utf8");
    const renderBase = {
      ratio,
      width: size.width,
      height: size.height,
      fps,
      deviceScaleFactor,
      renderProfile,
      encodeProfile,
      duration: frameDuration,
      totalFrames,
      designPlanId: designPlan.id,
      themeId: designPlan.designSystem.themeId,
      qualitySummary: summarizeRenderSpecs(specs),
      sceneSpecs: specs.map((spec) => ({
        id: spec.id,
        sceneId: spec.sceneId,
        shotId: spec.shotId,
        templateId: spec.templateId ?? spec.design?.templateId,
        visualType: spec.visualType,
        hasImage: hasRenderableImage(spec),
        assetRoles: sceneAssetRoles(spec),
        assetSources: sceneAssetSources(spec),
        designPlanId: spec.designPlanId,
        themeId: spec.style.themeId,
        duration: spec.duration
      })),
      specs
    };

    const exportsDir = storage.projectPath(id, "exports");
    await mkdir(exportsDir, { recursive: true });
    const ext = body.format === "webm" ? "webm" : "mp4";
    const ffmpeg = await createFfmpegServiceFromSettings();

    await update(20, "逐帧渲染画面");
    const frames = await renderFrames({
      html: htmlPath,
      width: size.width,
      height: size.height,
      deviceScaleFactor,
      fps,
      duration: frameDuration,
      outputDir: storage.projectPath(id, "render"),
      collectQuality: true,
      onProgress: async (written, total) => {
        await update(20 + Math.round((written / total) * 40), `逐帧渲染画面 ${written}/${total}`);
      }
    });
    const renderData = {
      ...renderBase,
      renderProfile,
      encodeProfile,
      textFitSummary: frames.quality?.textFitSummary
    };
    await writeFile(storage.projectPath(id, "render", "render-data.json"), JSON.stringify(renderData, null, 2), "utf8");
    await writeFile(
      storage.projectPath(id, "render", "quality-report.json"),
      JSON.stringify(
        {
          generatedAt: nowIso(),
          render: {
            ratio,
            width: size.width,
            height: size.height,
            fps,
          deviceScaleFactor,
          renderProfile,
          encodeProfile,
          duration: frameDuration,
          totalFrames,
          designPlanId: designPlan.id,
          themeId: designPlan.designSystem.themeId
          },
          qualitySummary: renderBase.qualitySummary,
          textFitSummary: frames.quality?.textFitSummary
        },
        null,
        2
      ),
      "utf8"
    );

    await update(62, "合成动态视频");
    const rawVideo = storage.projectPath(id, "exports", `raw.${ext}`);
    await ffmpeg.framesToVideo(
      frames.frameGlob,
      fps,
      frameDuration,
      rawVideo,
      ext === "webm" ? "libvpx-vp9" : "libx264",
      encodeProfile
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

// ── 预览：返回与渲染同一套 html-film 模板（统一技术方案）────────────
// 渲染和预览都走 makeFilmHtml：浏览器打开时模板内的 RAF 自动播放，所见即所得。
// 若已渲染过则直接复用 film.html，否则按当前分镜实时构建。
app.get("/api/projects/:id/preview", async (request, reply) => {
  const { id } = request.params as { id: string };
  const renderedPath = storage.projectPath(id, "render", "film.html");
  if (existsSync(renderedPath)) {
    reply.header("Content-Type", "text/html; charset=utf-8");
    return reply.send(createReadStream(renderedPath));
  }
  try {
    const project = await prisma.project.findUniqueOrThrow({ where: { id } });
    const ratio = project.ratio as Ratio;
    const fps = 30;
    const storyboard = await loadOrBuildStoryboard(id, "a", ratio);
    // Live preview uses the LOCAL design plan (instant, no DeepSeek API call) so it
    // is a fast token-driven approximation of the export; the authoritative export
    // (/render) regenerates with DeepSeek. Same makeFilmHtml + design pipeline, so
    // preview and export stay visually consistent. Keep the original visualType.
    const baseSpecs = storyboardToVisualSpecs(storyboard, { fps, candidate: "a" });
    const designPlan = createLocalMotionDesignPlan({ storyboard, specs: baseSpecs, candidate: "a" });
    const specs = applyMotionDesignPlan(baseSpecs, designPlan);
    const html = makeFilmHtml(inlineSceneImages(specs), { fps, designSystem: designPlan.designSystem });
    reply.header("Content-Type", "text/html; charset=utf-8");
    return reply.send(html);
  } catch {
    throw new TrendForgeError("PREVIEW_NOT_READY", "请先生成脚本后再预览", { id }, 404);
  }
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
    voice: { id: "tts-future-slot", label: "TTS Future Slot", status: "ready", message: "后续可选" },
    visualAssets: {
      id: "programmatic-video-engine",
      label: "Programmatic Video Engine",
      status: "ready",
      message: "本地生成就绪"
    },
    subtitles: { id: "bilingual-subtitle-engine", label: "Bilingual Subtitle Engine", status: "ready", message: "内置就绪" },
    renderEngine: { id: "html-film-renderer", label: "HTML-Film Renderer", status: "ready", message: "逐帧就绪" },
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

async function fetchMatrixItems(
  source: SourceType,
  settings: Awaited<ReturnType<typeof getSettings>>,
  body: Partial<{ date: string; topCount: number; rssUrl: string; rssUrls: string[]; mode: string }>,
  prompt: string,
  projectId: string
): Promise<TrendItem[]> {
  const limit = Math.max(1, Math.min(body.topCount ?? 5, 12));
  const options = {
    source,
    limit,
    date: body.date,
    mode: body.mode,
    query: prompt,
    manualText: prompt,
    rssUrls: normalizeRssUrls(body.rssUrls, body.rssUrl),
    timeoutMs: 12000
  };
  try {
    const connector = getConnector(source, settings);
    const enabled = await connector.isEnabled();
    if (!enabled) {
      await writeLog({ projectId, level: "warn", message: `${sourceLabelForLog(source)} 未配置，使用手动输入回退` });
      return getConnector("manual", settings).fetchTrending({ source: "manual", manualText: prompt, limit });
    }
    const items = await connector.fetchTrending(options);
    return items.length ? items.slice(0, limit) : getConnector("manual", settings).fetchTrending({ source: "manual", manualText: prompt, limit });
  } catch (error) {
    await writeLog({ projectId, level: "warn", message: `${sourceLabelForLog(source)} 获取失败，使用手动输入回退`, context: { error: errorMessage(error) } });
    return getConnector("manual", settings).fetchTrending({ source: "manual", manualText: prompt, limit });
  }
}

async function attachProductAssets(projectId: string, items: TrendItem[]): Promise<TrendItem[]> {
  const collector = new ProductAssetCollector({
    projectDir: storage.projectDir(projectId),
    log: (message, context) => writeLog({ projectId, level: "info", message, context })
  });
  const assets = await collector.collect(items);
  return items.map((item, index) => {
    const rank = item.rank ?? index + 1;
    const asset = assets.find((entry) => entry.rank === rank);
    return {
      ...item,
      rank,
      thumbnail: asset?.websiteDesktopPath ?? asset?.websiteMobilePath ?? asset?.thumbnailPath ?? item.thumbnail,
      raw: { item: item.raw, asset }
    };
  });
}

async function saveTrendItems(projectId: string, items: TrendItem[]): Promise<void> {
  await prisma.trendItem.deleteMany({ where: { project_id: projectId } });
  for (const item of items) {
    await prisma.trendItem.create({
      data: {
        id: item.id,
        project_id: projectId,
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
}

async function writeProjectJson(projectId: string, folder: string, filename: string, value: unknown): Promise<void> {
  await writeProjectText(projectId, folder, filename, JSON.stringify(value, null, 2));
}

async function writeProjectText(projectId: string, folder: string, filename: string, value: string): Promise<void> {
  const filePath = storage.projectPath(projectId, folder, filename);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value, "utf8");
}

/**
 * Resolve a storyboard for rendering, in priority order:
 * 1. storyboard.json (current promo / product-hunt flow)
 * 2. candidate-<c>.json / storyboards.json (legacy flow)
 * 3. built from the latest VideoScript (manual script flow)
 * This lets the repointed render button work for every project type.
 */
async function loadOrBuildStoryboard(projectId: string, candidate: "a" | "b" | "c", ratio: Ratio): Promise<VideoStoryboard> {
  try {
    return await readCandidateStoryboard(projectId, candidate);
  } catch {
    const script = await latestScript(projectId);
    return scriptToStoryboard(script, { ratio, candidate });
  }
}

async function readCandidateStoryboard(projectId: string, candidate: "a" | "b" | "c"): Promise<VideoStoryboard> {
  const currentStoryboard =
    await readStoryboardJson(projectId, "render", "storyboard.json") ??
    await readStoryboardJson(projectId, "script", "storyboard.json");
  if (currentStoryboard) return currentStoryboard;

  const candidateStoryboard = await readStoryboardJson(projectId, "render", `candidate-${candidate}.json`);
  if (candidateStoryboard) return candidateStoryboard;

  const storyboardsPath = storage.projectPath(projectId, "script", "storyboards.json");
  if (existsSync(storyboardsPath)) {
    const storyboards = JSON.parse(await readFile(storyboardsPath, "utf8")) as VideoStoryboard[];
    const storyboard = storyboards.find((item) => item.candidate === candidate);
    if (storyboard) return storyboard;
    if (storyboards[0]) return storyboards[0];
  }
  throw new TrendForgeError("STORYBOARD_NOT_FOUND", "分镜不存在，请先生成宣传视频", { projectId, candidate }, 404);
}

async function writeStoryboardArtifacts(projectId: string, storyboard: VideoStoryboard, candidate: "a" | "b" | "c" = "a"): Promise<void> {
  await mkdir(storage.projectPath(projectId, "script"), { recursive: true });
  await mkdir(storage.projectPath(projectId, "render"), { recursive: true });
  await Promise.all([
    writeProjectJson(projectId, "script", "storyboard.json", storyboard),
    writeProjectJson(projectId, "render", "storyboard.json", storyboard),
    writeProjectJson(projectId, "script", "storyboards.json", [storyboard]),
    writeProjectJson(projectId, "render", `candidate-${candidate}.json`, { ...storyboard, candidate })
  ]);
}

async function readStoryboardJson(projectId: string, folder: string, filename: string): Promise<VideoStoryboard | undefined> {
  const filePath = storage.projectPath(projectId, folder, filename);
  if (!existsSync(filePath)) return undefined;
  return JSON.parse(await readFile(filePath, "utf8")) as VideoStoryboard;
}


function normalizeStyleSamples(samples?: CreatorStyleSample[], sampleText?: string): CreatorStyleSample[] {
  const rows = samples?.filter((sample) => sample.text?.trim()) ?? [];
  if (sampleText?.trim()) rows.push({ source: "manual", text: sampleText.trim(), title: "手动风格样本" });
  return rows.length ? rows : [{
    source: "manual",
    title: "默认爆款结构样本",
    text: "先说结论，这个热点真正值得看的地方有三个。第一，它降低了普通人的理解成本。第二，它给了创作者一个可拆解的选题角度。第三，它能转化成明确行动。"
  }];
}

function hasStyleSamples(body: Partial<{ styleSamples: CreatorStyleSample[]; styleSampleText: string }>): boolean {
  return Boolean(body.styleSampleText?.trim()) || Boolean(body.styleSamples?.some((sample) => sample.text?.trim()));
}

function normalizeRssUrls(urls?: string[], url?: string): string[] {
  return [...(urls ?? []), ...(url ? [url] : [])].map((value) => value.trim()).filter(Boolean);
}

function sourceLabelForLog(source: SourceType): string {
  const labels: Record<SourceType, string> = {
    manual: "手动输入",
    "product-hunt": "Product Hunt",
    "hacker-news": "Hacker News",
    reddit: "Reddit",
    "x-twitter": "X/Twitter",
    rss: "RSS"
  };
  return labels[source];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createSceneImageProvider(
  source: SourceType,
  settings: Awaited<ReturnType<typeof getSettings>>,
  projectId: string
): {
  searchImage?: (subject: string, outPath: string, seed: number) => Promise<string | undefined>;
  generateImage?: (subject: string, outPath: string, seed: number) => Promise<string | undefined>;
} {
  const searchImage = source === "manual" && settings.DEEPSEEK_API_KEY
    ? async (subject: string, outPath: string, seed: number) => {
        await writeLog({ projectId, level: "info", message: "DeepSeek 搜索图片开始", context: { subject, seed } });
        try {
          const items = await searchProducts(subject, settings.DEEPSEEK_API_KEY ?? "", settings.DEEPSEEK_API_BASE);
          const imageUrl = items.map((item) => String((item.raw as { imageUrl?: unknown })?.imageUrl ?? "")).find((value) => value.trim());
          if (!imageUrl) {
            await writeLog({ projectId, level: "warn", message: "DeepSeek 搜索图片未返回可用 URL", context: { subject, seed } });
            return undefined;
          }
          const downloaded = await downloadImageToFile(imageUrl, outPath, 15000);
          if (downloaded) {
            await writeLog({ projectId, level: "info", message: "图片下载成功", context: { subject, seed, imageUrl, path: downloaded } });
            return downloaded;
          }
          await writeLog({ projectId, level: "warn", message: "图片下载失败", context: { subject, seed, imageUrl } });
          return undefined;
        } catch (error) {
          await writeLog({ projectId, level: "warn", message: "DeepSeek 搜索图片失败", context: { subject, seed, error: errorMessage(error) } });
          return undefined;
        }
      }
    : undefined;

  const generateImage = process.env.IMAGE_PROVIDER === "pollinations"
    ? async (subject: string, outPath: string, seed: number) => {
        const promptText = encodeURIComponent(`${subject}. cinematic promotional poster illustration, clean composition, vibrant, high detail, no text, no watermark`.slice(0, 220));
        const url = `https://image.pollinations.ai/prompt/${promptText}?width=768&height=1024&nologo=true&seed=${seed}`;
        await writeLog({ projectId, level: "info", message: "外部图片生成开始", context: { provider: "pollinations", subject, seed } });
        const downloaded = await downloadImageToFile(url, outPath, 28000);
        if (downloaded) {
          await writeLog({ projectId, level: "info", message: "外部图片生成成功", context: { provider: "pollinations", subject, seed, path: downloaded } });
          return downloaded;
        }
        await writeLog({ projectId, level: "warn", message: "外部图片生成失败", context: { provider: "pollinations", subject, seed } });
        return undefined;
      }
    : undefined;

  return { searchImage, generateImage };
}

async function createFfmpegServiceFromSettings(): Promise<FfmpegService> {
  const settings = await getSettings();
  return new FfmpegService(normalizeToolPath(settings.FFMPEG_PATH, "ffmpeg"), normalizeToolPath(settings.FFPROBE_PATH, "ffprobe"));
}

function normalizeToolPath(value: string | undefined, fallback: string): string {
  const next = value?.trim();
  if (next && next !== fallback) return next;
  return discoverToolPath(fallback);
}

function normalizeDeviceScaleFactor(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  const clamped = Math.min(2, Math.max(1, value));
  return Math.round(clamped * 10) / 10;
}

type RenderQualitySceneSpecsSummary = {
  sceneCount: number;
  imageSceneCount: number;
  imageCoverage: number;
  templateCounts: Record<string, number>;
  visualTypeCounts: Record<string, number>;
};

type RenderQualitySummary = {
  sceneCount?: number;
  imageSceneCount?: number;
  imageCoverage?: number;
  assetSceneCount?: number;
  assetRoleCounts?: Record<string, number>;
  assetSourceCounts?: Record<string, number>;
  templateCounts?: Record<string, number>;
  visualTypeCounts?: Record<string, number>;
};

type TextFitSummary = {
  totalFitTextCount: number;
  clampedTextCount: number;
  clampedRate: number;
  clampedByRole: Record<string, number>;
  clampedByScene: Record<string, number>;
  clampedByTemplate: Record<string, number>;
};

type RenderQualityReportSummary = {
  renderProfile: "standard" | "high";
  encodeProfile: "standard" | "high";
  ratio: Ratio;
  width: number;
  height: number;
  fps: 24 | 30 | 60;
  themeId: string;
  qualitySummary?: RenderQualitySummary;
  textFitSummary?: TextFitSummary;
  sceneSpecs: RenderQualitySceneSpecsSummary;
};

function resolveRenderProfile(
  renderProfile: ExportSettings["renderProfile"],
  qualityProfile: ExportSettings["qualityProfile"],
  width: number,
  height: number,
  deviceScaleFactor: number
): "standard" | "high" {
  if (renderProfile === "high" || qualityProfile === "high") return "high";
  if (renderProfile === "standard" || qualityProfile === "standard") return "standard";
  if (Math.max(width, height) >= 2160) return "high";
  if (deviceScaleFactor >= 1.5) return "high";
  return "standard";
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

type RenderDataSceneSpec = {
  templateId?: string;
  visualType?: string;
  hasImage?: boolean;
};

type RenderDataFile = {
  ratio?: Ratio;
  width?: number;
  height?: number;
  fps?: 24 | 30 | 60;
  renderProfile?: "standard" | "high";
  encodeProfile?: "standard" | "high";
  themeId?: string;
  qualitySummary?: RenderQualitySummary;
  textFitSummary?: TextFitSummary;
  sceneSpecs?: RenderDataSceneSpec[];
};

type PromoGenerateRequest = Partial<{
  prompt: string;
  source: SourceType;
  contentType: MatrixContentType | "auto";
  persona: string;
  platform: MatrixPlatform;
  ratio: Ratio;
  language: Language;
  date: string;
  topCount: number;
  rssUrl: string;
  rssUrls: string[];
  mode: string;
  renderCandidates: number;
  styleName: string;
  styleNiche: string;
  styleAgent: CreatorStyleAgent;
  styleSamples: CreatorStyleSample[];
  styleSampleText: string;
}>;

type QualityReportFile = {
  render?: {
    ratio?: Ratio;
    width?: number;
    height?: number;
    fps?: 24 | 30 | 60;
    renderProfile?: "standard" | "high";
    encodeProfile?: "standard" | "high";
    themeId?: string;
  };
  qualitySummary?: RenderQualitySummary;
  textFitSummary?: TextFitSummary;
};

async function readRenderQualitySummary(projectId: string): Promise<RenderQualityReportSummary> {
  const renderDataPath = storage.projectPath(projectId, "render", "render-data.json");
  const qualityReportPath = storage.projectPath(projectId, "render", "quality-report.json");
  if (!existsSync(renderDataPath) || !existsSync(qualityReportPath)) {
    throw new TrendForgeError("QUALITY_REPORT_NOT_FOUND", "质量报告不存在", { projectId }, 404);
  }

  const [renderDataRaw, qualityReportRaw] = await Promise.all([
    readFile(renderDataPath, "utf8"),
    readFile(qualityReportPath, "utf8")
  ]);

  const renderData = JSON.parse(renderDataRaw) as RenderDataFile;
  const qualityReport = JSON.parse(qualityReportRaw) as QualityReportFile;
  const sceneSpecs = summarizeQualitySceneSpecs(renderData.sceneSpecs ?? []);
  const render = qualityReport.render ?? {};

  return {
    renderProfile: render.renderProfile ?? renderData.renderProfile ?? "standard",
    encodeProfile: render.encodeProfile ?? renderData.encodeProfile ?? "standard",
    ratio: render.ratio ?? renderData.ratio ?? "9:16",
    width: render.width ?? renderData.width ?? ratioToSize(render.ratio ?? renderData.ratio ?? "9:16").width,
    height: render.height ?? renderData.height ?? ratioToSize(render.ratio ?? renderData.ratio ?? "9:16").height,
    fps: render.fps ?? renderData.fps ?? 30,
    themeId: render.themeId ?? renderData.themeId ?? "unknown",
    qualitySummary: qualityReport.qualitySummary ?? renderData.qualitySummary,
    textFitSummary: qualityReport.textFitSummary ?? renderData.textFitSummary,
    sceneSpecs
  };
}

function summarizeQualitySceneSpecs(sceneSpecs: RenderDataSceneSpec[]): RenderQualitySceneSpecsSummary {
  const countBy = (values: string[]) =>
    values.reduce<Record<string, number>>((acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    }, {});
  const templateCounts = countBy(sceneSpecs.map((spec) => spec.templateId ?? "unknown"));
  const visualTypeCounts = countBy(sceneSpecs.map((spec) => spec.visualType ?? "unknown"));
  const imageSceneCount = sceneSpecs.filter((spec) => spec.hasImage).length;
  return {
    sceneCount: sceneSpecs.length,
    imageSceneCount,
    imageCoverage: sceneSpecs.length ? Number((imageSceneCount / sceneSpecs.length).toFixed(2)) : 0,
    templateCounts,
    visualTypeCounts
  };
}

// Inline scene product images as base64 data URIs so makeFilmHtml renders them
// in BOTH the http preview iframe and the file:// export (a raw fs path loads in
// neither). Capped so the HTML stays lean; oversized/missing images fall through
// to the template's gradient placeholder (so no broken <img>).
const IMAGE_INLINE_CAP_BYTES = 1_500_000;
function imageToDataUri(filePath?: string): string | undefined {
  if (!filePath) return undefined;
  if (filePath.startsWith("data:")) return filePath;
  try {
    if (!existsSync(filePath) || statSync(filePath).size > IMAGE_INLINE_CAP_BYTES) return undefined;
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".gif" ? "image/gif" : ext === ".svg" ? "image/svg+xml" : "image/jpeg";
    return `data:${mime};base64,${readFileSync(filePath).toString("base64")}`;
  } catch {
    return undefined;
  }
}
function inlineSceneImages<T extends { contentSlots: { image?: string; assets?: AssetSlot[]; product?: { screenshotPath?: string; thumbnailPath?: string; logoPath?: string } } }>(specs: T[]): T[] {
  return specs.map((spec) => {
    const product = spec.contentSlots.product;
    const assets = spec.contentSlots.assets?.map((asset) => ({
      ...asset,
      src: imageToDataUri(asset.src) ?? asset.src
    }));
    return {
      ...spec,
      contentSlots: {
        ...spec.contentSlots,
        image: imageToDataUri(spec.contentSlots.image),
        assets,
        product: product
          ? {
              ...product,
              screenshotPath: imageToDataUri(product.screenshotPath),
              thumbnailPath: imageToDataUri(product.thumbnailPath),
              logoPath: imageToDataUri(product.logoPath)
            }
          : product
      }
    };
  });
}

function sceneAssets(spec: VisualSceneSpec): AssetSlot[] {
  return spec.contentSlots.assets ?? [];
}

function sceneAssetRoles(spec: VisualSceneSpec): string[] {
  return sceneAssets(spec).map((asset) => asset.role);
}

function sceneAssetSources(spec: VisualSceneSpec): string[] {
  return sceneAssets(spec).map((asset) => asset.source);
}

function hasRenderableImage(spec: VisualSceneSpec): boolean {
  return Boolean(
    spec.contentSlots.image
    || spec.contentSlots.assets?.some((asset) => Boolean(asset.src.trim()))
    || spec.contentSlots.product?.screenshotPath
    || spec.contentSlots.product?.thumbnailPath
    || spec.contentSlots.product?.logoPath
  );
}

function summarizeRenderSpecs(specs: VisualSceneSpec[]) {
  const sceneSpecs = specs.map((spec) => ({
    templateId: spec.templateId ?? spec.design?.templateId ?? "unknown",
    visualType: spec.visualType,
    hasImage: hasRenderableImage(spec),
    assetRoles: sceneAssetRoles(spec),
    assetSources: sceneAssetSources(spec),
    designPlanId: spec.designPlanId ?? "",
    themeId: spec.style.themeId
  }));
  const countBy = (values: string[]) =>
    values.reduce<Record<string, number>>((acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    }, {});
  const imageSceneCount = sceneSpecs.filter((item) => item.hasImage).length;
  const assetRoleCounts = countBy(specs.flatMap((spec) => sceneAssetRoles(spec)));
  const assetSourceCounts = countBy(specs.flatMap((spec) => sceneAssetSources(spec)));
  return {
    sceneCount: sceneSpecs.length,
    imageSceneCount,
    imageCoverage: sceneSpecs.length ? Number((imageSceneCount / sceneSpecs.length).toFixed(2)) : 0,
    assetSceneCount: sceneSpecs.filter((item) => item.assetRoles.length > 0).length,
    assetRoleCounts,
    assetSourceCounts,
    templateCounts: countBy(sceneSpecs.map((item) => item.templateId)),
    visualTypeCounts: countBy(sceneSpecs.map((item) => item.visualType))
  };
}

function matrixScriptType(contentType?: MatrixContentType | "auto"): "trend-list" | "single-news" | "comparison" {
  switch (contentType) {
    case "news_explain":
    case "opinion_comment":
      return "single-news";
    case "tool_list":
      return "trend-list";
    default:
      return "trend-list";
  }
}

function storyboardSourceFor(source: SourceType): VideoStoryboard["source"] {
  switch (source) {
    case "product-hunt": return "product_hunt";
    case "hacker-news": return "hacker_news";
    case "reddit": return "reddit";
    case "x-twitter": return "x";
    case "rss": return "rss";
    default: return "manual";
  }
}

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}分${String(rest).padStart(2, "0")}秒` : `${rest}秒`;
}

function storyboardToVideoScript(storyboard: VideoStoryboard): VideoScript {
  return {
    title: storyboard.title,
    subtitle: storyboard.subtitle,
    language: storyboard.language,
    scenes: storyboard.scenes.map((scene) => ({
      id: scene.id,
      type: scene.type === "cover" ? "cover" : scene.type === "overview" ? "intro" : scene.type === "summary" ? "outro" : "item",
      duration: scene.duration,
      title: scene.title,
      screenText: scene.screenText,
      voiceText: scene.subtitleZh,
      voiceTextEn: scene.subtitleEn,
      visualHint: scene.visualDirection,
      items: scene.productRank ? storyboard.products.filter((product) => product.rank === scene.productRank).map((product) => ({
        id: `product_${product.rank}`,
        source: "product-hunt",
        title: product.name,
        url: product.website,
        summary: product.tagline,
        score: product.votes,
        comments: product.comments,
        rank: product.rank,
        thumbnail: product.thumbnailPath,
        raw: product
      })) : undefined,
      metadata: {
        storyboardType: scene.type,
        keywords: scene.keywords,
        assetHints: scene.assetHints,
        shots: scene.shots,
        brollQueries: scene.brollQueries,
        transition: scene.transition,
        camera: scene.camera,
        bgmCue: scene.bgmCue,
        sfxCue: scene.sfxCue,
        audioDirection: storyboard.audioDirection
      }
    })),
    voiceoverText: storyboard.scenes.map((scene) => scene.subtitleZh).join("\n"),
    hashtags: storyboard.hashtags,
    description: storyboard.description
  };
}

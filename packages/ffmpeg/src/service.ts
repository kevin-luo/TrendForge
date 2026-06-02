import { spawn } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { TrendForgeError, type Ratio, type Scene } from "@trendforge/core";
import type { CommandResult, MediaInfo } from "./types.js";

export interface SceneVideoOptions {
  scenes: Scene[];
  width: number;
  height: number;
  duration: number;
  fps: number;
  outputPath: string;
  codec?: "libx264" | "libvpx-vp9";
}

export interface SceneImageInput {
  path: string;
  duration: number;
}

const requireInstaller = createRequire(import.meta.url);
const bundledFfmpegPath = installerPath("@ffmpeg-installer/ffmpeg", "ffmpeg");
const bundledFfprobePath = installerPath("@ffprobe-installer/ffprobe", "ffprobe");

export class FfmpegService {
  private readonly ffmpegPath: string;
  private readonly ffprobePath: string;

  /** Exposed so callers can run arbitrary ffmpeg commands */
  get ffmpegBin(): string { return this.ffmpegPath; }

  constructor(ffmpegPath = process.env.FFMPEG_PATH, ffprobePath = process.env.FFPROBE_PATH) {
    this.ffmpegPath = configuredPath(ffmpegPath, bundledFfmpegPath);
    this.ffprobePath = configuredPath(ffprobePath, bundledFfprobePath);
  }

  async check(): Promise<{ ffmpeg: boolean; ffprobe: boolean }> {
    const [ffmpeg, ffprobe] = await Promise.all([this.commandAvailable(this.ffmpegPath), this.commandAvailable(this.ffprobePath)]);
    return { ffmpeg, ffprobe };
  }

  async getMediaInfo(inputPath: string): Promise<MediaInfo> {
    const result = await this.run(this.ffprobePath, [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      inputPath
    ]);
    const raw = JSON.parse(result.stdout) as {
      format?: { duration?: string };
      streams?: Array<Record<string, unknown>>;
    };
    const video = raw.streams?.find((stream) => stream.codec_type === "video");
    const audio = raw.streams?.find((stream) => stream.codec_type === "audio");
    return {
      duration: raw.format?.duration ? Number(raw.format.duration) : undefined,
      width: video?.width ? Number(video.width) : undefined,
      height: video?.height ? Number(video.height) : undefined,
      fps: parseFps(String(video?.avg_frame_rate ?? "")),
      videoCodec: video?.codec_name ? String(video.codec_name) : undefined,
      audioCodec: audio?.codec_name ? String(audio.codec_name) : undefined,
      raw
    };
  }

  async extractAudio(videoPath: string, outputPath: string): Promise<string> {
    await this.run(this.ffmpegPath, ["-y", "-i", videoPath, "-vn", "-acodec", "copy", outputPath]);
    return outputPath;
  }

  async mergeAudio(videoPath: string, audioPath: string, outputPath: string): Promise<string> {
    await this.run(this.ffmpegPath, ["-y", "-i", videoPath, "-i", audioPath, "-c:v", "copy", "-map", "0:v:0", "-map", "1:a:0", "-shortest", outputPath]);
    return outputPath;
  }

  async mergeAudioForExport(videoPath: string, audioPath: string, outputPath: string, format: "mp4" | "webm"): Promise<string> {
    const audioCodecArgs = format === "webm" ? ["-c:a", "libopus", "-b:a", "128k"] : ["-c:a", "aac", "-b:a", "192k"];
    await this.run(this.ffmpegPath, [
      "-y",
      "-i",
      videoPath,
      "-i",
      audioPath,
      "-c:v",
      "copy",
      ...audioCodecArgs,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-shortest",
      outputPath
    ]);
    return outputPath;
  }

  async burnSubtitles(videoPath: string, subtitlePath: string, outputPath: string): Promise<string> {
    const escaped = subtitlePath.replace(/\\/g, "/").replace(/:/g, "\\:");
    await this.run(this.ffmpegPath, ["-y", "-i", videoPath, "-vf", `ass='${escaped}'`, "-c:a", "copy", outputPath]);
    return outputPath;
  }

  async cropToRatio(videoPath: string, ratio: Ratio, outputPath: string): Promise<string> {
    const expression = cropExpression(ratio);
    await this.run(this.ffmpegPath, ["-y", "-i", videoPath, "-vf", expression, outputPath]);
    return outputPath;
  }

  async resize(videoPath: string, width: number, height: number, outputPath: string): Promise<string> {
    await this.run(this.ffmpegPath, ["-y", "-i", videoPath, "-vf", `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`, outputPath]);
    return outputPath;
  }

  async concatVideos(inputs: string[], outputPath: string): Promise<string> {
    const args = ["-y", ...inputs.flatMap((input) => ["-i", input]), "-filter_complex", `concat=n=${inputs.length}:v=1:a=1`, outputPath];
    await this.run(this.ffmpegPath, args);
    return outputPath;
  }

  /**
   * Render a multi-scene video using ffmpeg lavfi + drawtext overlays.
   * Each scene occupies an equal time slice.
   * No external browser required — works purely with ffmpeg filters.
   */
  async renderSceneVideo(opts: SceneVideoOptions): Promise<string> {
    const { scenes, width, height, duration, fps, outputPath, codec = "libx264" } = opts;
    const sceneDuration = duration / Math.max(1, scenes.length);
    const isPortrait = height > width;

    // Build the complex filtergraph:
    // 1. color base background
    // 2. For each scene: overlay title + subtitle text visible during its time window
    const filterParts: string[] = [];
    const titleSize = isPortrait ? Math.round(height * 0.052) : Math.round(height * 0.055);
    const bodySize = isPortrait ? Math.round(height * 0.028) : Math.round(height * 0.030);
    const subtitleSize = isPortrait ? Math.round(height * 0.020) : Math.round(height * 0.022);

    // Helper to escape ffmpeg drawtext special chars
    const esc = (s: string) =>
      s.replace(/\\/g, "\\\\").replace(/'/g, "’").replace(/:/g, "\\:").replace(/\[/g, "\\[").replace(/\]/g, "\\]");

    // Truncate long text for display
    const trunc = (s: string, max: number) => s.length > max ? s.slice(0, max - 1) + "…" : s;

    // Accent bar + scene number box (drawbox)
    const padX = Math.round(width * 0.06);
    const padY = Math.round(height * 0.08);
    const barH = Math.round(height * 0.004);
    const sceneNumberY = padY;
    const titleY = padY + barH + Math.round(height * 0.03);
    const bodyY = titleY + titleSize + Math.round(height * 0.025);
    const subtitleY = Math.round(height * 0.88);

    // Background gradient base is cyan-tinted dark
    const bgFilter = `color=c=0x080B12:s=${width}x${height}:r=${fps}:d=${duration}[bg]`;
    filterParts.push(bgFilter);

    // Grid overlay (subtle dot pattern via geq) — skip for simplicity, just use background

    const drawFilters: string[] = [];

    scenes.forEach((scene, i) => {
      const start = i * sceneDuration;
      const end = start + sceneDuration;
      const enable = `between(t,${start.toFixed(2)},${end.toFixed(2)})`;

      const titleText = esc(trunc(scene.title, 60));
      const bodyText = esc(trunc(scene.screenText, 120));
      const subText = esc(trunc(scene.voiceText, 100));
      const sceneNum = scene.type === "item" ? String(scene.items?.[0]?.rank ?? i + 1) : scene.type.toUpperCase();

      // Accent top bar
      drawFilters.push(
        `drawbox=x=${padX}:y=${padY - barH - 4}:w=${Math.round(width * 0.12)}:h=${barH}:color=0x67E8F9:t=fill:enable='${enable}'`
      );
      // Scene number / type badge
      drawFilters.push(
        `drawtext=text='${esc(sceneNum)}':fontsize=${Math.round(titleSize * 0.55)}:fontcolor=0x67E8F9:x=${padX}:y=${sceneNumberY - barH - 4 - Math.round(height * 0.025)}:alpha=0.85:enable='${enable}'`
      );
      // Title
      drawFilters.push(
        `drawtext=text='${titleText}':fontsize=${titleSize}:fontcolor=white:x=${padX}:y=${titleY}:line_spacing=4:enable='${enable}'`
      );
      // Body text (wrapped via multiple lines)
      const words = bodyText.split(" ");
      const charsPerLine = Math.floor(width * 0.7 / (bodySize * 0.55));
      let line = "", lines: string[] = [];
      for (const w of words) {
        if ((line + " " + w).length > charsPerLine && line) { lines.push(line); line = w; }
        else line = line ? line + " " + w : w;
      }
      if (line) lines.push(line);
      lines.slice(0, 4).forEach((l, li) => {
        drawFilters.push(
          `drawtext=text='${esc(l)}':fontsize=${bodySize}:fontcolor=0xD8E4F8:x=${padX}:y=${bodyY + li * (bodySize + 8)}:enable='${enable}'`
        );
      });
      // Subtitle bar at bottom
      drawFilters.push(
        `drawbox=x=${padX}:y=${subtitleY - 10}:w=${width - padX * 2}:h=${subtitleSize + 28}:color=0x000000@0.5:t=fill:enable='${enable}'`
      );
      drawFilters.push(
        `drawtext=text='${subText}':fontsize=${subtitleSize}:fontcolor=white:x=${padX + 10}:y=${subtitleY}:enable='${enable}'`
      );
    });

    // Combine all draw filters as a chain on [bg]
    const allFilters = drawFilters.join(",");
    const filterComplex = `[0:v]${allFilters}[out]`;

    const codecArgs = codec === "libvpx-vp9"
      ? ["-c:v", "libvpx-vp9", "-b:v", "2M"]
      : ["-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p"];

    await this.run(this.ffmpegPath, [
      "-y",
      "-f", "lavfi",
      "-i", `color=c=0x080B12:s=${width}x${height}:r=${fps}:d=${duration}`,
      "-filter_complex", filterComplex,
      "-map", "[out]",
      "-t", String(duration),
      ...codecArgs,
      outputPath
    ]);

    return outputPath;
  }

  /**
   * Assemble a PNG frame sequence into a video.
   * `frameGlob` must be an ffmpeg-style pattern like `/path/frames/frame_%06d.png`
   */
  async framesToVideo(frameGlob: string, fps: number, duration: number, outputPath: string, codec: "libx264" | "libvpx-vp9" = "libx264"): Promise<string> {
    const inputPattern = frameGlob.replace(/\\/g, "/");
    const args = [
      "-y",
      "-framerate", String(fps),
      "-i", inputPattern,
      "-t", String(duration),
      "-c:v", codec,
      "-pix_fmt", "yuv420p",
      ...(codec === "libx264" ? ["-preset", "fast", "-crf", "18"] : ["-b:v", "2M"]),
      outputPath
    ];
    await this.run(this.ffmpegPath, args);
    return outputPath;
  }

  async sceneImagesToVideo(
    inputs: SceneImageInput[],
    width: number,
    height: number,
    fps: number,
    outputPath: string,
    codec: "libx264" | "libvpx-vp9" = "libx264"
  ): Promise<string> {
    if (!inputs.length) {
      throw new TrendForgeError("FFMPEG_INPUT_MISSING", "缺少场景图片", { outputPath }, 400);
    }

    const normalizedInputs = inputs.map((input) => ({
      path: input.path.replace(/\\/g, "/"),
      duration: Math.max(1, input.duration),
      frames: Math.max(1, Math.round(input.duration * fps))
    }));
    const segmentDir = path.join(path.dirname(outputPath), "segments");
    await mkdir(segmentDir, { recursive: true });

    const codecArgs = codec === "libvpx-vp9"
      ? ["-c:v", "libvpx-vp9", "-b:v", "2M", "-pix_fmt", "yuv420p"]
      : ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p"];

    const segmentPaths: string[] = [];
    for (const [index, input] of normalizedInputs.entries()) {
      const segmentPath = path.join(segmentDir, `segment_${String(index).padStart(3, "0")}.${codec === "libvpx-vp9" ? "webm" : "mp4"}`);
      const zoomExpr = index % 2 === 0
        ? "min(1.06,1+0.00075*on)"
        : "max(1.0,1.06-0.00055*on)";
      const xExpr = index % 3 === 0 ? `(iw-ow)*on/${input.frames}` : "(iw-ow)/2";
      const yExpr = index % 3 === 1 ? `(ih-oh)*on/${input.frames}` : "(ih-oh)/2";
      const filter = [
        `scale=${Math.ceil(width * 1.1)}:${Math.ceil(height * 1.1)}:force_original_aspect_ratio=increase,`,
        `crop=${Math.ceil(width * 1.08)}:${Math.ceil(height * 1.08)},`,
        `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${input.frames}:fps=${fps}:s=${width}x${height},`,
        "format=yuv420p,setpts=PTS-STARTPTS"
      ].join("");
      await this.run(this.ffmpegPath, [
        "-y",
        "-loop", "1",
        "-framerate", String(fps),
        "-t", input.duration.toFixed(3),
        "-i", input.path,
        "-vf", filter,
        "-frames:v", String(input.frames),
        "-r", String(fps),
        ...codecArgs,
        segmentPath
      ]);
      segmentPaths.push(segmentPath);
    }

    if (segmentPaths.length === 1) {
      await this.run(this.ffmpegPath, ["-y", "-i", segmentPaths[0]!, "-c", "copy", outputPath]);
      return outputPath;
    }

    const transition = Math.min(0.35, Math.max(0.12, Math.min(...normalizedInputs.map((input) => input.duration)) / 4));
    const prepFilters = segmentPaths.map((_segmentPath, index) => `[${index}:v]setpts=PTS-STARTPTS,format=yuv420p[v${index}]`);
    const xfadeFilters: string[] = [];
    let previousLabel = "v0";
    let accumulatedDuration = normalizedInputs[0]?.duration ?? 0;
    for (let index = 1; index < segmentPaths.length; index++) {
      const outputLabel = index === segmentPaths.length - 1 ? "outv" : `x${index}`;
      const offset = Math.max(0, accumulatedDuration - index * transition);
      xfadeFilters.push(`[${previousLabel}][v${index}]xfade=transition=fade:duration=${transition.toFixed(3)}:offset=${offset.toFixed(3)}[${outputLabel}]`);
      previousLabel = outputLabel;
      accumulatedDuration += normalizedInputs[index]?.duration ?? 0;
    }

    try {
      await this.run(this.ffmpegPath, [
        "-y",
        ...segmentPaths.flatMap((segmentPath) => ["-i", segmentPath.replace(/\\/g, "/")]),
        "-filter_complex", [...prepFilters, ...xfadeFilters].join(";"),
        "-map", "[outv]",
        "-r", String(fps),
        ...codecArgs,
        outputPath
      ]);
      return outputPath;
    } catch {
      // Some older FFmpeg builds can miss xfade. The concat path keeps export available.
    }

    const listPath = path.join(segmentDir, "concat.txt");
    await writeFile(listPath, segmentPaths.map((segmentPath) => `file '${path.basename(segmentPath).replace(/'/g, "'\\''")}'`).join("\n"), "utf8");

    await this.run(this.ffmpegPath, [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", listPath.replace(/\\/g, "/"),
      "-c", "copy",
      outputPath
    ]);
    return outputPath;
  }

  async createColorVideo(width: number, height: number, duration: number, outputPath: string, color = "#080B12", fps = 30): Promise<string> {
    await this.run(this.ffmpegPath, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${color}:s=${width}x${height}:r=${fps}:d=${duration}`,
      "-pix_fmt",
      "yuv420p",
      outputPath
    ]);
    return outputPath;
  }

  async run(command: string, args: string[]): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { windowsHide: true });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.on("error", (error) => {
        reject(
          new TrendForgeError(
            "FFMPEG_SPAWN_ERROR",
            `${toolName(command)} 启动失败：未找到可执行文件`,
            { command, error: error.message, args },
            500
          )
        );
      });
      child.on("close", (code) => {
        const result = { command, args, stdout, stderr };
        if (code === 0) resolve(result);
        else reject(new TrendForgeError("FFMPEG_COMMAND_ERROR", `${command} 执行失败`, { code, ...result }, 500));
      });
    });
  }

  private async commandAvailable(command: string): Promise<boolean> {
    if (command.includes("\\") || command.includes("/")) {
      return access(command).then(() => true, () => false);
    }
    return this.run(command, ["-version"]).then(() => true, () => false);
  }
}

function configuredPath(value: string | undefined, fallback: string): string {
  const next = value?.trim();
  return next && next !== "ffmpeg" && next !== "ffprobe" ? next : fallback;
}

function installerPath(packageName: string, fallback: string): string {
  try {
    const installer = requireInstaller(packageName) as { path?: unknown };
    return typeof installer.path === "string" ? installer.path : fallback;
  } catch {
    return fallback;
  }
}

function toolName(command: string): string {
  return command.toLowerCase().includes("probe") ? "FFprobe" : "FFmpeg";
}

function parseFps(value: string): number | undefined {
  const [a, b] = value.split("/").map(Number);
  if (!a) return undefined;
  return b ? a / b : a;
}

function cropExpression(ratio: Ratio): string {
  const target = ratio === "16:9" ? "16/9" : ratio === "1:1" ? "1/1" : ratio === "4:5" ? "4/5" : "9/16";
  return `crop='if(gt(iw/ih,${target}),ih*${target},iw)':'if(gt(iw/ih,${target}),ih,iw/${target})'`;
}

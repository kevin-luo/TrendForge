import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PublishPack, SubtitleTrack, VideoStoryboard } from "@trendforge/core";
import { exportAss, exportSrt, exportVtt } from "@trendforge/subtitles";

export type SubtitlePackageResult = {
  dir: string;
  files: Record<string, string>;
};

export async function writeSubtitlePackage(projectDir: string, storyboard: VideoStoryboard): Promise<SubtitlePackageResult> {
  const dir = path.join(projectDir, "subtitles");
  await mkdir(dir, { recursive: true });
  const files: Record<string, string> = {};
  for (const track of storyboard.subtitleTracks) {
    files[`subtitle.${track.language}.srt`] = await writeTrack(dir, track, "srt");
    files[`subtitle.${track.language}.ass`] = await writeTrack(dir, track, "ass", storyboard);
    files[`subtitle.${track.language}.vtt`] = await writeTrack(dir, track, "vtt");
  }
  files["cues.json"] = path.join(dir, "cues.json");
  await writeFile(files["cues.json"], JSON.stringify(storyboard.subtitleTracks, null, 2), "utf8");
  return { dir, files };
}

export async function writeJianyingNote(outputDir: string): Promise<string> {
  const file = path.join(outputDir, "jianying-note.txt");
  await writeFile(
    file,
    [
      "剪映导入建议",
      "",
      "1. 先导入 video.mp4。",
      "2. 推荐导入 subtitles/subtitle.zh.srt 或 subtitles/subtitle.bilingual.srt。",
      "3. 可以在剪映中使用文本朗读或 AI 配音。",
      "4. 如果字幕时间略有偏差，可以整体平移字幕轨道。",
      "5. 当前 TrendForge 输出为无配音版本，便于后续在剪映中测试配音效果。"
    ].join("\n"),
    "utf8"
  );
  return file;
}

export async function writePublishPackage(outputDir: string, publishPack: PublishPack | undefined): Promise<string> {
  const dir = path.join(outputDir, "publish");
  await mkdir(dir, { recursive: true });
  const pack = publishPack ?? {
    titles: ["TrendForge 自动生成视频"],
    description: "本视频由 TrendForge 生成，可导入剪映进行配音、BGM 和二次编辑。",
    hashtags: ["TrendForge"],
    platformCopies: {}
  };
  await writeFile(path.join(dir, "titles.json"), JSON.stringify(pack.titles, null, 2), "utf8");
  await writeFile(path.join(dir, "description.md"), pack.description, "utf8");
  await writeFile(path.join(dir, "hashtags.txt"), pack.hashtags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" "), "utf8");
  await writeFile(path.join(dir, "douyin.txt"), pack.platformCopies.douyin ?? "", "utf8");
  await writeFile(path.join(dir, "xiaohongshu.txt"), pack.platformCopies.xiaohongshu ?? "", "utf8");
  await writeFile(path.join(dir, "wechat_channels.txt"), pack.platformCopies.wechatChannels ?? "", "utf8");
  await writeFile(path.join(dir, "bilibili.txt"), pack.platformCopies.bilibili ?? "", "utf8");
  await writeFile(path.join(dir, "youtube.txt"), pack.platformCopies.youtube ?? "", "utf8");
  return dir;
}

async function writeTrack(dir: string, track: SubtitleTrack, format: "srt" | "ass" | "vtt", storyboard?: VideoStoryboard): Promise<string> {
  const file = path.join(dir, `subtitle.${track.language}.${format}`);
  const size = storyboard?.ratio === "16:9" ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 };
  const content = format === "srt"
    ? exportSrt(track.cues)
    : format === "ass"
      ? exportAss(track.cues, size.width, size.height)
      : exportVtt(track.cues);
  await writeFile(file, content, "utf8");
  return file;
}

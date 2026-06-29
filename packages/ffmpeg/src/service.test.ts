import { beforeEach, describe, expect, it, vi } from "vitest";
import { FfmpegService } from "./service.js";

describe("FfmpegService framesToVideo profiles", () => {
  let service: FfmpegService;

  beforeEach(() => {
    service = new FfmpegService("ffmpeg", "ffprobe");
  });

  it("uses high quality H.264 settings", async () => {
    const runSpy = vi.spyOn(service, "run").mockResolvedValue({ command: "ffmpeg", args: [], stdout: "", stderr: "" });

    await service.framesToVideo("C:/tmp/frames/frame_%06d.png", 30, 2, "C:/tmp/output.mp4", "libx264", "high");

    const [, args] = runSpy.mock.calls[0] ?? [];
    expect(args).toContain("-c:v");
    expect(args).toContain("libx264");
    expect(args).toContain("-preset");
    expect(args).toContain("slow");
    expect(args).toContain("-crf");
    expect(args).toContain("16");
    expect(args).toContain("-pix_fmt");
    expect(args).toContain("yuv420p");
  });

  it("uses standard VP9 settings", async () => {
    const runSpy = vi.spyOn(service, "run").mockResolvedValue({ command: "ffmpeg", args: [], stdout: "", stderr: "" });

    await service.framesToVideo("C:/tmp/frames/frame_%06d.png", 30, 2, "C:/tmp/output.webm", "libvpx-vp9", "standard");

    const [, args] = runSpy.mock.calls[0] ?? [];
    expect(args).toContain("-c:v");
    expect(args).toContain("libvpx-vp9");
    expect(args).toContain("-deadline");
    expect(args).toContain("good");
    expect(args).toContain("-crf");
    expect(args).toContain("34");
    expect(args).toContain("-b:v");
    expect(args).toContain("0");
  });
});

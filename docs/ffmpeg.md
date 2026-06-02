# FFmpeg

TrendForge 使用 FFmpeg 处理音频、字幕烧录、裁切、缩放和最终视频导出。

## Windows

1. 下载 FFmpeg release。
2. 解压到本地目录。
3. 将 `bin` 加入 PATH，或在 `.env` 中设置完整路径：

```env
FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
FFPROBE_PATH=C:\ffmpeg\bin\ffprobe.exe
```

## Verify

```bash
ffmpeg -version
ffprobe -version
```

import type { SubtitleCue } from "@trendforge/core";
import { parseTime, toAssTime, toSrtTime, toVttTime } from "./time.js";

export function exportSrt(cues: SubtitleCue[]): string {
  return cues
    .map((cue, index) => `${index + 1}\n${toSrtTime(cue.start)} --> ${toSrtTime(cue.end)}\n${cue.text}${cue.textEn ? `\n${cue.textEn}` : ""}`)
    .join("\n\n")
    .concat("\n");
}

export function exportVtt(cues: SubtitleCue[]): string {
  return "WEBVTT\n\n".concat(
    cues
      .map((cue) => `${toVttTime(cue.start)} --> ${toVttTime(cue.end)}\n${cue.text}${cue.textEn ? `\n${cue.textEn}` : ""}`)
      .join("\n\n"),
    "\n"
  );
}

export function exportAss(cues: SubtitleCue[], width = 1080, height = 1920): string {
  const fontSize = height > width ? 54 : 42;
  const marginV = Math.round(height * 0.11);
  const events = cues
    .map((cue) => {
      const text = escapeAss([cue.text, cue.textEn ? `{\\fs${Math.round(fontSize * 0.72)}}${cue.textEn}` : ""].filter(Boolean).join("\\N"));
      return `Dialogue: 0,${toAssTime(cue.start)},${toAssTime(cue.end)},Default,,0,0,${marginV},,${text}`;
    })
    .join("\n");
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default, Microsoft YaHei, ${fontSize}, &H00F4F8FF, &H00A8D8FF, &HAA000000, &H66000000, 1, 0, 0, 0, 100, 100, 0, 0, 1, 3, 1, 2, 80, 80, ${marginV}, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}
`;
}

export function parseSrt(content: string): SubtitleCue[] {
  return content
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((block, index): SubtitleCue | undefined => {
      const lines = block.split("\n").filter(Boolean);
      const timeLine = lines.find((line) => line.includes("-->"));
      if (!timeLine) return undefined;
      const [start, end] = timeLine.split("-->").map((value) => parseTime(value.trim()));
      const textLines = lines.slice(lines.indexOf(timeLine) + 1);
      return {
        id: `cue_${index + 1}`,
        start: start ?? 0,
        end: end ?? start ?? 0,
        text: textLines[0] ?? "",
        textEn: textLines[1] || undefined
      };
    })
    .filter((cue): cue is SubtitleCue => cue !== undefined);
}

export function parseVtt(content: string): SubtitleCue[] {
  return parseSrt(content.replace(/^WEBVTT\s*/i, ""));
}

export function parseAss(content: string): SubtitleCue[] {
  return content
    .split(/\r?\n/)
    .filter((line) => line.startsWith("Dialogue:"))
    .map((line, index) => {
      const parts = line.split(",");
      const text = parts.slice(9).join(",").replace(/\\N/g, "\n").replace(/\{[^}]+}/g, "");
      const [main, en] = text.split("\n");
      return {
        id: `cue_${index + 1}`,
        start: parseTime(parts[1] ?? "0:00:00.00"),
        end: parseTime(parts[2] ?? "0:00:00.00"),
        text: main ?? "",
        textEn: en
      };
    });
}

function escapeAss(text: string): string {
  return text.replace(/\n/g, "\\N");
}

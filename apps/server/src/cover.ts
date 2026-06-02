import { writeFile } from "node:fs/promises";
import type { Ratio, VideoScript } from "@trendforge/core";
import { ratioToSize } from "@trendforge/core";

export async function writeCoverSvg(filePath: string, script: VideoScript, ratio: Ratio): Promise<string> {
  const size = ratioToSize(ratio);
  const title = escapeXml(script.title);
  const subtitle = escapeXml(script.subtitle ?? "AI Trend Video Workstation");
  const fontSize = size.height > size.width ? 74 : 64;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#080B12"/>
      <stop offset="0.56" stop-color="#0B1020"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" x2="1">
      <stop offset="0" stop-color="#67E8F9"/>
      <stop offset="1" stop-color="#8B5CF6"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <g opacity="0.18" stroke="#67E8F9" stroke-width="1">
    ${Array.from({ length: 24 }, (_, i) => `<line x1="0" y1="${i * 82}" x2="${size.width}" y2="${i * 82}"/>`).join("")}
    ${Array.from({ length: 16 }, (_, i) => `<line x1="${i * 82}" y1="0" x2="${i * 82}" y2="${size.height}"/>`).join("")}
  </g>
  <rect x="${size.width * 0.07}" y="${size.height * 0.12}" width="${size.width * 0.86}" height="${size.height * 0.76}" rx="26" fill="rgba(15,23,42,0.68)" stroke="rgba(148,163,184,0.32)"/>
  <text x="${size.width * 0.1}" y="${size.height * 0.2}" fill="#67E8F9" font-family="Arial, Microsoft YaHei" font-size="24">TRENDFORGE / NEO SIGNAL</text>
  <text x="${size.width * 0.1}" y="${size.height * 0.48}" fill="#F8FAFC" font-family="Arial, Microsoft YaHei" font-size="${fontSize}" font-weight="800">${title}</text>
  <text x="${size.width * 0.1}" y="${size.height * 0.56}" fill="#C8D4E8" font-family="Arial, Microsoft YaHei" font-size="${Math.round(fontSize * 0.42)}">${subtitle}</text>
  <rect x="${size.width * 0.1}" y="${size.height * 0.66}" width="${size.width * 0.52}" height="12" fill="rgba(103,232,249,0.16)"/>
  <rect x="${size.width * 0.1}" y="${size.height * 0.66}" width="${size.width * 0.38}" height="12" fill="url(#accent)"/>
  <text x="${size.width * 0.1}" y="${size.height * 0.78}" fill="#94A3B8" font-family="Arial" font-size="22">LOCAL-FIRST AI VIDEO STUDIO</text>
</svg>`;
  await writeFile(filePath, svg, "utf8");
  return filePath;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "\"":
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

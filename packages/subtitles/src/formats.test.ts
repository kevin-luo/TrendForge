import { describe, expect, it } from "vitest";
import { exportAss, exportSrt, parseSrt } from "./formats.js";

describe("subtitle formats", () => {
  it("exports and parses srt", () => {
    const srt = exportSrt([{ id: "1", start: 0, end: 2, text: "你好", textEn: "Hello" }]);
    expect(parseSrt(srt)[0]?.text).toBe("你好");
  });

  it("exports ass", () => {
    expect(exportAss([{ id: "1", start: 0, end: 2, text: "你好" }])).toContain("[Events]");
  });
});

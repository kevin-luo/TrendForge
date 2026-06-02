import { describe, expect, it } from "vitest";
import { extractJsonObject, ratioToSize, splitTextForVoice } from "./utils.js";

describe("core utils", () => {
  it("maps export ratios", () => {
    expect(ratioToSize("9:16")).toEqual({ width: 1080, height: 1920 });
    expect(ratioToSize("16:9")).toEqual({ width: 1920, height: 1080 });
  });

  it("extracts fenced json", () => {
    expect(extractJsonObject("```json\n{\"a\":1}\n```")).toBe("{\"a\":1}");
  });

  it("splits voice text", () => {
    expect(splitTextForVoice("第一句。第二句。", 4).length).toBeGreaterThan(1);
  });
});

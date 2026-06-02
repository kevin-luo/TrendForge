import { describe, expect, it } from "vitest";
import { MockScriptProvider } from "./mock.js";

describe("MockScriptProvider", () => {
  it("generates a usable script", async () => {
    const script = await new MockScriptProvider().generate({
      projectId: "p1",
      items: [],
      language: "zh",
      scriptType: "text-to-video"
    });
    expect(script.scenes.length).toBeGreaterThan(2);
    expect(script.voiceoverText.length).toBeGreaterThan(20);
  });
});

import { describe, expect, it } from "vitest";
import { ManualConnector } from "./manual.js";

describe("ManualConnector", () => {
  it("turns pasted text into a trend item", async () => {
    const items = await new ManualConnector().fetchTrending({ manualText: "TrendForge local workflow" });
    expect(items[0]?.title).toContain("TrendForge");
  });
});

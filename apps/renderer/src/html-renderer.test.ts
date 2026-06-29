import { describe, expect, it } from "vitest";
import { summarizeTextFitSamples, type TextFitSample } from "./html-renderer.js";

describe("summarizeTextFitSamples", () => {
  it("counts clamped text by role, scene, and template", () => {
    const samples: TextFitSample[] = [
      { role: "headline", sceneKey: "scene-0", templateKey: "trendforge.image-hero.hero-product", clamped: true },
      { role: "body", sceneKey: "scene-0", templateKey: "trendforge.image-hero.hero-product", clamped: false },
      { role: "body", sceneKey: "scene-1", templateKey: "trendforge.metric-rank.poster-stack", clamped: true },
      { role: "rank", sceneKey: "scene-1", templateKey: "trendforge.metric-rank.poster-stack", clamped: true }
    ];

    const summary = summarizeTextFitSamples(samples);

    expect(summary.totalFitTextCount).toBe(4);
    expect(summary.clampedTextCount).toBe(3);
    expect(summary.clampedRate).toBe(0.75);
    expect(summary.clampedByRole).toEqual({ headline: 1, body: 1, rank: 1 });
    expect(summary.clampedByScene).toEqual({ "scene-0": 1, "scene-1": 2 });
    expect(summary.clampedByTemplate).toEqual({
      "trendforge.image-hero.hero-product": 1,
      "trendforge.metric-rank.poster-stack": 2
    });
  });

  it("returns zeroed buckets for an empty sample set", () => {
    const summary = summarizeTextFitSamples([]);

    expect(summary.totalFitTextCount).toBe(0);
    expect(summary.clampedTextCount).toBe(0);
    expect(summary.clampedRate).toBe(0);
    expect(summary.clampedByRole).toEqual({});
    expect(summary.clampedByScene).toEqual({});
    expect(summary.clampedByTemplate).toEqual({});
  });
});

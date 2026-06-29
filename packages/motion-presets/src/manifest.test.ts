import { describe, expect, it } from "vitest";
import { motionEngineAdapterSpecSchema, motionTemplateManifestSchema } from "@trendforge/motion-core";
import { manifestForVisualType, motionEngineAdapters, motionPresetManifests, motionPresets, openDesignMotionSystems } from "./index.js";

describe("motion preset manifests", () => {
  it("declares one manifest per visual preset", () => {
    expect(motionPresetManifests).toHaveLength(motionPresets.length);
    for (const preset of motionPresets) {
      const manifest = manifestForVisualType(preset.visualType);
      expect(manifest.visualType).toBe(preset.visualType);
      expect(motionTemplateManifestSchema.parse(manifest).id).toContain(preset.visualType);
    }
  });

  it("declares the local motion renderer as the ready adapter", () => {
    const parsed = motionEngineAdapters.map((adapter) => motionEngineAdapterSpecSchema.parse(adapter));
    expect(parsed.find((adapter) => adapter.id === "motion-render")?.status).toBe("ready");
  });

  it("ships Open Design inspired motion systems", () => {
    const requiredSlugs = [
      "od-linear-saas",
      "od-vercel-minimal",
      "od-stripe-gradient",
      "od-apple-product",
      "od-editorial-paper",
      "od-cyber-signal"
    ];
    expect(openDesignMotionSystems).toHaveLength(6);
    expect(openDesignMotionSystems.map((system) => system.slug)).toEqual(requiredSlugs);
    expect(openDesignMotionSystems.every((system) => system.themeId === system.slug)).toBe(true);
    expect(openDesignMotionSystems.every((system) => system.designDocPath === `design-systems/${system.slug}/DESIGN.md`)).toBe(true);
    expect(openDesignMotionSystems.every((system) => system.origin.project === "nexu-io/open-design")).toBe(true);
    expect(openDesignMotionSystems.every((system) => system.qualityRules.length > 0)).toBe(true);
  });
});

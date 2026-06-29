import { defaultSafeAreas, type VisualSceneSpec } from "@trendforge/motion-core";
import { describe, expect, it } from "vitest";
import { makeFilmHtml, splitCaption } from "./html-film.js";

const IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Yv+QAAAAASUVORK5CYII=";

function spec(overrides: Partial<VisualSceneSpec> & Pick<VisualSceneSpec, "id" | "sceneId" | "shotId" | "visualType">): VisualSceneSpec {
  return {
    id: overrides.id,
    sceneId: overrides.sceneId,
    shotId: overrides.shotId,
    ratio: overrides.ratio ?? "9:16",
    duration: overrides.duration ?? 3,
    visualType: overrides.visualType,
    templateId: overrides.templateId,
    contentSlots: {
      headline: overrides.contentSlots?.headline ?? "今日信号",
      body: overrides.contentSlots?.body ?? "这一帧会根据模板分流。",
      image: overrides.contentSlots?.image ?? IMAGE,
      assets: overrides.contentSlots?.assets,
      chips: overrides.contentSlots?.chips ?? ["Alpha", "Beta", "Gamma"],
      metrics: overrides.contentSlots?.metrics ?? [{ label: "Rank", value: "#1" }, { label: "Votes", value: "520" }],
      entities: overrides.contentSlots?.entities ?? ["VectorPilot", "ShipPulse"],
      sourceLabel: overrides.contentSlots?.sourceLabel ?? "PROMO",
      caption: overrides.contentSlots?.caption ?? "先看这一段。",
      product: overrides.contentSlots?.product
    },
    motion: overrides.motion ?? {
      pace: "snap",
      camera: "push-in",
      transitionIn: "flash",
      transitionOut: "whip",
      beatSync: true,
      intensity: 5
    },
    style: overrides.style ?? { themeId: "paper-ink", typography: "bold-news", density: "high" },
    safeAreas: overrides.safeAreas ?? defaultSafeAreas("9:16"),
    designPlanId: overrides.designPlanId,
    engine: overrides.engine,
    contentGraphNodeId: overrides.contentGraphNodeId,
    design: overrides.design
  };
}

describe("makeFilmHtml", () => {
  it("splits long Chinese captions at punctuation and clause breaks", () => {
    const cues = splitCaption("这段视频先把核心问题讲清楚，再把方案展开说明，最后把落地结果收住。");

    expect(cues.length).toBeGreaterThan(1);
    expect(cues[0]).toMatch(/，$/);
    expect(cues[cues.length - 1]).toMatch(/。$/);
    expect(cues.every((cue) => cue.length <= 20)).toBe(true);
  });

  it("splits long English captions on spaces without breaking words", () => {
    const cues = splitCaption("This release brings a cleaner composition system for product videos and keeps OpenAI MotionForge branding intact.");

    expect(cues).toEqual([
      "This release",
      "brings a cleaner composition system",
      "for product videos",
      "and",
      "keeps OpenAI",
      "MotionForge",
      "branding intact."
    ]);
  });

  it("keeps numeric units and brand names intact", () => {
    const cues = splitCaption("我们把 1080p 素材放进 4K 画布，同时保留 OpenAI 与 MotionForge 这两个品牌名。");

    expect(cues.join(" | ")).toContain("1080p");
    expect(cues.join(" | ")).toContain("4K");
    expect(cues.join(" | ")).toContain("OpenAI");
    expect(cues.join(" | ")).toContain("MotionForge");
    for (let i = 0; i < cues.length - 1; i++) {
      expect(/[A-Za-z0-9]$/.test(cues[i]!) && /^[A-Za-z0-9]/.test(cues[i + 1]!)).toBe(false);
    }
  });

  it("routes image scenes to different template markers", () => {
    const html = makeFilmHtml(
      [
        spec({
          id: "scene_1",
          sceneId: "scene_1",
          shotId: "shot_1",
          visualType: "product-workspace",
          templateId: "trendforge.image-hero.hero-product",
          contentSlots: { headline: "Hero", image: IMAGE }
        }),
        spec({
          id: "scene_2",
          sceneId: "scene_2",
          shotId: "shot_2",
          visualType: "workflow-orbit",
          templateId: "trendforge.feature-stack.workflow-map",
          contentSlots: { headline: "Stack", image: IMAGE }
        }),
        spec({
          id: "scene_3",
          sceneId: "scene_3",
          shotId: "shot_3",
          visualType: "rank-race",
          templateId: "trendforge.metric-rank.poster-stack",
          contentSlots: { headline: "Rank", image: IMAGE }
        }),
        spec({
          id: "scene_4",
          sceneId: "scene_4",
          shotId: "shot_4",
          visualType: "split-compare",
          templateId: "trendforge.split-compare.split-editorial",
          contentSlots: { headline: "Compare", image: IMAGE }
        })
      ],
      { themeId: "paper-ink", fps: 30 }
    );

    expect(html).toContain('data-template="image-hero"');
    expect(html).toContain('data-template="feature-stack"');
    expect(html).toContain('data-template="metric-rank"');
    expect(html).toContain('data-template="split-compare"');
  });

  it("prefers role-based assets before contentSlots.image", () => {
    const hero = "hero-slot.png";
    const fallback = "fallback-slot.png";
    const html = makeFilmHtml(
      [
        spec({
          id: "scene_1",
          sceneId: "scene_1",
          shotId: "shot_1",
          visualType: "product-workspace",
          templateId: "trendforge.image-hero.hero-product",
          contentSlots: {
            headline: "Hero",
            image: fallback,
            assets: [{ role: "hero", src: hero, source: "generated" }]
          }
        })
      ],
      { themeId: "paper-ink", fps: 30 }
    );

    expect(html).toContain(hero);
    expect(html).not.toContain(fallback);
  });

  it("emits template-specific animation markers and frame-driven seek logic", () => {
    const html = makeFilmHtml(
      [
        spec({
          id: "scene_1",
          sceneId: "scene_1",
          shotId: "shot_1",
          visualType: "product-workspace",
          templateId: "trendforge.image-hero.hero-product",
          contentSlots: { headline: "Hero", image: IMAGE, caption: "先看这一段。" }
        }),
        spec({
          id: "scene_2",
          sceneId: "scene_2",
          shotId: "shot_2",
          visualType: "workflow-orbit",
          templateId: "trendforge.feature-stack.workflow-map",
          contentSlots: { headline: "Stack", image: IMAGE, caption: "第二段继续。" }
        }),
        spec({
          id: "scene_3",
          sceneId: "scene_3",
          shotId: "shot_3",
          visualType: "rank-race",
          templateId: "trendforge.metric-rank.poster-stack",
          contentSlots: { headline: "Rank", image: IMAGE, caption: "第三段收束。" }
        }),
        spec({
          id: "scene_4",
          sceneId: "scene_4",
          shotId: "shot_4",
          visualType: "split-compare",
          templateId: "trendforge.split-compare.split-editorial",
          contentSlots: { headline: "Compare", image: IMAGE, caption: "第四段对比。" }
        }),
        spec({
          id: "scene_5",
          sceneId: "scene_5",
          shotId: "shot_5",
          visualType: "whiteboard-explain",
          templateId: "trendforge.outro-cta.end-card",
          contentSlots: { headline: "CTA", image: IMAGE, caption: "最后一段落点。" }
        })
      ],
      { themeId: "paper-ink", fps: 30 }
    );

    expect(html).toContain('data-anim="hero-zoom"');
    expect(html).toContain('data-anim="media-pan"');
    expect(html).toContain('data-anim="rank-rise"');
    expect(html).toContain('data-anim="pane-drift"');
    expect(html).toContain('data-anim="cta-glow"');
    expect(html).toContain('data-cs="');
    expect(html).toContain('data-ce="');
    expect(html).toContain('data-fit-role="headline"');
    expect(html).toContain('data-fit-role="body"');
    expect(html).toContain('data-fit-role="card"');
    expect(html).toContain('data-fit-role="rank"');
    expect(html).toContain('data-max-lines="2"');
    expect(html).toContain('data-min-font="24"');
    expect(html).toContain("window.seek=function(frame)");
    expect(html).toContain("function fitTextBlocks()");
    expect(html).toContain('setAttribute("data-fit-state","clamped")');
    expect(html).toContain("var motionCache=");
    expect(html).toContain("function motionTransform(kind, pc, local, frame, depth)");
  });

  it("keeps window.seek and scene wrappers in the output", () => {
    const html = makeFilmHtml([spec({ id: "scene_1", sceneId: "scene_1", shotId: "shot_1", visualType: "rank-race" })], {
      themeId: "paper-ink",
      fps: 30
    });

    expect(html).toContain("window.seek=function(frame)");
    expect(html).toContain('class="scene');
  });

  it("writes custom width and height into the HTML shell", () => {
    const html = makeFilmHtml([spec({ id: "scene_1", sceneId: "scene_1", shotId: "shot_1", visualType: "rank-race" })], {
      themeId: "paper-ink",
      fps: 30,
      width: 1440,
      height: 2560
    });

    expect(html).toContain('meta name="viewport" content="width=1440,height=2560"');
    expect(html).toContain("body{width:1440px;height:2560px;");
    expect(html).toContain("window.seek=function(frame)");
  });
});

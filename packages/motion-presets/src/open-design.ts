import type { MotionFrameDesignSystem, VisualType } from "@trendforge/motion-core";

export type OpenDesignMotionSystem = MotionFrameDesignSystem & {
  slug: string;
  designDocPath: string;
  origin: {
    project: "nexu-io/open-design";
    url: string;
    license: "Apache-2.0";
  };
  bestFor: string[];
  templateBias: VisualType[];
  styleTags: string[];
};

const origin = {
  project: "nexu-io/open-design",
  url: "https://github.com/nexu-io/open-design",
  license: "Apache-2.0"
} as const;

type OpenDesignSystemInput = Omit<OpenDesignMotionSystem, "origin">;

const openDesignSystemSpecs: OpenDesignSystemInput[] = [
  {
    slug: "od-linear-saas",
    designDocPath: "design-systems/od-linear-saas/DESIGN.md",
    id: "open-design.od-linear-saas.frame-md",
    name: "Linear SaaS",
    source: "open-design",
    themeId: "od-linear-saas",
    stylePrompt: "Clean SaaS interface with linear grids, bright white surfaces, precise blue accents, soft gray structure and product-led hierarchy.",
    palette: {
      background: "#F7F9FC",
      surface: "#FFFFFF",
      ink: "#0F172A",
      muted: "#64748B",
      accents: ["#2563EB", "#14B8A6", "#0EA5E9", "#1D4ED8", "#CBD5E1"]
    },
    typography: {
      display: "Inter Display",
      body: "Inter",
      mono: "IBM Plex Mono",
      headlineWeight: 900,
      bodyWeight: 700
    },
    frameRules: [
      "Keep hierarchy compact and product-led",
      "Use grid alignment for cards, labels and dashboards",
      "Keep the top layer crisp and the background quiet"
    ],
    motionRules: [
      "Use clean fades and short slide-ins",
      "Use small scale pulses for active metrics",
      "Use structured transitions between panels"
    ],
    qualityRules: [
      "Each frame names a product, metric or feature",
      "Cards keep consistent corner radius and spacing rhythm",
      "Text stays readable at phone size"
    ],
    bestFor: ["SaaS launch", "product walkthrough", "workflow explanation"],
    templateBias: ["product-workspace", "data-pulse", "workflow-orbit"],
    styleTags: ["saas", "clean", "grid", "product"]
  },
  {
    slug: "od-vercel-minimal",
    designDocPath: "design-systems/od-vercel-minimal/DESIGN.md",
    id: "open-design.od-vercel-minimal.frame-md",
    name: "Vercel Minimal",
    source: "open-design",
    themeId: "od-vercel-minimal",
    stylePrompt: "Minimal monochrome system with generous whitespace, sharp black typography, subtle shadows and restrained accent color use.",
    palette: {
      background: "#FAFAF9",
      surface: "#FFFFFF",
      ink: "#111111",
      muted: "#6B7280",
      accents: ["#111111", "#A3A3A3", "#E5E7EB", "#6366F1", "#22C55E"]
    },
    typography: {
      display: "Inter",
      body: "Inter",
      mono: "IBM Plex Mono",
      headlineWeight: 900,
      bodyWeight: 650
    },
    frameRules: [
      "Leave open space around the primary message",
      "Use one focal block per frame",
      "Prefer silent geometry over decorative clutter"
    ],
    motionRules: [
      "Use gentle fades and measured easing",
      "Reveal content with quiet vertical drift",
      "Reserve motion for emphasis and sequencing"
    ],
    qualityRules: [
      "One frame carries one clear idea",
      "Whitespace stays intentional and balanced",
      "Accent use remains limited to highlight moments"
    ],
    bestFor: ["minimal product story", "simple landing-page recap", "calm explainer"],
    templateBias: ["whiteboard-explain", "split-compare", "product-workspace"],
    styleTags: ["minimal", "monochrome", "whitespace", "modern"]
  },
  {
    slug: "od-stripe-gradient",
    designDocPath: "design-systems/od-stripe-gradient/DESIGN.md",
    id: "open-design.od-stripe-gradient.frame-md",
    name: "Stripe Gradient",
    source: "open-design",
    themeId: "od-stripe-gradient",
    stylePrompt: "Rich gradient finance system with deep indigo, electric violet, cyan highlights and luminous layered depth.",
    palette: {
      background: "#07111F",
      surface: "#0B1730",
      ink: "#F8FAFC",
      muted: "#A8B3C7",
      accents: ["#635BFF", "#8B5CF6", "#22D3EE", "#14B8A6", "#F472B6"]
    },
    typography: {
      display: "Inter Display",
      body: "Inter",
      mono: "IBM Plex Mono",
      headlineWeight: 900,
      bodyWeight: 700
    },
    frameRules: [
      "Use layered gradients to create depth",
      "Keep metrics and features in luminous panels",
      "Let color shifts mark transitions"
    ],
    motionRules: [
      "Use glow pulses and gradient sweeps",
      "Use parallax depth between foreground and back panels",
      "Use quick reveal timing for financial energy"
    ],
    qualityRules: [
      "Dark backgrounds preserve contrast for all text",
      "Highlights stay legible inside gradient fields",
      "Panels retain clear boundaries"
    ],
    bestFor: ["fintech story", "pricing narrative", "metrics launch"],
    templateBias: ["data-pulse", "rank-race", "split-compare"],
    styleTags: ["gradient", "finance", "dark", "premium"]
  },
  {
    slug: "od-apple-product",
    designDocPath: "design-systems/od-apple-product/DESIGN.md",
    id: "open-design.od-apple-product.frame-md",
    name: "Apple Product",
    source: "open-design",
    themeId: "od-apple-product",
    stylePrompt: "Polished product showcase with neutral surfaces, soft shadows, precise typography and premium industrial restraint.",
    palette: {
      background: "#F5F5F7",
      surface: "#FFFFFF",
      ink: "#1D1D1F",
      muted: "#6E6E73",
      accents: ["#0071E3", "#A1A1AA", "#111827", "#C7CBD1", "#F5F5F7"]
    },
    typography: {
      display: "Inter Display",
      body: "Inter",
      mono: "IBM Plex Mono",
      headlineWeight: 900,
      bodyWeight: 650
    },
    frameRules: [
      "Center the product and keep the frame restrained",
      "Use soft shadows and fine spacing cues",
      "Make material surfaces feel tactile and premium"
    ],
    motionRules: [
      "Use smooth product reveal motion",
      "Use measured scale and crossfade timing",
      "Use subtle camera drift to keep focus on the device"
    ],
    qualityRules: [
      "Product silhouette stays dominant",
      "Typography stays precise and calm",
      "Decorative effects remain subordinate to the product"
    ],
    bestFor: ["product hero", "device showcase", "premium launch"],
    templateBias: ["product-workspace", "split-compare", "creator-desk"],
    styleTags: ["premium", "product", "neutral", "refined"]
  },
  {
    slug: "od-editorial-paper",
    designDocPath: "design-systems/od-editorial-paper/DESIGN.md",
    id: "open-design.od-editorial-paper.frame-md",
    name: "Editorial Paper",
    source: "open-design",
    themeId: "od-editorial-paper",
    stylePrompt: "Printed magazine mood with paper texture, serif headlines, ink-led hierarchy and restrained editorial pacing.",
    palette: {
      background: "#F6F0E2",
      surface: "#FFF9F0",
      ink: "#17131A",
      muted: "#6F6258",
      accents: ["#B45309", "#1E3A8A", "#9F1239", "#E5B65D", "#D6D3D1"]
    },
    typography: {
      display: "Noto Serif CJK SC",
      body: "Inter",
      mono: "IBM Plex Mono",
      headlineWeight: 900,
      bodyWeight: 700
    },
    frameRules: [
      "Use print-like margins and columns",
      "Keep headlines and pull quotes as the strongest signals",
      "Treat texture as atmosphere and not as noise"
    ],
    motionRules: [
      "Use page-turn and paper-slide motion cues",
      "Use soft reveals for text and evidence blocks",
      "Reserve stronger motion for key facts"
    ],
    qualityRules: [
      "Headline rhythm stays balanced across lines",
      "Paper texture stays subtle enough for reading",
      "Evidence blocks use clean labels"
    ],
    bestFor: ["editorial essay", "product analysis", "thought leadership"],
    templateBias: ["news-evidence-wall", "split-compare", "timeline-rail"],
    styleTags: ["editorial", "paper", "serif", "print"]
  },
  {
    slug: "od-cyber-signal",
    designDocPath: "design-systems/od-cyber-signal/DESIGN.md",
    id: "open-design.od-cyber-signal.frame-md",
    name: "Cyber Signal",
    source: "open-design",
    themeId: "od-cyber-signal",
    stylePrompt: "Dark telemetry canvas with neon signal lines, precise labels, luminous data panes and a technical pulse.",
    palette: {
      background: "#020817",
      surface: "#0F172A",
      ink: "#F8FAFC",
      muted: "#94A3B8",
      accents: ["#22D3EE", "#A78BFA", "#F97316", "#10B981", "#38BDF8"]
    },
    typography: {
      display: "Inter Display",
      body: "Inter",
      mono: "IBM Plex Mono",
      headlineWeight: 900,
      bodyWeight: 700
    },
    frameRules: [
      "Use signal lines, panels and telemetry labels",
      "Let data feel alive through sharp contrast",
      "Keep the interface crisp and technical"
    ],
    motionRules: [
      "Use scan, tick and orbit motions",
      "Use neon pulses for active data",
      "Use fast transitions for signal changes"
    ],
    qualityRules: [
      "Dark panels keep signal labels readable",
      "Data states stay explicit at every step",
      "Neon accents stay controlled and purposeful"
    ],
    bestFor: ["AI intelligence", "security story", "systems analysis"],
    templateBias: ["data-pulse", "workflow-orbit", "news-evidence-wall"],
    styleTags: ["cyber", "signal", "dark", "telemetry"]
  }
];

export const openDesignMotionSystems: OpenDesignMotionSystem[] = openDesignSystemSpecs.map((system) => ({
  ...system,
  origin
}));

export function openDesignSystemFor(candidate: "a" | "b" | "c" | undefined, seed: number): OpenDesignMotionSystem {
  if (candidate === "b") return systemBySlug(seed % 2 === 0 ? "od-cyber-signal" : "od-stripe-gradient");
  if (candidate === "c") return systemBySlug(seed % 2 === 0 ? "od-vercel-minimal" : "od-editorial-paper");
  return systemBySlug(seed % 3 === 0 ? "od-linear-saas" : seed % 3 === 1 ? "od-apple-product" : "od-stripe-gradient");
}

export function systemBySlug(slug: string): OpenDesignMotionSystem {
  return openDesignMotionSystems.find((system) => system.slug === slug) ?? openDesignMotionSystems[0]!;
}

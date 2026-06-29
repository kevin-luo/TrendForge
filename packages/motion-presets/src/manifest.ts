import type { MotionEngineAdapterSpec, MotionTemplateManifest, VisualType } from "@trendforge/motion-core";
import { motionPresets } from "./presets.js";

type PresetManifestMeta = {
  category: string;
  tags: string[];
  bestFor: string[];
  description: string;
  defaultDuration: number;
};

const supportedAspects = ["9:16", "16:9", "1:1", "4:5"] as const;

export const motionEngineAdapters: MotionEngineAdapterSpec[] = [
  {
    id: "motion-render",
    label: "TrendForge Motion Render",
    description: "MotionGraph to deterministic SVG/PNG frames, then FFmpeg MP4 export.",
    status: "ready",
    input: "motion-graph",
    outputFormats: ["mp4", "png-sequence"],
    localRender: true,
    requiresBrowser: false,
    deterministic: true,
    renderContract: "render(input, context)",
    bestFor: ["low-cost matrix videos", "caption-safe explainers", "trend ranking shorts", "local CI smoke renders"]
  },
  {
    id: "remotion",
    label: "Remotion",
    description: "React composition renderer for richer CSS, media and component-driven scenes.",
    status: "experimental",
    input: "react-composition",
    outputFormats: ["mp4", "webm", "png-sequence"],
    localRender: true,
    requiresBrowser: true,
    deterministic: true,
    renderContract: "render(input, context)",
    bestFor: ["interactive preview", "React component scenes", "media-rich explainers"]
  },
  {
    id: "hyperframes",
    label: "HyperFrames",
    description: "HTML/CSS/GSAP frame capture path for agent-authored animated documents.",
    status: "planned",
    input: "html-frame",
    outputFormats: ["mp4", "webm"],
    localRender: true,
    requiresBrowser: true,
    deterministic: true,
    renderContract: "render(input, context)",
    bestFor: ["agent-authored HTML scenes", "GSAP timelines", "template gallery experiments"]
  }
];

const presetManifestMeta: Record<VisualType, PresetManifestMeta> = {
  "rank-race": {
    category: "ranking",
    tags: ["榜单", "节奏", "AI 产品", "热榜", "竖屏"],
    bestFor: ["Product Hunt Top 5", "趋势榜单开场", "点击前 3 秒的结论先行"],
    description: "榜单赛道、排名条、扫光和真实产品名，用于高密度趋势开场。",
    defaultDuration: 4
  },
  "product-workspace": {
    category: "product-demo",
    tags: ["产品界面", "工作流", "鼠标", "功能拆解"],
    bestFor: ["工具产品亮点拆解", "SaaS 工作台演示", "AI 工具功能路径"],
    description: "程序化产品工作台镜头，用窗口层级和功能标签表达产品用法。",
    defaultDuration: 5
  },
  "news-evidence-wall": {
    category: "editorial",
    tags: ["证据墙", "新闻", "来源", "观点"],
    bestFor: ["新闻解读", "观点论证", "引用和来源结构化展示"],
    description: "证据卡片、来源标签和关联关系，适合事实密度高的解读视频。",
    defaultDuration: 5
  },
  "data-pulse": {
    category: "data-viz",
    tags: ["数据", "波形", "柱状", "节拍"],
    bestFor: ["增长趋势", "指标脉冲", "收藏价值型数据片段"],
    description: "节拍柱状、指标跳变和背景脉冲，增强数据片段的视觉奖励。",
    defaultDuration: 4
  },
  "timeline-rail": {
    category: "timeline",
    tags: ["时间线", "事件", "推进", "历史"],
    bestFor: ["事件复盘", "产品发展线", "历史科普"],
    description: "纵向时间线和事件卡，表达顺序、因果和阶段推进。",
    defaultDuration: 5
  },
  "workflow-orbit": {
    category: "workflow",
    tags: ["流程", "节点", "自动化", "矩阵"],
    bestFor: ["工作流解释", "自动化矩阵", "多步骤工具链"],
    description: "中心主题和环绕节点，表达流程、依赖和自动化路径。",
    defaultDuration: 5
  },
  "creator-desk": {
    category: "creator",
    tags: ["自媒体", "剪辑", "发布", "BGM"],
    bestFor: ["创作者工作台", "发布流程", "内容生产 SOP"],
    description: "手机预览、剪辑轨道和创作装备，用于自媒体生产链路镜头。",
    defaultDuration: 5
  },
  "split-compare": {
    category: "comparison",
    tags: ["对比", "左右分屏", "判断", "前后差异"],
    bestFor: ["方案 A/B 对比", "产品差异", "观点冲突"],
    description: "左右分屏和快速切换，适合表达差异、取舍和观点冲突。",
    defaultDuration: 4
  },
  "whiteboard-explain": {
    category: "explainer",
    tags: ["科普", "白板", "步骤", "概念"],
    bestFor: ["科普拆解", "概念解释", "教程步骤"],
    description: "白板步骤和概念卡片，用于低噪声解释型短视频。",
    defaultDuration: 5
  }
};

export const motionPresetManifests: MotionTemplateManifest[] = motionPresets.map((preset) => {
  const meta = presetManifestMeta[preset.visualType];
  return {
    specVersion: 1,
    id: `trendforge.${preset.visualType}`,
    name: preset.label,
    description: meta.description,
    category: meta.category,
    tags: meta.tags,
    bestFor: meta.bestFor,
    engine: "motion-render",
    visualType: preset.visualType,
    output: {
      formats: ["mp4", "png-sequence"],
      defaultFormat: "mp4",
      supportedAspects: [...supportedAspects],
      fps: { min: 24, max: 60, default: 30 },
      duration: { minSeconds: 2, maxSeconds: 8, defaultSeconds: meta.defaultDuration },
      alpha: false,
      audio: "optional"
    },
    inputs: {
      schema: visualSceneInputSchema(preset.visualType),
      required: ["ratio", "duration", "contentSlots", "motion", "style", "safeAreas"],
      examples: [
        {
          visualType: preset.visualType,
          contentSlots: {
            headline: "今日 AI 产品信号",
            chips: ["效率", "低成本", "自动化"],
            entities: ["VectorPilot", "ShipPulse", "PromptDesk"]
          }
        }
      ]
    },
    license: {
      spdx: "Apache-2.0",
      attributionRequired: false,
      redistributionAllowed: true,
      commercialUse: true,
      author: "TrendForge"
    },
    provenance: {
      upstreamProject: "TrendForge",
      notes: "Native MotionGraph preset manifest inspired by agent-readable video template galleries."
    },
    preview: {
      sampleFrames: ["cover", "midpoint", "outro"]
    },
    performance: {
      referenceFrames: 120,
      machine: "local workstation baseline"
    }
  };
});

export function manifestForVisualType(visualType: VisualType): MotionTemplateManifest {
  return motionPresetManifests.find((manifest) => manifest.visualType === visualType) ?? motionPresetManifests[0]!;
}

function visualSceneInputSchema(visualType: VisualType): Record<string, unknown> {
  return {
    type: "object",
    required: ["ratio", "duration", "contentSlots", "motion", "style", "safeAreas"],
    properties: {
      visualType: { const: visualType },
      ratio: { enum: [...supportedAspects] },
      duration: { type: "number", minimum: 2, maximum: 8 },
      contentSlots: {
        type: "object",
        properties: {
          headline: { type: "string" },
          chips: { type: "array", items: { type: "string" } },
          metrics: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                value: { type: "string" }
              }
            }
          },
          entities: { type: "array", items: { type: "string" } },
          quote: { type: "string" },
          sourceLabel: { type: "string" }
        }
      }
    }
  };
}

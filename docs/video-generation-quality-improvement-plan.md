# TrendForge 视频生成质量改进计划

> 日期：2026-06-11  
> 目标：解决首页生成视频的风格单一、画面质感弱、图片覆盖弱、动画表现弱、清晰度弱、文字压缩、字幕分割粗糙等问题。  
> 范围：`HomeStudio` 首页链路、`/promo/generate`、`/preview`、`/render`、`makeFilmHtml`、Chrome 逐帧渲染、FFmpeg 输出。

## 1. 当前判断

当前主链路已经收敛到 html-film + Chrome seek + FFmpeg：

```text
首页 prompt
-> /api/projects/:id/promo/generate
-> DeepSeek/Mock 生成脚本
-> scriptToStoryboard
-> script/storyboard.json + render/storyboard.json
-> storyboardToVisualSpecs
-> createMotionDesignProvider
-> applyMotionDesignPlan
-> makeFilmHtml
-> renderFrames(Chrome seek)
-> framesToVideo(FFmpeg)
-> final.mp4 / final.webm
```

这条链路已经具备 DeepSeek 内容生成、动态设计方案、逐帧截图和 FFmpeg 合成。当前质量问题集中在 **设计系统、模板系统、素材系统、动效系统、渲染规格、字幕系统** 六个层面。DeepSeek 已经给出设计信号，HTML 模板层表达力有限，导致最终画面接近同一套海报样式。

## 2. 参考路线

### 2.1 html-video 的成熟点

`nexu-io/html-video` 的路线是 agent 编排层：

```text
source material
-> agent loop
-> content-graph
-> per-frame HTML
-> Hyperframes adapter
-> headless Chromium + ffmpeg
-> MP4
```

可借鉴点：

| 能力 | 对 TrendForge 的价值 |
|---|---|
| content-graph | 把脚本、镜头、素材、模板选择整理成稳定 IR |
| template metadata | 每个模板有场景类型、输入 schema、输出规格、许可证、适用内容 |
| project studio | 支持逐帧编辑、模板切换、帧预览、导出 |
| engine adapter | 渲染器只消费标准 frame/composition contract |
| Hyperframes adapter | HTML/CSS/GSAP 渲染范式成熟，Chrome + FFmpeg 输出稳定 |

参考：html-video README 说明其 Hyperframes adapter 通过 Chromium + ffmpeg 渲染真实 MP4，并列出 content-graph、template metadata、multi-frame storyboard workflow 等研究方向。  
来源：[nexu-io/html-video](https://github.com/nexu-io/html-video)

### 2.2 HyperFrames 的成熟点

`heygen-com/hyperframes` 的路线是渲染层：

```text
HTML composition
-> data attributes 定义尺寸、时长、轨道
-> GSAP/CSS/Lottie/Three.js/WAAPI 接成 seekable animation
-> headless Chrome seek/capture
-> FFmpeg 编码
```

可借鉴点：

| 能力 | 对 TrendForge 的价值 |
|---|---|
| composition contract | 每个视频声明 width、height、duration、track |
| seekable animation | 动效可预览、可逐帧渲染、结果确定 |
| HTML-native | 继续保留当前 HTML 方案，减少技术迁移成本 |
| agent-friendly | DeepSeek 生成 frame spec，模板负责确定性渲染 |

参考：HyperFrames README 的 How It Works 说明视频由 HTML 定义，使用 timing/tracks data attributes，并支持 GSAP、CSS、Lottie、Three.js、Anime.js、WAAPI 或自定义 frame adapter。  
来源：[heygen-com/hyperframes](https://github.com/heygen-com/hyperframes)

### 2.3 open-design 的成熟点

`nexu-io/open-design` 的路线是设计系统层：

```text
DESIGN.md
-> skills/templates
-> agent reads brand contract
-> HTML / artifact / HyperFrames / MP4
```

可借鉴点：

| 能力 | 对 TrendForge 的价值 |
|---|---|
| DESIGN.md | 主题从少量变量升级成品牌合约 |
| 9-section schema | 色彩、字体、间距、布局、组件、动效、语气、品牌、反模式都有约束 |
| design systems catalog | 多主题、多品牌、多风格可选 |
| artifact-first loop | 预览、批评、修正、导出形成闭环 |
| HyperFrames integration | 设计系统和视频渲染可连成一条链路 |

参考：open-design README 说明其提供大量 DESIGN.md design systems，产出 HTML/PDF/PPTX/MP4，并把 HyperFrames 作为视频与动效图形的一等能力。  
来源：[nexu-io/open-design](https://github.com/nexu-io/open-design)

## 3. 当前问题与代码原因

### 3.1 输出风格单一

| 现象 | 当前原因 | 证据 |
|---|---|---|
| 多个视频像同一套皮肤换文案 | `makeFilmHtml` 只有少量版式函数：`L_imageHero`、`L_rank`、`L_split`、`L_text` | `packages/motion-render/src/html-film.ts` |
| 有图场景全部优先走 image hero | `rScene` 中 `if(img) return L_imageHero(...)`，DeepSeek 的 `visualType` 在有图时被覆盖 | `packages/motion-render/src/html-film.ts:98-101` |
| 预览风格和导出风格有差异 | `/preview` 使用 `createLocalMotionDesignPlan`，`/render` 使用 `createMotionDesignProvider` | `apps/server/src/index.ts:741-760`、`apps/server/src/index.ts:605-638` |
| DeepSeek 选了模板 id，HTML 层没有 template registry | `templateId` 存在于 design plan，但 `makeFilmHtml` 用 `visualType` 和图片优先级做分支 | `packages/llm/src/motion-design.ts:247-270`、`packages/motion-render/src/html-film.ts` |

改进方向：建立 template registry，让 DeepSeek 选择的 `templateId` 直接映射到不同 HTML 模板。

### 3.2 画面质感弱

| 现象 | 当前原因 | 证据 |
|---|---|---|
| 构图像工程占位稿 | 主题只有 palette/font，缺少布局规则、组件规则、动效规则、禁用规则 | `paletteFromSystem` 只消费 `palette` 和 `typography` |
| 模板缺少品牌级设计约束 | 主题系统没有 DESIGN.md 文件目录和设计审查规则 | 当前 `packages/motion-render/src/html-film.ts` 内联样式 |
| 缺少模板质量验收 | 当前导出产物缺少 frame lint、文字溢出检测、视觉多样性报告 | `packages/render-lint` 已存在能力，首页 html-film 链路尚未接入报告 |

改进方向：引入 `design-systems/<id>/DESIGN.md` 和 `video-templates/<id>/template.yaml`，用设计系统约束每个模板。

### 3.3 图片覆盖弱

| 现象 | 当前原因 | 证据 |
|---|---|---|
| 手动 prompt 场景经常缺真实图片 | 首页默认 `source: "manual"`，缺少产品 URL、截图、logo、素材搜索输入 | `apps/web/src/App.tsx:683-697` |
| 场景配图是 best-effort | `fetchSceneImages` 调用 pollinations.ai，失败后保留文字场景 | `apps/server/src/index.ts:1151-1181` |
| 图片清晰度有限 | 生成图尺寸是 768x1024，竖屏成片是 1080x1920 | `generateImage` URL 参数 |
| 图片角色表达弱 | spec 只有 `image` 与 product screenshot/thumbnail，缺少 hero、background、cutout、logo、texture、diagram 等角色 | `sceneImg` 和 `contentSlots.product` |

改进方向：建立 `AssetPlan`，支持网页截图、产品 logo、封面图、生成图、背景纹理、插画、图表素材，并按模板角色注入。

### 3.4 动画效果弱

| 现象 | 当前原因 | 证据 |
|---|---|---|
| 画面只有轻微位移和淡入 | `renderFrame` 全局对 scene 做 `translateY + scale`，元素做 opacity/translateY | `packages/motion-render/src/html-film.ts:185-209` |
| DeepSeek 的 `motionSignature` 没有落到模板动画 | design plan 产出 `motionSignature`，模板层只使用 data-d stagger | `packages/llm/src/motion-design.ts:247-270` |
| 缺少 per-template timeline | 当前所有模板共享一段 JS renderFrame | `packages/motion-render/src/html-film.ts` |

改进方向：升级为 HyperFrames-style timeline，每个模板声明 enter、hold、exit、camera、caption punch、media reveal。

### 3.5 视频模糊

| 现象 | 当前原因 | 证据 |
|---|---|---|
| 成片文字和图片清晰度弱 | Chrome viewport 使用导出尺寸，`deviceScaleFactor: 1` | `apps/renderer/src/html-renderer.ts:109-112` |
| HTML 画布固定 1080x1920 | `makeFilmHtml` meta/body 固定 1080x1920 | `packages/motion-render/src/html-film.ts` |
| 图片源分辨率偏低 | 生成图 768x1024 被放大到 1080x1920 | `apps/server/src/index.ts:1151-1181` |
| WebM 码率偏低 | VP9 使用固定 `2M` | `packages/ffmpeg/src/service.ts:239-253` |

改进方向：定义 render profile：`preview 540p`、`standard 1080p`、`high 2160p`。高质量导出使用 2x DPR 截图、4K 画布、按格式调 CRF/bitrate。

### 3.6 文字显示被压缩

| 现象 | 当前原因 | 证据 |
|---|---|---|
| 标题太长会挤压画面 | `.hl` 固定 `82px * typographyScale`，缺少 text-fit 和行数控制 | `packages/motion-render/src/html-film.ts:156` |
| 正文占位抢空间 | `para`、chips、字幕安全区都在同一画布抢空间 | `packages/motion-render/src/html-film.ts` |
| 模板缺少文本容量 schema | DeepSeek 只知道 headline/chips/body，模板没有声明每个槽位的字数上限 | 当前缺少 template manifest |

改进方向：每个模板声明 `maxHeadlineChars`、`maxLines`、`fontScaleRange`、`safeAreas`，渲染前运行 text-fit。

### 3.7 字幕分割截断粗糙

| 现象 | 当前原因 | 证据 |
|---|---|---|
| 断句机械 | `splitCaption` 按标点和 18 字硬切 | `packages/motion-render/src/html-film.ts:105-116` |
| 时长分配粗糙 | cue 时长按字符数比例分配 | `packages/motion-render/src/html-film.ts:130-139` |
| 字幕和 TTS 对齐弱 | 字幕来自场景文本，TTS 时长只用于拉伸总片长 | `apps/server/src/index.ts:624-630` |

改进方向：建立 `CaptionPlan`，支持中文分词、语义短句、最大阅读速度、最短停留时长、TTS 对齐、关键词高亮。

## 4. 目标架构

### 4.1 三层架构

```text
内容层：DeepSeek ContentGraph
  - scene goal
  - story beat
  - copy
  - data points
  - asset needs
  - template intent

设计层：Design System + Template Manifest + FrameSpec
  - DESIGN.md tokens
  - template.yaml input schema
  - layout slots
  - safe areas
  - motion signature
  - text capacity

渲染层：HyperFrames-style HTML Composition
  - data composition size / duration / tracks
  - seekable timeline
  - Chrome high-res capture
  - FFmpeg encode profile
```

### 4.2 新数据流

```text
prompt / source
-> DeepSeek ContentGraph
-> AssetPlan
-> DesignSystem selection
-> TemplatePlan per scene
-> FrameSpec[]
-> HTML composition
-> frame lint
-> Chrome capture
-> FFmpeg encode
-> quality report + final video
```

### 4.3 核心 contract

```ts
type FrameSpec = {
  id: string;
  sceneId: string;
  duration: number;
  ratio: "9:16" | "16:9" | "1:1" | "4:5";
  templateId: string;
  designSystemId: string;
  slots: {
    headline?: string;
    subhead?: string;
    body?: string;
    bullets?: string[];
    metrics?: Array<{ label: string; value: string }>;
    caption?: CaptionPlan;
    assets?: AssetSlot[];
  };
  motion: {
    signature: string;
    enter: string;
    hold: string;
    exit: string;
    camera: string;
    beatMarkers: number[];
  };
  constraints: {
    safeAreas: Record<string, { x: number; y: number; width: number; height: number }>;
    maxHeadlineLines: number;
    maxBodyLines: number;
    minFontSize: number;
    maxFontSize: number;
  };
};
```

## 5. 分阶段计划

### P0 诊断与可视化验收

目标：每次导出都能解释“DeepSeek 产出了什么，模板消费了什么，最终帧长什么样”。

任务：

1. `/render` 保存 `design-plan.json`、`frame-specs.json`、`asset-plan.json`、`quality-report.json`。
2. 导出关键帧截图：每个 scene 取 0%、50%、90% 三帧。
3. 质量报告增加：模板分布、主题分布、图片覆盖率、动画签名分布、文字溢出、字幕阅读速度。
4. 首页历史项目显示关键帧和质量摘要。

验收：

| 指标 | 目标 |
|---|---|
| 模板分布 | 单条视频至少 3 种模板 |
| 图片覆盖率 | 产品/宣传类视频主要场景达到 80% |
| 文字溢出 | 0 个标题溢出 |
| 关键帧报告 | 每个场景至少 3 张截图 |

### P1 模板系统升级

目标：把 `makeFilmHtml` 从单文件分支升级成模板 registry。

任务：

1. 新增 `packages/video-templates`。
2. 每个模板一个目录：`template.yaml`、`render.ts`、`style.css`、`motion.ts`。
3. 首批模板：
   - `promo.hero-product`
   - `promo.feature-stack`
   - `promo.problem-solution`
   - `promo.social-proof`
   - `promo.pricing-card`
   - `data.metric-pulse`
   - `data.rank-race`
   - `editorial.quote-card`
   - `editorial.split-compare`
   - `outro.logo-cta`
4. `MotionDesignPlan.templateId` 直接路由到模板 renderer。
5. 有图场景按模板规则消费图片，图片存在时仍保留模板多样性。

验收：

| 指标 | 目标 |
|---|---|
| 模板数量 | 首批 10 个 |
| templateId 生效 | DeepSeek 选择的模板在 HTML 中可追踪 |
| 有图场景多样性 | 图片场景至少覆盖 hero、split、card、background 四类构图 |

### P2 open-design 风格主题系统

目标：建立本项目自己的 DESIGN.md 主题目录。

任务：

1. 新增 `design-systems/<theme>/DESIGN.md`。
2. 采用 9 段结构：palette、typography、spacing、layout、components、motion、voice、brand、anti-patterns。
3. 首批主题：
   - `od-linear-saas`
   - `od-vercel-minimal`
   - `od-stripe-gradient`
   - `od-apple-product`
   - `od-editorial-paper`
   - `od-cyber-signal`
4. DeepSeek prompt 输入主题摘要和模板 manifest。
5. 渲染层把 DESIGN.md 编译为 `MotionFrameDesignSystem`。

验收：

| 指标 | 目标 |
|---|---|
| 主题数量 | 首批 6 套 |
| 主题切换 | 同一 storyboard 切主题后构图、字体、色彩、动效风格明显变化 |
| 主题审查 | 每个主题有 anti-patterns，并参与 lint |

### P3 素材系统升级

目标：让每个场景都有适配模板的视觉素材。

任务：

1. 新增 `AssetPlan`：
   - `hero`
   - `background`
   - `logo`
   - `screenshot`
   - `illustration`
   - `texture`
   - `diagram`
2. 手动 prompt 支持 URL 提取，自动网页截图。
3. 图片生成升级到可配置 provider，支持高分辨率。
4. 图片缓存写入 `storage/<project>/assets`，记录来源和授权。
5. 模板按 `imageRole` 选择素材。

验收：

| 指标 | 目标 |
|---|---|
| 图片覆盖率 | 主要场景 80% |
| 源图分辨率 | 竖屏 hero 图长边至少 1920 |
| 素材角色 | 每条视频至少使用 3 种 asset role |

### P4 HyperFrames-style 动效层

目标：让每个模板有独立 seekable timeline。

任务：

1. HTML composition 增加 `data-composition-id`、`data-width`、`data-height`、`data-duration`、`data-track-index`。
2. 模板 renderer 输出 `timeline(frame)`。
3. 支持 `motionSignature`：
   - `snap-stagger`
   - `poster-pop`
   - `kinetic-slam`
   - `soft-reveal`
   - `data-tick`
   - `orbit-sweep`
   - `parallax-depth`
   - `mask-reveal`
4. Caption punch 支持关键词高亮、逐词/逐短句入场。
5. 保持 `window.seek(frame)` 作为统一渲染入口。

验收：

| 指标 | 目标 |
|---|---|
| 动效签名 | 单条视频至少 3 种 |
| 关键帧差异 | 同一场景 0/50/90% 关键帧有可见变化 |
| 渲染确定性 | 同一输入两次导出关键帧像素差异在阈值内 |

### P5 高清渲染 profile

目标：解决模糊和压缩感。

任务：

1. 定义 render profiles：
   - `preview`: 540x960 / 30fps / iframe
   - `standard`: 1080x1920 / 30fps / CRF 18
   - `high`: 2160x3840 / 30fps / CRF 16
2. `makeFilmHtml` 接收 width/height，移除固定 1080x1920。
3. `renderFrames` 支持 `deviceScaleFactor`。
4. FFmpeg profile 支持 CRF、preset、bitrate、pix_fmt 配置。
5. 图片源按目标 profile 选择尺寸。

验收：

| 指标 | 目标 |
|---|---|
| 1080p 文字清晰度 | 关键帧文本边缘锐利 |
| high profile | 可输出 2160x3840 |
| 文件体积 | 30s 1080p MP4 控制在合理区间 |

### P6 智能文字排版

目标：标题、正文、chips、字幕都在安全区域内自然展示。

任务：

1. 模板 manifest 声明文本容量。
2. 渲染前执行 text-fit：测量 DOM，高度超限时降字号、换模板或压缩文案。
3. 标题做中文行平衡，避免单字孤行。
4. body/chips 按模板容量截取，并把完整文本留给字幕。
5. 质量报告记录被压缩字段。

验收：

| 指标 | 目标 |
|---|---|
| 标题溢出 | 0 |
| 字体下限 | 标题不低于模板声明下限 |
| 孤行 | 中文标题孤行率显著降低 |

### P7 字幕系统升级

目标：字幕分割符合阅读节奏和语义。

任务：

1. 新增 `CaptionPlan`。
2. 中文按标点、连接词、数字单位、关键词做短句切分。
3. 约束阅读速度：中文 8-12 字/秒，英文 14-18 chars/秒。
4. 最短停留 0.9s，最长停留 3.2s。
5. TTS 存在时按音频时长和句子权重对齐。
6. 支持关键词高亮和安全区检测。

验收：

| 指标 | 目标 |
|---|---|
| 字幕单行长度 | 中文 12-16 字为主 |
| 停留时长 | 0.9s-3.2s |
| 字幕溢出 | 0 |
| 语义断句 | 数字、品牌名、固定短语保持完整 |

## 6. 优先级

| 优先级 | 阶段 | 理由 |
|---|---|---|
| 1 | P0 诊断与可视化验收 | 先把问题量化，后续优化有证据 |
| 2 | P1 模板系统升级 | 直接解决风格单一和画面质感 |
| 3 | P2 DESIGN.md 主题系统 | 建立 open-design 式设计支撑 |
| 4 | P5 高清渲染 profile | 直接改善模糊问题 |
| 5 | P7 字幕系统升级 | 直接改善观看体验 |
| 6 | P3 素材系统升级 | 支撑图文并茂和真实产品视频 |
| 7 | P4 动效层 | 提升专业感和节奏 |
| 8 | P6 智能文字排版 | 作为模板系统的质量闭环 |

建议实际执行顺序：

```text
P0 -> P1 -> P2 -> P5 -> P7 -> P3 -> P4 -> P6
```

## 7. 本轮关键决策

1. TrendForge 保持 HTML + Chrome + FFmpeg 主路线。
2. 技术重点从“接通渲染”转为“模板、主题、素材、动效、清晰度、字幕质量”。
3. DeepSeek 的职责升级为 content-graph + template plan + asset plan + caption plan。
4. `makeFilmHtml` 升级为 composition renderer，模板由 registry 管理。
5. 设计成熟度用 DESIGN.md 主题目录补齐，参考 open-design 的文件化设计系统思想。

## 8. 本轮执行进度

执行日期：2026-06-11

已落地：

| 阶段 | 当前结果 | 验证 |
|---|---|---|
| P0 诊断摘要 | `/render` 写入 `qualitySummary` 和 `sceneSpecs`，记录模板分布、视觉类型分布、图片覆盖率、场景时长 | `render-data.json` 已包含质量摘要字段 |
| P1 模板 registry | `makeFilmHtml` 已按 `templateId` / `visualType` 路由到 `image-hero`、`feature-stack`、`metric-rank`、`split-compare`、`outro-cta` | `pnpm --filter @trendforge/motion-render test` 通过 |
| P5 高清渲染最小闭环 | `makeFilmHtml` 支持动态 `width/height`，`renderFrames` 支持 `deviceScaleFactor`，`/render` 对 DPR 做 `1..2` 规范化 | `pnpm --filter @trendforge/renderer typecheck` 通过 |
| P7 字幕分割最小闭环 | `splitCaption` 支持中文/英文标点、空格、连接词、数字单位、品牌名保护 | `pnpm --filter @trendforge/motion-render test` 通过，12 个测试全绿 |
| P4 动效最小闭环 | `html-film` 已增加 `data-anim`、纹理层、`motionCache`、`motionTransform`，五类模板具备不同 seekable 动效语言 | `pnpm --filter @trendforge/motion-render test` 通过，13 个测试全绿 |
| 类型验证恢复 | `DeepSeekSearchConnector` 补齐 connector contract，`motion-presets` 的 `productCardLayers` 统一使用 `width/height` | `pnpm --filter @trendforge/server typecheck` 通过 |
| P3 素材系统最小闭环 | `VisualSceneSpec.contentSlots.assets` 已支持角色化素材，director 生成 `AssetSlot`，html-film 按角色选图，render-data 写入素材角色/来源统计 | `motion-core`、`motion-director`、`motion-render` 测试通过，`server typecheck` 通过 |
| P6 智能文字排版最小闭环 | `html-film` 已为 headline/body/card/rank 文本增加 `data-fit` 容量标记、CSS 行数约束和 deterministic `fitTextBlocks()` 字号收缩 | `pnpm --filter @trendforge/motion-render test` 通过，14 个测试全绿 |
| P2 DESIGN.md 主题目录最小闭环 | 新增 6 套 `design-systems/<theme>/DESIGN.md`，`openDesignMotionSystems` 通过 `designDocPath` 可追踪到文件化设计合约 | `pnpm --filter @trendforge/motion-presets test` 通过 |
| text-fit 质量报告 | `renderFrames` 可采样 `[data-fit]` DOM 状态，`/render` 写出 `quality-report.json` 和 `render-data.json.textFitSummary`，统计压缩文本数量、角色、场景、模板 | `renderer test/typecheck`、`server typecheck`、`motion-render test` 通过 |
| 首页手动 prompt 图片链路 | `source=manual` 且配置 `DEEPSEEK_API_KEY` 时，服务端先用 DeepSeek 搜索结果提取图片 URL 并下载到 `storage/projects/<id>/assets/web`；`IMAGE_PROVIDER=pollinations` 时启用外部图片生成；所有远端路径失败后写入本地 SVG 视觉卡片 | `pnpm --filter @trendforge/server test`、`server typecheck`、`motion-director test`、`motion-render test` 通过 |
| 首页 UX 修正 | HomeStudio 手动生成每次创建新项目，避免持续覆盖旧项目 exports；导出完成后在首页展示 final.mp4 路径、打开文件夹和 HTTP 下载入口；系统状态优先展示 `html-film-renderer` | `pnpm --filter @trendforge/web typecheck` 通过 |
| 导出下载端点 | 新增 `GET /api/projects/:id/export/video`，读取项目 `final_video_path` 并以 attachment 返回 mp4/webm；首页下载按钮使用该 HTTP 地址 | `pnpm --filter @trendforge/server typecheck`、`server test`、`web typecheck` 通过 |
| 首页极简极客版 UI | HomeStudio 收敛为单输入、单主按钮、预览 utility row、terminal-style 输出行；移除首页“编辑文案”和重复“渲染成片”入口；预览舞台增加暗色网格、冷色 glow 和 scanline 层次 | `pnpm --filter @trendforge/web typecheck` 通过 |
| FFmpeg 高质量导出 profile | `ExportSettings` 支持 `renderProfile` / `qualityProfile`；`framesToVideo` 支持 `standard` / `high` encode profile；`/render` 自动按高 DPR/高分辨率选择 high，并写入 `render-data.json` 与 `quality-report.json` | `pnpm --filter @trendforge/ffmpeg test`、`ffmpeg typecheck`、`server typecheck`、`renderer typecheck` 通过 |
| designDocPath 主题选择器与质量审查 | 前端统一拉取 `/api/motion/templates` registry；模板库展示 open-design 主题、`designDocPath`、origin、bestFor、styleTags；质量审查面板展示每个 DESIGN.md contract 的 `qualityRules` 摘要 | `pnpm --filter @trendforge/web typecheck`、`pnpm --filter @trendforge/server typecheck`、`pnpm --filter @trendforge/motion-presets test` 通过 |
| 导出表单 profile 选择 | ExportPanel 新增 `auto` / `standard` / `high` 质量 profile；`auto` 走服务端自动 profile，`standard` / `high` 通过 `renderProfile` 提交；首页快速渲染保持自动 profile | `pnpm --filter @trendforge/web typecheck` 通过 |
| 质量报告前端可视化 | 新增 `GET /api/projects/:id/render/quality` 只读摘要接口；ExportPanel 展示实际 `renderProfile` / `encodeProfile`、图片覆盖、模板分布、视觉分布、text-fit 压缩数量；404 时显示轻提示 | `pnpm --filter @trendforge/server typecheck`、`pnpm --filter @trendforge/web typecheck`、`pnpm --filter @trendforge/server test` 通过；本地请求返回 200 摘要 |
| promo 命名与 storyboard 文件名兼容迁移 | 新增 `POST /api/projects/:id/promo/generate` 作为首页主入口，`matrix/generate` 保留兼容；新产物双写 `script/storyboard.json` 与 `render/storyboard.json`，读取优先新文件再 fallback 旧 `storyboards.json` / `candidate-a.json` | `pnpm --filter @trendforge/server typecheck`、`pnpm --filter @trendforge/web typecheck`、`pnpm --filter @trendforge/server test` 通过 |
| 图片主视觉链路修复 | `fetchSceneImages` 将已有 `assetHints` 和 DeepSeek 搜索命中结果提升为 `scene.image`，同时保留 `assetHints`；fallback SVG 继续写 `scene.image`，让 storyboard、render spec、质量统计和 HTML 主视觉稳定消费图片 | `pnpm --filter @trendforge/server test` 通过，6 tests；`server typecheck`、`motion-director test`、`motion-render test` 通过 |

当前验证结果：

```text
pnpm --filter @trendforge/motion-core test        通过，2 files / 6 tests
pnpm --filter @trendforge/motion-director test    通过，1 file / 3 tests
pnpm --filter @trendforge/motion-render test      通过，2 files / 14 tests
pnpm --filter @trendforge/motion-presets test     通过，2 files / 4 tests
pnpm --filter @trendforge/llm test                通过，2 files / 4 tests
pnpm --filter @trendforge/renderer test           通过，1 file / 2 tests
pnpm --filter @trendforge/renderer typecheck      通过
pnpm --filter @trendforge/server test             通过，1 file / 5 tests
pnpm --filter @trendforge/server typecheck        通过
pnpm --filter @trendforge/web typecheck           通过
pnpm --filter @trendforge/ffmpeg test             通过，1 file / 2 tests
pnpm --filter @trendforge/ffmpeg typecheck        通过
GET /api/projects/:id/render/quality              通过，返回轻量质量摘要
pnpm --filter @trendforge/motion-director test    通过，1 file / 3 tests
pnpm --filter @trendforge/motion-render test      通过，2 files / 14 tests
新项目 project_cff9de1ff9c24ea79c promo/generate 通过，5/5 场景有 image，assets/web 生成 5 个本地视觉文件
新项目 project_cff9de1ff9c24ea79c render          通过，film.html 包含 <img>，imageCoverage=1，final.mp4=4,223,400 bytes，下载端点 200
pnpm --filter @trendforge/web typecheck           首页极简极客版重构后复跑通过
```

本轮已完成：

```text
首页新项目真实生成验收：图片覆盖、质量摘要、下载入口
首页整体重构二期：信息架构与首屏视觉重新设计
```

子任务状态：

| 子任务 | 状态 | 执行边界 |
|---|---|---|
| 首页新项目真实生成验收 | 已完成 | 使用 `project_cff9de1ff9c24ea79c` 跑通 prompt -> promo/generate -> render；`assets/web` 5 个 SVG fallback，`script/storyboard.json` 5/5 场景有 `image`，`render/film.html` 有 `<img>`，`render-data.json.qualitySummary.imageCoverage=1`，`exports/final.mp4` 生成，HTTP 下载端点 200 |
| 首页整体重构二期 | 已完成 | `apps/web/src/App.tsx`、`apps/web/src/styles.css` 已由 gpt-5.4-mini worker 重构；首屏调整为 prompt 控制台、live render stage、结果与质量动作区；顶部系统状态收敛；冷蓝/电紫终端风格；`pnpm --filter @trendforge/web typecheck` 通过 |

已达成目标：

1. 启动本地服务，使用首页新 prompt 创建新项目。
2. 验证 `script/storyboard.json` 至少 80% 场景有 `image`。
3. 验证 `assets/web` 有搜索图片或本地 SVG fallback。
4. 验证 `render/render-data.json.qualitySummary.imageCoverage` 大于 0。
5. 验证 `render/film.html` 包含 `<img>`，`exports/final.mp4` 生成，HTTP 下载端点返回 200。
6. 首页重构二期要从信息架构入手：去掉旧工作台感，建立独立 landing/studio 首屏、单一主流程、结果面板和质量面板的清晰分区。

验收备注：

- 本地 Codex 环境网络受限，带 DeepSeek Key 的真实 DeepSeek 请求会在脚本生成阶段 `fetch failed`。图片链路验收临时切到本地脚本和本地 motion provider，验证的是项目内部图片 fallback、storyboard、HTML-film 和 FFmpeg 导出链路。
- 用户线上正常接通 DeepSeek 后，manual source 的网络图片搜索仍走 `searchProducts -> imageUrl -> assets/web`；搜索失败时会落到本地 SVG fallback，保证画面里有主视觉。

# TrendForge 首页视频生成技术报告

> 日期：2026-06-11  
> 范围：首页“一句话生成宣传视频”入口、脚本/分镜生成、预览、正式导出、当前残留技术债  
> 参考文档：`docs/tech-correction-and-architecture.md`

## 1. 当前结论

首页当前已经收敛到一条主链路：

```
首页 prompt
  -> POST /api/projects/:id/promo/generate
  -> DeepSeek/Mock 脚本
  -> storyboard.json
  -> 场景配图
  -> iframe 预览(/preview)
  -> POST /api/projects/:id/render
  -> 动态设计方案
  -> makeFilmHtml
  -> Chrome seek 逐帧截图
  -> FFmpeg framesToVideo
  -> MP4/WebM
```

运行时视频生成主方案是 **html-film + Chrome 逐帧 seek + FFmpeg 合成**。Remotion 保留为历史兼容适配器，MotionGraph 渲染端点也已经从当前首页主流程中退出。旧报告里的 P0、P1、P2、P3、P4、P5 有多项已经落地：DeepSeek 动态设计接回导出、内容去重安全网、图文并茂、首页单入口、逐帧并行渲染。

## 2. 首页入口

当前首页组件是 `HomeStudio`，入口文案为 `Prompt to Promo`。用户输入 prompt 后，前端固定用 `source: "manual"`、`contentType: "auto"`、`platform: "douyin"`、所选 ratio 发起生成任务。首页交互已收敛为单输入、单主按钮、预览 utility row、terminal-style 输出结果行。

证据：

| 位置 | 作用 |
|---|---|
| `apps/web/src/App.tsx:650-800` | `HomeStudio` 定义首页 Prompt to Promo 流程 |
| `apps/web/src/App.tsx:690-707` | `handleGenerate` 组装 prompt/source/ratio/language |
| `apps/web/src/App.tsx:709-716` | `handlePrimaryAction` 在生成和渲染之间切换 |
| `apps/web/src/App.tsx:724-756` | 输入框、比例 chip、单主按钮 |
| `apps/web/src/App.tsx:759-762` | 预览 utility row：刷新预览、新窗口 |
| `apps/web/src/App.tsx:765-785` | terminal-style 输出结果行：final.mp4、下载、打开文件夹 |
| `apps/web/src/App.tsx:286-318` | 首页生成每次创建新项目并调用 `api.generatePromoVideo` |
| `apps/web/src/api.ts:48-70` | `generatePromoVideo` 调用 `POST /api/projects/:id/promo/generate` |
| `apps/web/src/api.ts:88-93` | `render` 调用 `POST /api/projects/:id/render` |
| `apps/web/src/api.ts:101` | `exportVideoUrl` 指向 HTTP 下载端点 |
| `apps/web/src/api.ts:102` | `previewUrl` 指向 `/api/projects/:id/preview` |

交互上已经是“生成 -> 预览 -> 导出 -> 下载”的短链路。高级编辑面板保留在工具区。

## 3. 生成阶段

后端 `POST /api/projects/:id/promo/generate` 承担首页生成任务，`POST /api/projects/:id/matrix/generate` 保留兼容转发。实际行为已经是单 storyboard 生成。

流程：

1. 读取 prompt、source、ratio、language。
2. `fetchMatrixItems` 从手动输入或连接器生成 `TrendItem`。
3. Product Hunt 来源额外采集产品素材。
4. `ContentAnalyzer` 提取内容角度。
5. `createScriptProvider(settings)` 选择脚本引擎：有 `DEEPSEEK_API_KEY` 时使用 DeepSeek，密钥缺省时使用 `MockScriptProvider`。
6. `enrichScriptWithItems` 把真实条目回填到脚本场景。
7. `scriptToStoryboard` 生成 `storyboard.json`，并同步写入 `script/storyboard.json` 与 `render/storyboard.json`。
8. `fetchSceneImages` 给每个场景补图：手动 prompt 优先用 DeepSeek 搜索结果里的图片 URL 下载到项目 assets，`IMAGE_PROVIDER=pollinations` 时启用外部图片生成，远端路径失败后写入本地 SVG 视觉卡片。
9. 同步保存 `script/storyboards.json`、`render/candidate-a.json`、字幕文件，兼容旧项目读取。

证据：

| 位置 | 作用 |
|---|---|
| `apps/server/src/index.ts:287-311` | `promo/generate` 与 `matrix/generate` 兼容端点、入参 |
| `apps/server/src/index.ts:319-329` | 读取数据源并保存 trend items |
| `apps/server/src/index.ts:343-350` | `ContentAnalyzer` 产出内容分析 |
| `apps/server/src/index.ts:357-366` | `createScriptProvider` 生成脚本 |
| `apps/server/src/index.ts:369-379` | `scriptToStoryboard`、配图、保存 storyboard.json、兼容文件、字幕 |
| `packages/llm/src/registry.ts:4-6` | DeepSeek/Mock 脚本 provider 选择 |
| `packages/llm/src/deepseek.ts:24-84` | DeepSeek 脚本请求、JSON 解析、schema 校验与宽松修复 |
| `apps/server/src/index.ts:createSceneImageProvider`、`apps/server/src/scene-images.ts` | DeepSeek 搜索图片 URL、本地缓存、可选外部图片生成、本地 SVG fallback |

生成阶段的关键改进是内容已经由脚本 provider 驱动，场景标题还有 `differentiateHeadlines` 兜底，能降低重复画面的概率。

## 4. 预览阶段

预览端点是 `GET /api/projects/:id/preview`。

当前策略：

1. 如果 `render/film.html` 已经存在，直接返回该 HTML。
2. 如果尚未导出，服务端从 storyboard 构建 specs。
3. 预览使用 `createLocalMotionDesignPlan`，保证 iframe 快速加载。
4. `applyMotionDesignPlan` 把主题令牌和每场景设计应用到 specs。
5. `makeFilmHtml` 输出可自动播放的 HTML。

证据：

| 位置 | 作用 |
|---|---|
| `apps/server/src/index.ts:741-747` | 已有 `film.html` 时直接返回 |
| `apps/server/src/index.ts:749-760` | storyboard -> specs -> local design plan -> makeFilmHtml |
| `packages/motion-render/src/html-film.ts:185-267` | `makeFilmHtml` 生成 HTML、场景帧窗口、字幕 cue、`window.seek(frame)` |

预览与导出共用 `makeFilmHtml` 模板。差异在于设计方案来源：预览用本地设计方案，导出用 `createMotionDesignProvider` 生成权威动态设计方案。

## 5. 导出阶段

正式导出端点是 `POST /api/projects/:id/render`。这是当前成片生成的核心路径。

流程：

1. 读取项目和 storyboard。
2. `storyboardToVisualSpecs` 生成基础视觉 specs。
3. `createMotionDesignProvider(await getSettings())` 生成动态设计方案。
4. `applyMotionDesignPlan` 应用 DeepSeek/Local 的 theme、visualType、layout、accent、typography 等令牌。
5. `inlineSceneImages` 把本地图片转为 data URI，保证预览和 file:// 渲染都能加载。
6. `makeFilmHtml` 写出 `render/film.html`。
7. `renderFrames` 用 Chrome 多 worker 逐帧调用 `window.seek(frame)` 并截图。
8. `FfmpegService.framesToVideo` 把 PNG 序列合成 MP4/WebM。
9. 存在 TTS 音频时走 `mergeAudioForExport`。
10. 更新项目 `final_video_path`。

证据：

| 位置 | 作用 |
|---|---|
| `apps/server/src/index.ts:585-597` | `/render` 端点、项目状态、ratio/fps/tts |
| `apps/server/src/index.ts:605-618` | storyboard、base specs、动态设计 provider |
| `apps/server/src/index.ts:622-638` | 应用设计方案、计算时长、写 `film.html` 和 `render-data.json` |
| `apps/server/src/index.ts:645-656` | `renderFrames` 逐帧渲染 |
| `apps/server/src/index.ts:658-666` | `framesToVideo` 合成视频 |
| `apps/server/src/index.ts:670-680` | TTS 音频混合与最终文件复制 |
| `apps/server/src/index.ts:682-684` | 写入导出状态和最终路径 |
| `apps/server/src/index.ts:1186-1217` | 图片内联为 data URI |
| `packages/ffmpeg/src/service.ts:239-253` | PNG 帧序列合成视频 |

## 6. 动态设计方案

动态设计 provider 目前有两层：

| Provider | 触发条件 | 职责 |
|---|---|---|
| `DeepSeekMotionDesignProvider` | 配置 `DEEPSEEK_API_KEY` | 产出主题、色板、字体、每场景 visualType/layout/accent/density 等创意选择 |
| `LocalMotionDesignProvider` | 密钥缺省 | 产出确定性的本地设计方案 |

DeepSeek 结果会叠加到完整本地 base 上，然后经过 schema 校验。这个设计解决了 LLM JSON 局部缺字段、枚举越界、范围越界导致的结构失败，同时保留 DeepSeek 的创意选择。

证据：

| 位置 | 作用 |
|---|---|
| `packages/llm/src/motion-design.ts:27-86` | DeepSeek 动态设计请求、解析、信号校验 |
| `packages/llm/src/motion-design.ts:124-199` | `coerceMotionDesignPlan` 合并 LLM 结果和本地 base |
| `packages/llm/src/motion-design.ts:201-203` | 动态设计 provider 选择 |
| `packages/motion-director/src/design-plan.ts:15-34` | 本地设计方案生成 |
| `packages/motion-director/src/design-plan.ts:36-53` | `applyMotionDesignPlan` 应用到 specs |

## 7. html-film 模板

`makeFilmHtml` 当前承担最终画面的 HTML 生成。

能力：

| 能力 | 当前实现 |
|---|---|
| 主题令牌 | `MotionFrameDesignSystem` -> palette/font/accent |
| 每场景差异化 | `accentIndex`、`typographyScale`、`visualType`、layout |
| 图文并茂 | 场景 image / 产品 screenshot / thumbnail 优先级渲染 |
| 版式 | image hero、rank list、split compare、editorial text |
| 字幕 | HTML 内按帧窗口显示 cue |
| 动画时钟 | `window.seek(frame)` 控制纯帧函数，RAF 用于浏览器自动播放 |

证据：

| 位置 | 作用 |
|---|---|
| `packages/motion-render/src/html-film.ts:19-35` | 设计系统转 palette |
| `packages/motion-render/src/html-film.ts:46-57` | 场景图片选择 |
| `packages/motion-render/src/html-film.ts:67-118` | image hero、rank、split、text 版式 |
| `packages/motion-render/src/html-film.ts:120-158` | 场景渲染与字幕拆分 |
| `packages/motion-render/src/html-film.ts:160-267` | HTML/CSS/JS 输出与 `window.seek(frame)` |

## 8. 渲染性能

`renderFrames` 已经从串行截图升级为多 worker 浏览器并行。默认并发数为 `min(cpu-1, 4, totalFrames)`，也可以通过 `RENDER_CONCURRENCY` 覆盖。

证据：

| 位置 | 作用 |
|---|---|
| `apps/renderer/src/html-renderer.ts:70-91` | 计算帧数、输出目录、Chrome 启动参数 |
| `apps/renderer/src/html-renderer.ts:96-107` | 并发池计算 |
| `apps/renderer/src/html-renderer.ts:109-127` | 每个 worker 准备页面、等待字体和图片、校验 `window.seek` |
| `apps/renderer/src/html-renderer.ts:130-163` | 每个 worker 按 lane 渲染帧并截图重试 |
| `apps/renderer/src/html-renderer.ts:166` | `Promise.all` 并行执行 |

这项已经覆盖旧报告的 P5 性能方向。

## 9. 当前残留与风险

| 项 | 当前状态 | 建议 |
|---|---|---|
| `promo/generate` 命名 | 首页主生成端点已经收敛到 promo 语义，`matrix/generate` 保留兼容入口 | 继续沿用 promo 作为首页主线命名 |
| `renderCandidates` 类型 | 前端和后端入参仍保留候选字段 | 清理类型和请求体字段 |
| `storyboard.json` | 单线流程同时写入 `script/storyboard.json` 与 `render/storyboard.json`，旧项目读取 `storyboards.json` / `candidate-a.json` | 继续保留兼容读取和旧文件写入 |
| `burnSubtitles` | 前端会传入，`/render` 主流程当前停留在 HTML 字幕显示和独立 burn API | 把 `body.burnSubtitles` 接入 `/render`，调用 ASS 字幕烧录 |
| 预览设计来源 | 预览使用本地设计方案，导出使用动态设计方案 | 导出前保存 designPlan，预览优先读取最近一次设计方案 |
| 场景配图 | 手动 prompt 已接入 DeepSeek 搜索图片 URL、本地缓存、可选 `IMAGE_PROVIDER=pollinations`、本地 SVG fallback | 继续增加图片授权记录、搜索结果质量评分和 Codex/plugin 生图 provider |
| 锁文件残留 | `pnpm-lock.yaml` 仍记录 `apps/renderer-remotion` 与 Remotion 包 | 运行一次干净安装/lockfile 更新，移除历史依赖记录 |
| 旧文档残留 | `docs/core-architecture.md`、`docs/motiongraph-architecture.md` 等仍描述历史路线 | 按本报告更新架构文档索引 |
| 系统状态优先级 | 首页 `visibleStatus` 已优先展示 `html-film-renderer`、`ffmpeg-export`、`deepseek-script-engine` | 继续在状态卡展示最近一次导出质量摘要 |

## 10. 下一步推荐

1. 把首页生成端点统一到 `promo/generate` 命名，保持 `matrix/generate` 兼容转发。
2. 把 storyboard 存储统一到 `script/storyboard.json` 与 `render/storyboard.json` 双写。
3. `/render` 接入 `burnSubtitles`，导出时按用户勾选生成烧录字幕版。
4. 预览读取最近一次 DeepSeek designPlan，让 iframe 和最终导出进一步一致。
5. 刷新 `pnpm-lock.yaml`，同步清理旧 Remotion 文档引用。

优先落地第 3 项和第 4 项，用户感知最直接：字幕导出符合按钮语义，预览和成片风格更稳定。

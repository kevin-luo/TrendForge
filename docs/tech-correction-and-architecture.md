# TrendForge 技术方案纠偏报告 & 目标架构

> 日期：2026-06-08
> 目的：停止"三套渲染器 + A/B/C 候选"的叠加混乱，把技术方案拉回到两个参考开源仓库
> （`nexu-io/html-video` + `nexu-io/open-design`）的"精华组合"上，给出一套**单一、可落地**
> 的目标架构与分阶段迁移计划。**本报告不含实现代码，仅做调研、诊断与架构定义。**

---

## 0. 一句话结论

当前系统**同时存在 3 套渲染引擎**（Remotion / MotionGraph-SVG / html-film），由**不同按钮**触发，
**DeepSeek 设计只接在没人用的那条链路上**，导出链路（html-film）则**丢掉设计、重复默认文案**。
这就是"想取两个开源仓库的精华、结果做成 2 不像、全是缺点"的根因。

**纠偏方向：只保留 html-film 一套渲染引擎，删除 Remotion 与候选 A/B/C，把 DeepSeek 重新定位为
"内容 + 设计"的生成器，把 open-design 的 DESIGN.md 主题令牌喂给模板，把 html-video 的
content-graph + 逐帧录制思路作为渲染契约。**

---

## 1. 现状诊断（带 file:line 证据）

### 1.1 三套渲染引擎，按钮各走各的

| 引擎 | 触发按钮 | 端点 | 实际渲染器 | 现状 |
|---|---|---|---|---|
| **Remotion** | 「生成矩阵视频」(`App.tsx:792`) | `POST /api/projects/:id/matrix/generate` (`index.ts:294`) | `renderMatrixStoryboards`→`renderMatrixVideo`（`product-video/src/pipeline.ts:6,74`，`@trendforge/renderer-remotion`） | **仍在跑**，失败才回退 ffmpeg。用户看到的"Remotion 渲染"来自这里 |
| **MotionGraph (SVG)** | 无 UI 直接入口 | `POST /api/projects/:id/motion/render` (`index.ts:459`) | `createMotionDirectorPlan`→`applyMotionDesignPlan`→SVG/sharp | **DeepSeek 设计只接在这条**，但 UI 不用它导出 |
| **html-film（逐帧）** | 「渲染视频/导出」(`App.tsx:1263`) | `POST /api/projects/:id/render` (`index.ts:692`) | `makeFilmHtml`→`renderFrames`→`framesToVideo`（2026-06-08 已改逐帧、消抖） | **真正的导出路径，但丢掉 DeepSeek 设计** |

> 核心矛盾：**用户点「生成矩阵视频」走 Remotion，点「导出包/渲染视频」才走 html-film 逐帧**。
> 两条链路产出物不一致、风格不一致、代码各一份——这是混乱的根。

### 1.2 "画面/文案一直重复"的根因（按确定性排序）

1. **【已确认】DeepSeek 设计在导出路径被丢弃**
   `index.ts:712` 导出路径直接 `storyboardToVisualSpecs(storyboard, { fps, candidate:"a" })`，
   **不传 designPlan**，随后 `makeFilmHtml(specs)`。而 DeepSeek 的 `MotionDesignPlan`
   （accentIndex / typographyScale / rotation / templateId / themeId / 每场景 design）只在
   MotionGraph 路径经 `createMotionDirectorPlan → applyMotionDesignPlan`（`motion-director/src/director.ts:20-29`、`design-plan.ts:39-55`）应用。
   → 导出视频每个场景的**版式/主题/强调色完全不随设计变化**，观感"千篇一律"。

2. **【已确认】内容来自确定性生成 + 硬编码默认样本，非 DeepSeek 差异化文案**
   `loadOrBuildStoryboard`（`index.ts:1001`）取 content-matrix `MatrixGenerator` 产物或
   `scriptToStoryboard(latestScript)`；风格样本在缺省时回落到**硬编码文案**
   （`index.ts:1054-1062` "先说结论，这个热点真正值得看的地方有三个…"）。
   若脚本生成没真正接 DeepSeek、或各场景 `contentSlots`（headline/chips/metrics）取自同一来源，
   则**多个场景文案高度雷同**，视觉上就是"同一画面重复"。

3. **【需进一步验证】specs 同质**
   `storyboardToVisualSpecs`（`motion-director/src/director.ts`）按 scene×shot 展开；当相邻
   scene 内容相同且无设计层差异化时，产出的 spec `contentSlots` 可能相同。这是上面 1、2 的结果，
   不是独立 bug。`makeFilmHtml` 本身每个 `.scene` div 内容是不同的（来自 `rScene`），
   **不是"只改 opacity 不改内容"**——所以"重复"是内容层问题，不是帧窗口 bug。

> 结论：**"重复"= 内容未差异化（DeepSeek 未真正驱动文案）+ 设计层在导出被丢弃**，
> 与逐帧渲染机制无关。逐帧/消抖已修好，但"喂进去的料"是重复的。

### 1.3 候选 A/B/C 的历史包袱

- `matrix/generate` 一次产 3 个候选 storyboard（`candidates.ts` / content-matrix），各自 Remotion 渲染、
  各自打包（`pipeline.ts:56-133`）。
- html-film 导出又**写死 candidate "a"**（`index.ts:712`）。
- 交接文档已记：矩阵卡片上的「渲染 A/B/C」按钮前端删了，但端点和数据结构都还在。
  → A/B/C 现在是**半拆未拆**状态，既增加复杂度又没被完整使用。

---

## 2. 两个参考仓库到底提供了什么（要提取的"精华"）

### 2.1 `nexu-io/html-video` —— 渲染契约（HTML→MP4 的"怎么渲"）

- **六段式管线**：取材 → Agent 循环（LLM 读素材+模板风格，产出 content-graph + 逐帧 HTML）→
  content-graph（多帧 IR：节点=帧、边=顺序，拓扑排序）→ 逐帧自包含动画 HTML →
  Hyperframes（headless Chromium **逐帧录制为 WebM**，按各帧自身 CSS 动画**自动延长时长**）→
  ffmpeg 编码（每段 WebM→MP4，拼接，可混音）。
- **关键理念**：
  - **content-graph 作为中间表示**：内容与渲染解耦，节点即帧、边即时序。
  - **每帧是"自包含的完整动画单元"**——Chromium 完整录制其动画，而非外部 scrub。
    （TrendForge 现在用 `seek(frame)` 逐帧 scrub，是等价可行的另一实现，**两者皆可，不要混用**。）
  - **可插拔渲染适配器**：Hyperframes 现役，Remotion/Motion-Canvas 只是"可选适配器"，
    换引擎只替换渲染段，storyboard 与 agent 循环不动。
  - **模板带 `template.html-video.yaml` 清单**：分类/标签/输出规格（分辨率/比例/FPS/时长）/
    **输入 schema（agent 要填的文本/数据槽位）**/许可证。

> **提取**：content-graph IR（= TrendForge 的 storyboard/specs 应承担的角色）、
> 逐帧 HTML、Chromium+ffmpeg 渲染、模板输入 schema 化。**不要提取 Remotion**——它在 html-video 里
> 也只是"未来可选适配器"，不是主力。

### 2.2 `nexu-io/open-design` —— 设计契约（"长什么样"）

- **设计系统 = `DESIGN.md`**（单一 Markdown，9 段式：色彩/字体/间距/布局/组件/动效/语气/品牌/反模式），
  150+ 套（Linear/Stripe/Vercel…）。放进 `design-systems/<brand>/` 即自动识别。
- **模板 = `SKILL.md`**（Claude Code skill 约定 + `od:` frontmatter 声明 mode=prototype/deck/image/video、
  scenario、默认绑定的设计系统）。
- **产物是单页 HTML**，渲染时**读取当前 DESIGN.md 把令牌直接内联进 HTML/CSS**——
  "换一套设计系统 → 下次渲染就用新令牌"。**无 JSON 主题系统**，令牌即 Markdown，可版本化。
- Agent-native：不自带模型，由 Claude Code/Cursor 等 CLI 作为"设计引擎"填充模板。

> **提取**：**令牌驱动**（DESIGN.md 风格的主题令牌目录）+ HTML 模板 + "渲染时读当前设计系统"。
> 这正是 TrendForge `makeFilmHtml` 缺的：现在只认 2 个主题、且**不消费** DeepSeek 设计令牌。

### 2.3 两仓库的组合点（本项目本应做成的样子）

```
open-design（设计令牌/主题/版式）  ┐
                                  ├─► DeepSeek(=agent) 读"素材+设计系统" ─► content-graph + 逐帧HTML
html-video（content-graph/逐帧渲染）┘                                         │
                                                                 Chromium 逐帧 + ffmpeg ─► MP4
```

DeepSeek 扮演 html-video 里的 **agent**：既产**差异化内容**（content-graph/storyboard），
又按 **open-design 的设计令牌**产/选**每帧版式**。当前实现把这两件事拆散又没接好。

---

## 3. 目标架构（单一管线）

### 3.1 设计原则

1. **一个渲染引擎**：只保留 html-film 逐帧（Chromium `seek(frame)` + `framesToVideo`）。
   **删除 Remotion**（`apps/renderer-remotion`、`@trendforge/renderer-remotion`、`pipeline.ts` 的调用），
   **归档 MotionGraph-SVG**（保留代码但不接 UI，或彻底移除）。
2. **一个数据中间表示**：storyboard（=content-graph）→ specs（每帧）。所有引擎概念收敛到这一条。
3. **DeepSeek 双职责且都落到导出路径**：
   - (a) **内容 agent**：从 trend items 产出**差异化** storyboard（每场景不同文案/数据）。
   - (b) **设计 agent**：产出 `MotionDesignPlan`（themeId + 每场景 design 令牌），
     **在导出路径**经 `applyMotionDesignPlan` 应用后再 `makeFilmHtml`。
4. **设计令牌目录**（open-design 风格）：把"2 个硬编码主题"扩成**令牌驱动主题表**，
   `makeFilmHtml` 消费 themeId + accent/typographyScale/rotation/templateId。
5. **删除候选 A/B/C**：一个项目 → 一个 storyboard → 一次渲染。用户要变体就重渲，不并行产 3 份。
6. **预览即导出**：preview 与 render 共用 `makeFilmHtml`（已统一）。

### 3.2 目标数据流

```
①来源采集            ②内容生成(DeepSeek)         ③设计生成(DeepSeek)      ④渲染              ⑤导出
trend items  ──►  storyboard(content-graph)  ──►  MotionDesignPlan   ──►  makeFilmHtml   ──►  final.mp4
(PH/HN/RSS/手动)   每场景差异化文案/数据          themeId+每场景令牌       applyDesignPlan        +字幕/封面/发布包
                                                                       renderFrames(seek)
                                                                       framesToVideo
```

与现状的差异（要改的连线）：
- `POST /render` 在 `storyboardToVisualSpecs` 前**插入** `createMotionDesignProvider().generate()`
  + `applyMotionDesignPlan()`（把 §1.2.1 丢弃的设计接回来）。
- `matrix/generate` 端点**降级/移除**；生成只产**单个** storyboard，不再 Remotion。
- `makeFilmHtml` **扩展为消费设计令牌**（主题表 + accent/type/rotation/template）。

### 3.3 模块职责（收敛后）

| 模块 | 职责 | 变化 |
|---|---|---|
| `content-matrix` / 脚本生成 | DeepSeek 产**差异化** storyboard | 确认真正接 DeepSeek；去重每场景文案 |
| `motion-director` | storyboard→specs + 应用设计令牌 | 导出路径也走 `createMotionDirectorPlan` |
| `llm/motion-design` | DeepSeek `MotionDesignPlan` | 接到导出路径；失败直接报错（不静默降级） |
| `motion-render/html-film` | specs+令牌→HTML(seek) | 扩展主题表、消费 design 令牌 |
| `renderer/html-renderer` | Chromium 逐帧 `seek` 截图 | 已修好；后续并行化 |
| `ffmpeg` | `framesToVideo` + 字幕/混音 | 删 `sceneImagesToVideo`(zoompan) |
| ~~`renderer-remotion`~~ | — | **删除** |
| ~~`motion-presets`(SVG)~~ | — | 归档（不接 UI） |

---

## 4. 首页交互重构（去候选、单线流程）

### 4.1 现状问题

- 「生成矩阵视频」语义=一次产 3 候选 + Remotion，与「导出」语义割裂。
- 用户心智里有两个"生成/渲染"按钮，产物却不同。
- 候选 A/B/C 卡片、矩阵导出等连线半残。

### 4.2 目标：单一线性工作流（5 步）

```
┌──────────────────────────────────────────────────────────────────────┐
│  TrendForge                                              [设置] [日志]  │
├────────────┬─────────────────────────────────────────────────────────┤
│ 步骤导航    │   主工作区（随步骤切换）                                  │
│ ① 选题来源  │                                                          │
│ ② 脚本(AI)  │   ┌─────────────────┐   ┌──────────────────────────┐    │
│ ③ 设计      │   │  实时预览(iframe) │   │  当前步骤的编辑/参数面板   │    │
│ ④ 预览      │   │  = makeFilmHtml   │   │                          │    │
│ ⑤ 导出      │   │  RAF 自动播放      │   │                          │    │
│            │   └─────────────────┘   └──────────────────────────┘    │
├────────────┴─────────────────────────────────────────────────────────┤
│  [上一步]                                        [下一步 / 生成视频]    │
└──────────────────────────────────────────────────────────────────────┘
```

- **① 选题来源**：PH/HN/RSS/手动（保留现有连接器）。
- **② 脚本(AI)**：DeepSeek 产**差异化** storyboard；可编辑每场景文案。**这一步必须真正调 DeepSeek**。
- **③ 设计**：选主题/模板（open-design 令牌表）；可让 DeepSeek 自动配色版式（`MotionDesignPlan`）。
- **④ 预览**：右侧 iframe = `/api/projects/:id/preview`（html-film，RAF 自动播放，**所见即所得**）。
- **⑤ 导出**：比例/FPS/格式/烧字幕 → `POST /render`（与预览同一模板）。

### 4.3 删除项

- 「生成矩阵视频」按钮、matrix candidate 卡片、A/B/C 选择、`renderMatrixCandidate`/`matrixExports` 等
  前端连线与后端端点（`matrix/generate`、`matrix/render-candidate`、`motion/render` UI 入口）。
- 保留单一「生成视频」CTA（贯穿②→⑤）。

---

## 5. 分阶段迁移计划（不破坏现有可用功能）

> 每阶段独立可验证；**渲染期间不要改 server 源码**（热重载杀进程，见交接文档 §2.2）。

- **P0 设计接回导出路径（修"重复/无设计"）**
  在 `/render` 内：`storyboard →（DeepSeek 内容已在）→ createMotionDesignProvider().generate()
  → applyMotionDesignPlan() → makeFilmHtml`。验证：导出视频各场景**主题/版式/强调色有差异**。
- **P1 内容差异化（修"默认文案重复"）**
  确认脚本/storyboard 真正由 DeepSeek 生成且**逐场景去重**；缺 Key 时**显式报错**而非回落硬编码样本。
- **P2 主题令牌化**
  `makeFilmHtml` 主题从 2 个硬编码扩为**令牌表**，消费 accentIndex/typographyScale/rotation/templateId
  （open-design DESIGN.md 风格）。
- **P3 删除 Remotion + 候选**
  移除 `apps/renderer-remotion`、`@trendforge/renderer-remotion`、`pipeline.ts` 的 Remotion 调用、
  `matrix/generate` 端点与 A/B/C 前端/后端连线。统一为单 storyboard 单渲染。
- **P4 UI 单线流程**
  按 §4.2 重排首页为 5 步线性工作流，预览=导出。
- **P5 渲染性能**
  `renderFrames` 串行截图 → 多页/多 worker 并行（参考 MotionGraph 并发池），缓解逐帧变慢。

---

## 6. 风险与开放问题

1. **逐帧 vs 录制**：html-video 用 Chromium **录制**（real-time→WebM），TrendForge 用 **seek scrub**。
   两者都行，但**不能混用**；seek 要求动画是 frame 的纯函数（已满足）。保持 seek 路线即可。
2. **DeepSeek 失败策略**：用户明确要"失败直接报错、不要静默降级"。P0/P1 必须遵守。
3. **字幕未烧录**：html-film 尚未烧内嵌字幕（交接文档缺口 #1），独立于本纠偏，需排期。
4. **性能**：逐帧 + 设计应用会更慢；P5 并行化前，长视频导出耗时需提示用户。
5. **令牌目录来源**：是否真的引入 open-design 的 DESIGN.md 文件，还是只借鉴其 9 段式令牌结构、
   在本仓内置一张主题表？建议**后者**（内置令牌表）以避免外部依赖与许可证问题。

---

## 6.5 实施进展 & 优化方案总结（2026-06-08/09）

> 目标：从"2 不像、效果差、无图文并茂、非 DeepSeek 驱动"拉回到一条
> **DeepSeek 全驱动 + 令牌化设计 + 图文并茂 + 单一逐帧渲染**的链路。

**已实施（含验证）**

| 项 | 内容 | 验证 |
|---|---|---|
| 逐帧消抖 | zoompan→seek 逐帧；preview==export | 连续帧 diff 平滑、无振荡 |
| P0 设计接回 | `/render`+`/preview` 生成并应用 `MotionDesignPlan`；`makeFilmHtml(designSystem)` 令牌化调色板 + 每场景 accentIndex/typographyScale | 关键帧场景按主题/强调色差异化 |
| 删除冗余 | 删 Remotion / 候选 A/B/C / MotionGraph-SVG 三套；单 storyboard 单渲染 | tsc 全清、无端点触发 |
| 首页重构 | 线性 5 步（来源→脚本→设计→预览→导出）+ 内嵌实时预览 iframe + 单 CTA | 截图验证 |
| **P1 设计校验** | DeepSeek 动态设计**结构校验失败**根治：`hasDesignSignal` 门 + `coerceMotionDesignPlan`（LLM 创意叠加到完整本地 base，枚举/范围归一），真失败仍报错不静默降级 | 单测：松散/越界/非法枚举 → schema 通过 |
| **P1 内容去重** | `storyboardToVisualSpecs` 末尾 `differentiateHeadlines` 安全网，保证每场景标题唯一 | 单测：3 同标题→3 唯一 |
| **图文并茂** | `makeFilmHtml` 重做版式：全屏铺满、背景幽灵数字+光晕（不再空白）、产品大图 hero（`screenshotPath/thumbnailPath` 服务端内联 data URI，预览/导出通用）、无图时渐变占位 | 关键帧：rank 填充、产品图/占位铺满 |
| **DeepSeek 内容驱动** | `matrix/generate` 改走 `createScriptProvider`（有 Key=DeepSeek，无=Mock）→ `enrichScriptWithItems` → `scriptToStoryboard`；items 携带本地图路径，产品场景保留真图 | 链路验证：7 场景标题全唯一、图片路径透传 |

**优化方案 / 后续路线（按优先级）**

1. **DeepSeek 直出 storyboard 视觉计划**：当前 LLM 出"脚本文案"，视觉版式仍由 director 规则映射。下一步让 DeepSeek 同时产出每场景 `visualType/layout/highlights/metrics/imageRole`（prompt 已含 metadata 字段），html-film 直接消费 → 真正"内容+设计"全 LLM。
2. **真实素材图入镜**：接入产品截图/网页快照/题图抓取（`ProductAssetCollector` 已下载本地图），并按 `imageRole` 放置（hero / 角标 / 背景）；无版权图时用占位。考虑服务端 sharp 压缩降低 data URI 体积。
3. **字幕烧录**：`makeFilmHtml` 加字幕安全区，把 cues 传入并逐帧高亮（缺口 #1）。
4. **逐帧并行**：`renderFrames` 单页串行 → 多页/worker 池（长视频提速）。
5. **主题包扩展**：把 open-design DESIGN.md 令牌做成多主题目录，DeepSeek 选主题。

---

## 7. 关键证据索引（file:line）

- Remotion 触发：`packages/product-video/src/pipeline.ts:6,74`；端点 `apps/server/src/index.ts:294,392`
- html-film 导出（丢设计）：`apps/server/src/index.ts:692,712`
- DeepSeek 设计仅在 MotionGraph：`apps/server/src/index.ts:459,468-480`；
  `packages/motion-director/src/director.ts:20-29`；`packages/motion-director/src/design-plan.ts:39-55`
- DeepSeek 设计 Provider：`packages/llm/src/motion-design.ts`
- 硬编码默认样本：`apps/server/src/index.ts:1054-1062`
- storyboard 来源：`apps/server/src/index.ts:1001-1024`
- 模板：`packages/motion-render/src/html-film.ts`（`makeFilmHtml`/`rScene`/`seek`）
- 逐帧渲染器：`apps/renderer/src/html-renderer.ts`（`renderFrames`/`renderScenePosters`）
- 参考仓库：`github.com/nexu-io/html-video`、`github.com/nexu-io/open-design`
```

# HTML-Film 渲染集成 — 交接文档

> 目的：把本次会话的研究、定位、改动和待办完整固化，避免接手时重新摸索。
> 日期：2026-06-06。涉及"渲染视频"按钮的崩溃修复、性能优化，以及把 DeepSeek 设计的
> `makeFilmHtml` HTML 模板正式接入渲染按钮。

---

## 0. TL;DR（接手先看这段）

> **2026-06-08 更新**：渲染从"静态海报 + ffmpeg zoompan"改为 **逐帧 seek 渲染**，
> 彻底消除了 zoompan 整数像素抖动导致的**画面晃动**；同时把**预览端点统一到 html-film**，
> 预览与导出现在是同一套 `makeFilmHtml` 模板（所见即所得）。详见第 7 节。

- **"渲染视频"按钮现在走 html-film 逐帧路线**：`POST /api/projects/:id/render` →
  `storyboard → specs → makeFilmHtml(specs) → Chrome 逐帧 window.seek(frame) 截图 → ffmpeg.framesToVideo 拼成 MP4 → 混音`。
- 这条链路依赖**本机 Chrome**（`apps/renderer` 的 `findChrome()`，已在本机命中
  `C:\Program Files\Google\Chrome\Application\chrome.exe`）。没有 Chrome 会抛
  `找不到 Chrome 可执行文件`。
- 已验证可跑通：测试项目 `project_36c00b9a7b7347de9c`，9:16，**31s 出片**，
  输出 `storage/projects/<id>/exports/final.mp4`，关键帧目视正常（paper-ink 模板、
  标题 + #1~#5 榜单）。
- **MotionGraph(SVG) 路线仍保留**在 `POST /api/projects/:id/motion/render`，但 UI 不再默认用它。

---

## 1. 渲染路线全景（关键背景，务必先理解）

代码里**同时存在三套渲染实现**，历史叠加，极易混淆：

| 路线 | 端点 / 入口 | 渲染器 | 模板 | 状态 |
|---|---|---|---|---|
| **MotionGraph (SVG)** | `POST /api/projects/:id/motion/render` | `renderStoryboardMotionFilm` → `renderMotionGraphSequence`（SVG→PNG via **sharp**） | `packages/motion-presets`（程序化矢量） | 能跑，已修复崩溃 + 并行优化 |
| **HTML-film（本次接入）** | `POST /api/projects/:id/render` | `renderScenePosters`（**puppeteer/Chrome** 每场景一张海报）→ `ffmpeg.sceneImagesToVideo` | `makeFilmHtml`（DeepSeek 设计，`packages/motion-render/src/html-film.ts`） | **已接入 UI 按钮，已验证** |
| **neo-signal（旧 html）** | 原来的 `/render` 用它 | 同 `renderScenePosters` | `renderNeoSignalHtml`（`packages/templates/src/neo-signal.ts`） | 被 html-film 取代；仅 `GET /api/projects/:id/render`（HTML 预览，index.ts ~840 行）还在用 |
| Remotion | `apps/renderer-remotion/`（未提交） | — | — | **不用**（用户明确） |

> 文件修改时间能区分作者：**今天 15:30 左右**改的 `html-film.ts` / `render-pw.ts` /
> `scripts/render-html-film.ts` 等是 **DeepSeek 设计的实验**，原本只有冒烟脚本能跑、**没接入系统**；
> **17:xx** 的改动是本次会话（Claude）做的修复与集成。

### UI 按钮 → 端点映射（`apps/web/src/api.ts`）
- **唯一渲染入口**：「导出」标签页的「渲染视频」按钮 → `api.render` → `POST /api/projects/:id/render`（html-film）。
- **已移除**：矩阵卡片上原来的「渲染 A/B/C / 打开包」按钮（`App.tsx`），连同 `onRenderCandidate`/
  `onOpenExportPackage`/`candidateExports`/`loadMatrixExports` 等前端连线，全部删除（统一为单入口）。
- `api.renderMatrixCandidate` / `api.matrixExports` 这两个 api 方法仍留在 `api.ts`，但**前端已不再调用**；
  后端 `/motion/render`、`/matrix/render-candidate` 端点也仍在，只是 UI 不再触发。
- **取舍**：单入口服务端写死渲染 candidate `"a"`（=主方案）。**目前 UI 无法单独渲染 B/C 方案**
  （用户明确选择"最干净"，接受此取舍）。如需恢复，可给 `/render` 加 `candidate` 参数 + UI 加方案选择。

---

## 2. 本次会话改了什么（按问题）

### 2.1 崩溃：`(intermediate value)... is not a function or its return value is not iterable`
- **根因**：`packages/motion-presets/src/presets.ts:209` 一个 IIFE 被 `...` 展开，
  但一个分支返回数组 `[]`、另一个分支返回**单个对象** `withKeyframes(...)`。展开非可迭代对象即报此错。
- **修复**：把对象分支包成数组 `return [withKeyframes(...)]`。
- 另修：同文件 466 行有字面量 `\n` 文本（不是真换行）导致 esbuild 语法错误 → 已改回真实换行。

### 2.2 "卡住 / 进度不动" 与渲染慢（MotionGraph 路线）
- **"卡住"真相**：编辑源码触发 `tsx watch` 热重载，把正在跑的渲染进程杀掉，新进程又因
  端口占用 `EADDRINUSE` 起不来 → 任务被孤立（DB still `running`，实际没人渲染）。
  **不是产品 bug**，是"渲染中改代码"导致。教训：**长渲染期间别改 server 源码**。
- **效率优化**（`packages/motion-render/src/sequence.ts` + `raster.ts`）：
  - 原来 1080 帧**串行** sharp 栅格化（~2 fps）。改为**有界并发 worker 池**
    （默认 `min(cores-2, 16)`，可用 `MOTION_RENDER_CONCURRENCY` 覆盖）→ ~12–15 fps，**约 5–6×**。
  - sharp 设 `concurrency(1)`（每图 1 线程），由 worker 池控制并行，避免线程过订阅。
  - 并发后**进度写库洪泛**导致 SQLite 超时 → 在 `apps/server/src/motion-render.ts` 把
    `onProgress` 节流为"整数百分比变化才写"（1080 次 → ~54 次）。

### 2.3 把 DeepSeek 的 `makeFilmHtml` 接入渲染按钮（本次主任务）
改动文件：
1. `packages/motion-render/src/html-film.ts`——让 scene 兼容 `renderScenePosters`：
   - scene 由 `display:none` 改为 `opacity:0`（`renderScenePosters` 靠逐个设 opacity 显示场景；
     `display:none` 会让它失效，渲染出全黑帧）。
   - 加 `html.poster-mode .su,.fi{animation:none!important;opacity:1!important;transform:none!important}`，
     保证截图时入场动画处于稳定终态（`renderScenePosters` 会给 `<html>` 加 `poster-mode` 类）。
   - `seek()` 由切 display 改为切 opacity，并 `window.seek=seek` 暴露给冒烟脚本。
2. `packages/motion-render/src/index.ts`——`export { makeFilmHtml }`。
3. `apps/server/src/index.ts`——`POST /api/projects/:id/render` 端点：
   - 从 `renderNeoSignalHtml(payload)` 换成 `makeFilmHtml(specs)`。
   - specs 来源：`loadOrBuildStoryboard(id,"a",ratio)` → `storyboardToVisualSpecs(sb,{fps,candidate:"a"})`
     （**每镜头一个 spec，各带 duration**）。
   - 海报时长：`fitSceneDurations(specs.map(s=>s.duration), max(tts, sum, 10))`，与海报数对齐。
   - 删除了只服务 neo-signal 的死变量（script/cues/baseSceneDurations/...）。
   - 新增 import：`storyboardToVisualSpecs`（motion-director）、`makeFilmHtml`（motion-render）。
4. `apps/web/src/api.ts`——`api.render` 端点改回 `/api/projects/:id/render`，body 直接传 `settings`。

> 还有一处**已回退**的改动：曾在 `motion/render` 里给 DeepSeek 动态设计加了"失败静默回退本地方案"，
> 用户要求 DeepSeek 失败应直接报错、不要静默降级 → 已撤销（见 index.ts ~469 行注释）。

---

## 3. 已知缺口 / 待办（重要）

1. **字幕未烧录**：`makeFilmHtml` 的 `rScene` 不渲染字幕；neo-signal 原本会把 `payload.subtitles`
   烧进每个场景。换到 html-film 后**内嵌字幕丢失**。音频仍照常混入。若需要字幕，需在
   `html-film.ts` 的 scene 里加字幕安全区，并把 cues 传进 `makeFilmHtml`。
2. **只是"场景幻灯片"，非逐帧动画**：`renderScenePosters` 每场景截 1 张静态海报，
   `sceneImagesToVideo` 按时长展示。CSS 入场动画在海报里被中和了，所以成片是
   "一段段静态画面 + 音频"，**没有镜头内动态**。若要平滑动画，需要走逐帧路线
   （`renderFrames` 或基于 `seek()` 的逐帧截图），但 `makeFilmHtml` 当前的动画模型
   （CSS 一次性入场）并不适合逐帧 scrub，需要改造。
3. **`makeFilmHtml` 只认 2 个主题**（`paper-ink` / 暗色 `d`），且**不消费** DeepSeek
   `MotionDesignPlan` 的 accentIndex/typographyScale/rotation/templateId。当前只透传 `themeId`。
4. **MotionGraph 路线的潜伏 bug**：`presets.ts:480-484` `productCardLayers` 用了 `f.w`/`f.h`
   （Box 类型只有 `width`/`height`），运行时为 `undefined` → 产品卡尺寸异常。tsx 不做类型检查所以能跑，
   但 `tsc` 会报错。本次未修（不在 html-film 路线上）。
5. **Chrome 硬依赖**：`renderScenePosters` 必须有 Chrome。CI/无头服务器需设 `CHROME_PATH`。
6. **类型噪声**：`html-film.ts` 的 `DS[opts.themeId??...]` 有 TS7053 索引签名报错（DeepSeek 原始代码），
   运行无碍，`tsc` 会报。未处理。

---

## 4. 如何验证（复现实验）

```bash
# 1) 起服务（注意：渲染期间别改 server 源码，会触发热重载杀进程）
pnpm --filter @trendforge/server dev    # 监听 127.0.0.1:4790

# 2) 触发 html-film 渲染（测试项目）
curl -s -X POST http://127.0.0.1:4790/api/projects/project_36c00b9a7b7347de9c/render \
  -H "Content-Type: application/json" -d '{"ratio":"9:16","format":"mp4"}'
# → 返回 {id: job_xxx}

# 3) 轮询任务
curl -s http://127.0.0.1:4790/api/render-jobs/job_xxx   # status: success → output_path

# 4) 目视校验关键帧（务必看图再下结论——见 memory: verify-render-output-with-keyframes）
FF="node_modules/.pnpm/@ffmpeg-installer+win32-x64@4.1.0/node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe"
"$FF" -y -ss 4 -i storage/projects/<id>/exports/final.mp4 -frames:v 1 out.png
# 或直接看 storage/projects/<id>/render/posters/scene_000.png
```

数据库连接（脚本里手动查项目时）：
`DATABASE_URL="file:E:/coding/TrendForge/apps/server/prisma/dev.db"`。

---

## 5. 关键文件索引

- 端点：`apps/server/src/index.ts`
  - `POST /api/projects/:id/render`（html-film，~693 行）
  - `POST /api/projects/:id/motion/render`（MotionGraph，~459 行）
  - `loadOrBuildStoryboard`（~1010 行）、`fitSceneDurations`（~1269 行）
- HTML 模板：`packages/motion-render/src/html-film.ts`（`makeFilmHtml` / `rScene`）
- Puppeteer 渲染器：`apps/renderer/src/html-renderer.ts`（`renderScenePosters` / `renderFrames` / `findChrome`）
- specs 生成：`packages/motion-director/src/director.ts`（`storyboardToVisualSpecs` / `applyMotionDesignPlan`）
- MotionGraph 帧序列：`packages/motion-render/src/sequence.ts`（已并行化）、`raster.ts`（sharp）
- 旧 html 模板：`packages/templates/src/neo-signal.ts`
- 冒烟脚本（DeepSeek 原始，参考用）：`scripts/render-html-film.ts`、`scripts/render-pw-smoke.ts`

---

## 7. 2026-06-08 改动：逐帧渲染 + 预览统一 + 消除晃动

### 7.1 晃动根因
画面晃动**不在 HTML 模板**，而在 `packages/ffmpeg/src/service.ts` 的 `sceneImagesToVideo`：
它给每张静态海报加了 `zoompan` 的 Ken Burns 推拉/平移。`zoompan` 内部只接受**整数 x/y**，
慢速缩放时每帧中心点被四舍五入到整像素 → 画面以 ±1px 来回抖（ffmpeg 著名问题）。

### 7.2 解决方案：逐帧 seek 渲染（替代静态海报 + zoompan）
- **`makeFilmHtml`（`html-film.ts`）改为 seek 驱动**：移除 CSS `@keyframes`（挂钟动画），
  改由 `window.seek(frame)` 用 JS 把每个元素的 opacity/translateY 算成"帧的纯函数"。
  入场动画 = 每元素 `data-d` 延迟 + easeOutCubic；另加一层**全场景匀速微推（线性 in p）**，
  Chrome 以**亚像素**精度逐帧渲染该 transform → **平滑、无整数抖动**（这正是 zoompan 做不到的）。
  浏览器打开时有 RAF 自动播放（供预览）；渲染器一旦调 `window.seek` 即停止 RAF，保证逐帧确定性。
- **`renderFrames`（`apps/renderer/src/html-renderer.ts`）修好**：原来给 `.scene` 设
  `animation-delay`（而 `.scene` 上根本没有 animation）→ 渲全黑帧。现改为每帧 `page.evaluate(f=>window.seek(f))`。
- **`/render` 端点**：`renderScenePosters + sceneImagesToVideo(zoompan)` → `renderFrames + framesToVideo`。
  并把 `fitSceneDurations` 后的时长写回 specs，使 HTML 时间轴的场景帧窗口与渲染帧数**逐帧对齐**。
- **`/preview` 端点统一**：原来读 `neo-signal.html` / 实时 `renderNeoSignalHtml`（与导出不同模板）→
  现在改为 `makeFilmHtml`（已渲染过则复用 `film.html`），**预览==导出**。`renderNeoSignalHtml` import 已删。

### 7.3 验证（2026-06-08）
脚本对一个 scene 的**连续帧**做灰度逐帧 mean-abs-diff：mean≈1.135 / std≈0.064
（std 仅为 mean 的 ~5.6%，无振荡）→ 运动存在且平滑，**晃动消除**。关键帧目视内容正常（paper-ink，
标题 + #1~#3 榜单）。验证脚本为一次性，已删除。

### 7.4 本次取舍 / 新缺口
- **逐帧比海报慢**：海报模式整片 ~31s；逐帧每帧一次 puppeteer 截图（串行），30s 片约 900 帧，
  耗时显著上升。`renderFrames` 目前**单页串行**——后续可开多页/多 worker 并行（参考 MotionGraph 的并发池）。
- **`sceneImagesToVideo`（含 zoompan）仍留在 ffmpeg service**，但 `/render` 已不再调用；可择期删除。
- 第 3 节缺口 #2（"只是静态幻灯片"）**已解决**；缺口 #1（字幕未烧录）、#3/#4/#6 仍在。

---

## 6. Git 状态提示

- `apps/server/src/index.ts`、`apps/web/src/api.ts` 为 tracked-modified。
- `packages/motion-render/`、`packages/motion-presets/`、`packages/motion-director/` 等多为
  **untracked 新包**（会话开始时 `git status` 即如此）；本次对其中文件的修改属于未跟踪目录。
- 尚未提交。建议提交前先 `tsc` 过一遍并处理/记录第 3 节的类型噪声。

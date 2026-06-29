# TrendForge Rendering Roadmap

TrendForge 的视频渲染目标是本地、可复现、可审查、可扩展、低成本批量。画面由分镜 DSL、代码化动效场景、字幕安全层和 FFmpeg 输出链路共同生成。

完整新架构见：[MotionGraph 方案](./motiongraph-architecture.md)。

## 设计结论

- HTML/CSS/JS 是 LLM 稳定输出的视觉语言，适合生成场景布局、动效、视觉主题和时间线。
- Remotion 适合当前代码库：React 组件化、TypeScript 类型约束、分镜数据驱动、预览和本地渲染链路成熟。
- HyperFrames 的关键经验是 seek-driven timeline：把真实时钟换成 frame/fps 的虚拟时钟，动画状态由当前帧决定，渲染慢速运行时仍然可复现。
- TrendForge 采用同样的时间观念：每个镜头由 `start`、`duration`、`camera`、`transition`、`fallbackVisual`、`captionSafeArea` 描述，渲染组件只读取当前 frame。
- 与大型视频生成模型相比，TrendForge 的优势是成本可控、事实可追踪、版式可编辑、批量稳定、字幕和发布包可复用。

## 当前路线

1. 保留 Remotion 作为默认本地 renderer。
2. 移除外部图片搜索 Key 依赖，视觉来源转向本地 motion scene library。
3. 使用 DeepSeek 或 mock LLM 生成结构化分镜 DSL。
4. 每个 scene 渲染为代码化视觉页面：产品界面、榜单墙、流程图、数据墙、时间线、新闻墙、创作者桌面。
5. 字幕层固定在全局安全区，场景内容区独立收缩，避免互相遮挡。
6. FFmpeg 继续负责最终 MP4、封面、字幕包和二次处理。

## 后续升级

- 增加 `VisualSceneSpec` schema，让 LLM 输出可校验的 HTML-like scene spec。
- 增加 `render-lint`：检查字幕重叠、文字溢出、底部安全区、色彩对比、镜头静止时间。
- 增加主题包：科技快剪、科普白板、新闻调查、创作者口播、产品榜单、暗黑资料片。
- 增加音频节拍驱动：按 BPM 生成切点、扫光、缩放、hit flash、caption punch。
- 增加 WebGPU/WebGL shader layer，用于转场、粒子、流体、扫描线、动态噪声。

# TrendForge Code Standards

这份规范用于开源协作，目标是让代码长期保持清晰、稳定、可审查。

## Principles

- 数据结构先行：业务流程先定义类型、schema、fixtures，再接 UI 和渲染。
- 模块边界清晰：每个 package 只承担一个职责。
- 本地优先：核心流程在缺少外部 API Key 时仍可跑通。
- 可复现渲染：动画状态由 frame、fps、DSL 数据和显式参数决定。
- 可验证质量：字幕安全区、文字溢出、关键帧、任务日志都有自动检查路径。
- 开源友好：命名直接、依赖克制、公共接口有文档和测试。

## TypeScript

- 使用 `strict` 类型。
- 公共输入使用 Zod schema 校验。
- 跨 package 的数据结构在 `packages/core` 或 `packages/motion-core` 定义。
- API 返回值使用显式类型。
- 错误对象包含可读 message、稳定 code 和必要 context。
- 复杂转换函数提供 fixture 测试。

## Architecture

- `core` 保存平台无关的业务契约。
- `motion-core` 保存视频画面数据契约。
- `motion-director` 保存内容到视觉规格的决策。
- `motion-presets` 保存视觉规格到 MotionGraph 的构建。
- `render-lint` 保存质量检查。
- `renderer-remotion` 执行 MotionGraph 到帧画面的渲染。
- `server` 编排任务、存储和 provider。
- `web` 只处理状态展示、编辑交互和用户操作。

## Rendering

- 每个 scene 至少有一个主视觉锚点、一个前景动效、一个背景动效。
- 底部字幕使用独立安全区。
- 长句进入字幕和脚本文案，画面层使用短标签、数字和实体名。
- 每个 visual primitive 支持 9:16、16:9、1:1、4:5。
- 每个 visual primitive 配套 golden frame fixture。
- 渲染变更保留 smoke video 或关键帧截图路径。

## UI

- 工作台优先密度、扫描效率和明确状态。
- 文案语言统一跟随用户语言设置。
- API Key 显示脱敏值。
- 任务失败提供原因、建议动作和重试入口。
- 设置页展示真实 provider 状态和 fallback 状态。

## Data And Storage

- 项目文件保存在 `storage/projects/{projectId}`。
- 缓存保存在 `storage/cache`。
- 导出保存在 `storage/projects/{projectId}/exports`。
- 日志保存在 `storage/logs` 和项目内 `logs/job.log`。
- 数据库记录保存可恢复状态，文件系统保存大资产。

## Testing

- 类型和 schema：`motion-core`、`core`。
- 内容生成：`content-matrix`、`product-video`。
- Provider fallback：`llm`、`tts`、`connectors`。
- 字幕格式：`subtitles`。
- FFmpeg 命令和错误解析：`ffmpeg`。
- MotionGraph 构建：`motion-director`、`motion-presets`。
- 渲染质量：`render-lint`。

## Review Rules

- 新功能有明确入口、状态、错误路径和验收证据。
- 新 provider 有配置状态、fallback、超时和日志脱敏。
- 新数据结构有 schema、fixture、测试和文档。
- 新视觉 primitive 有 responsive 规则、安全区规则、动效规则和 golden frame。
- 跨包调用只依赖公开导出。

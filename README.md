# TrendForge

TrendForge 是一个本地优先的 AI 热点视频工作台。它把手动文本、Product Hunt、Hacker News、RSS、Reddit、X/Twitter 等来源整理为短视频脚本，生成配音、双语字幕、封面，并通过 HTML/CSS/JS 视频模板导出多比例视频。

## Screenshots

截图将在首个公开版本发布时补充：

- Dashboard 系统状态与项目入口
- Project Studio 多步骤视频工作台
- Neo Signal 视频模板预览
- 字幕编辑器与封面编辑器

## Core Features

- 本地 Web 应用，默认访问 `http://127.0.0.1:4788`
- SQLite 本地数据库与 `storage` 文件存储
- Manual、Hacker News、RSS、Product Hunt、Reddit、X/Twitter 数据源插件
- DeepSeek 脚本生成，缺少 API Key 时使用本地 mock provider
- 火山引擎豆包 TTS，缺少配置时生成静音音频用于本地流程测试
- SRT、ASS、VTT 字幕生成、解析、编辑、导出
- Neo Signal HTML 视频模板
- FFmpeg 视频合成、字幕烧录、裁切、缩放、音频替换
- 本地任务系统，支持进度、日志、失败重试

## Architecture

```text
apps/web        React + Vite 工作台
apps/server     Fastify API、Prisma、任务系统
apps/renderer   HyperFrames 风格 HTML 渲染入口
packages/core   共享类型、状态、工具函数
packages/connectors 数据源插件
packages/llm    DeepSeek 与 mock 脚本生成
packages/tts    Doubao 与 silent TTS
packages/subtitles SRT/ASS/VTT 引擎
packages/ffmpeg FFmpeg 封装
packages/templates Neo Signal 模板数据
```

## 快速启动 / Quick Start

### 前置要求

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥ 22 | `node -v` 验证 |
| pnpm | ≥ 9 | `npm i -g pnpm@latest` 安装 |
| FFmpeg | 任意 | 可选，用于视频合成；缺失时流程仍可跑通 |

### 安装与启动

```bash
# 1. 安装依赖
pnpm install

# 2. 初始化数据库（首次运行必须执行）
pnpm prisma:generate
pnpm prisma:migrate

# 3. 启动开发服务
pnpm dev
```

打开浏览器访问：`http://127.0.0.1:4788`

> **提示**：启动后点击左侧导航「使用引导」，里面有完整的步骤说明和流程图解。

### 无 API Key 也能跑通

| 服务 | 无 Key 时的行为 |
|------|---------------|
| DeepSeek | 使用本地 mock 脚本生成器，生成示例脚本 |
| 豆包 TTS | 生成静音音频文件，保证后续字幕、渲染流程继续 |
| Product Hunt / Reddit / X | 使用本地 mock 热点数据 |
| FFmpeg | 系统状态页提示安装；字幕、脚本、封面等仍可正常使用 |

### FFmpeg 安装（可选）

```bash
# Windows（Scoop）
scoop install ffmpeg

# Windows（Chocolatey）
choco install ffmpeg

# 或下载 release 包放到 tools/ffmpeg/bin/ 目录
```

安装后，系统会自动检测并在「系统状态」栏显示就绪。

## Configuration

复制 `.env.example` 为 `.env`，也可以在设置页写入本地设置。API Key 只保存在本地，界面默认脱敏显示。

### DeepSeek

```env
DEEPSEEK_API_KEY=
DEEPSEEK_API_BASE=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

### Volcengine Doubao TTS

```env
VOLCENGINE_APP_ID=
VOLCENGINE_ACCESS_TOKEN=
VOLCENGINE_CLUSTER=
VOLCENGINE_VOICE_TYPE=
VOLCENGINE_TTS_ENDPOINT=
```

### Product Hunt

```env
PRODUCT_HUNT_TOKEN=
```

### Reddit

```env
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=TrendForge/0.1
```

### X/Twitter

```env
X_API_KEY=
X_API_SECRET=
X_BEARER_TOKEN=
```

### RSS

RSS 源在设置页维护，支持多个地址、关键词筛选和手动刷新。

### FFmpeg

安装 FFmpeg 后配置：

```env
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
```

系统状态页会检测 FFmpeg、FFprobe、DeepSeek、Doubao、Product Hunt、Reddit、X/Twitter。

## First Video Project

1. 在 Dashboard 创建项目。
2. 在内容页选择手动输入、Hacker News、RSS 或 Product Hunt。
3. 选择热点条目并保存。
4. 在脚本页生成脚本，编辑每个场景。
5. 在配音页生成配音，或上传本地音频替换。
6. 在字幕页生成中英字幕并编辑时间轴。
7. 在封面页调整标题、副标题和比例。
8. 在模板页选择 Neo Signal 和主题参数。
9. 在导出页选择 9:16、16:9、1:1、4:5 或自定义尺寸并渲染。

## Manual Text To Video

选择 Manual Input，粘贴一段文字或多个链接。TrendForge 会创建 `TrendItem`，再进入脚本、配音、字幕和导出流程。

## Trend To Video

Hacker News 使用公开 API。Product Hunt、Reddit、X/Twitter 需要本地 API 配置；缺少配置时界面显示配置状态，并提供本地 mock 热点用于链路验证。

## Subtitle Editing

字幕页支持：

- 中英双语字幕
- 拆分和合并
- 时间轴调整
- SRT、ASS、VTT 导出
- 关键词高亮

## Voice Regeneration

配音页支持整段生成、按场景分段生成、单句重生成和本地音频替换。

## Cover Export

封面页支持 9:16、16:9、1:1、4:5 与自定义分辨率导出。

## Export Ratios

- 9:16: 1080x1920
- 16:9: 1920x1080
- 1:1: 1080x1080
- 4:5: 1080x1350

## FAQ

### 没有 DeepSeek Key 可以运行吗？

可以。系统会使用本地 mock 脚本生成器。

### 没有豆包 TTS 配置可以渲染吗？

可以。系统会生成静音音频，保留真实 TTS 配置入口和 provider。

### FFmpeg 缺失时会怎样？

系统状态页会提示安装。音频、字幕、脚本、封面仍保存在本地项目中。

### 哪些功能会联网？

只有用户配置的 LLM、TTS、数据源 API 会访问外部网络。项目文件和 API Key 保存在本地。

## Development

```bash
pnpm typecheck
pnpm test
pnpm build
```

插件开发从统一接口开始：

- `SourceConnector`
- `ScriptProvider`
- `TtsProvider`
- `TemplateDefinition`

每个 provider 需要错误处理、超时、日志上下文和配置状态。

## License

建议使用 Apache-2.0 或 MIT。公开发布前根据第三方依赖许可证完成最终确认。

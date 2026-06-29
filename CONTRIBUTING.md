# Contributing To TrendForge

TrendForge 是本地自媒体矩阵视频自动化工具，开源目标是清晰、可测试、可扩展、可复现。贡献前先阅读：

- [Core Architecture](docs/core-architecture.md)
- [Code Standards](docs/code-standards.md)
- [MotionGraph Architecture](docs/motiongraph-architecture.md)
- [Plugin Development](docs/plugin-development.md)

## Development Flow

1. 安装依赖：`pnpm install`
2. 类型检查：`pnpm typecheck`
3. 测试：`pnpm test`
4. 构建：`pnpm build`
5. 运行开发服务：`pnpm dev`

## Pull Request Checklist

- 变更范围集中在对应 package 或 app。
- 新增数据结构配套 Zod schema、fixtures 和测试。
- 新增 provider、connector、renderer、primitive 时同步更新文档。
- 用户可见流程配套错误状态、日志、fallback 和验收路径。
- 视频渲染相关变更提供关键帧或 smoke render 证据。
- API Key、token、用户本地路径只进入本地设置和脱敏日志。

## Package Boundaries

- `packages/core` 放通用业务类型和工具。
- `packages/motion-core` 放 MotionGraph 类型、schema、安全区和验证工具。
- `packages/motion-director` 放 Storyboard 到 VisualSceneSpec 的决策逻辑。
- `packages/motion-presets` 放可复用 motion primitives 到 MotionGraph 的构建逻辑。
- `packages/render-lint` 放渲染质量检查。
- `apps/renderer-remotion` 放 Remotion executor 和 composition。
- `apps/server` 放 API、任务系统、数据库、文件存储和 provider 编排。
- `apps/web` 放工作台 UI 和交互。

## Quality Gates

每个阶段性提交至少跑对应 package 的 `typecheck` 和 `test`。跨包变更跑根目录 `pnpm typecheck` 与 `pnpm test`。发布前跑 `pnpm build` 和一次本地 smoke render。

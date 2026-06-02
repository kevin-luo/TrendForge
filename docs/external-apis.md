# External API Notes

TrendForge 是本地优先工具。联网行为来自用户主动启用的 provider。

- DeepSeek: 生成脚本、摘要、翻译和发布文案。
- Volcengine Doubao TTS: 生成配音。
- Product Hunt: 获取产品热点。
- Hacker News: 使用公开 API 获取榜单。
- Reddit: 使用 OAuth 配置获取 subreddit 内容。
- X/Twitter: 使用 API 配置获取关键词内容。
- RSS: 拉取用户配置的 RSS 源。

日志会脱敏常见 API Key 字段。完整项目数据保存在本地 `storage` 目录。

# Plugin Development

TrendForge 的扩展点围绕本地优先原则设计。插件只访问用户明确配置的服务，并把输出写回本地项目目录。

## Source Connector

```ts
interface SourceConnector {
  id: string;
  name: string;
  isEnabled(): Promise<boolean>;
  fetchTrending(options: FetchOptions): Promise<TrendItem[]>;
  search?(query: string, options: SearchOptions): Promise<TrendItem[]>;
}
```

## LLM Provider

Provider 输入热点条目和脚本目标，输出严格 JSON。实现需要保存原始请求与原始响应。

## TTS Provider

Provider 输入文本、音色、语速、音量和音高，输出音频路径、总时长和可选分段。

## Template

模板接收 `RenderPayload`，输出 HTML/CSS/JS 组合。模板需要声明支持比例、参数 schema 和安全字幕区域。

import Fastify from "fastify";
import type { RenderPayload } from "@trendforge/core";
import { renderNeoSignalHtml } from "@trendforge/templates";

const app = Fastify({ logger: true });

app.post("/render-html", async (request, reply) => {
  const payload = request.body as RenderPayload;
  reply.header("Content-Type", "text/html; charset=utf-8");
  return renderNeoSignalHtml(payload);
});

app.get("/health", async () => ({ ok: true }));

await app.listen({ host: "127.0.0.1", port: Number(process.env.RENDERER_PORT ?? 4791) });

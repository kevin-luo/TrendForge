import { createId, nowIso, redactSecrets } from "@trendforge/core";
import { prisma } from "./prisma.js";

export async function writeLog(input: {
  projectId?: string;
  jobId?: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}): Promise<void> {
  await prisma.log.create({
    data: {
      id: createId("log"),
      project_id: input.projectId,
      job_id: input.jobId,
      level: input.level,
      message: input.message,
      context_json: input.context ? JSON.stringify(redactSecrets(input.context)) : undefined,
      created_at: nowIso()
    }
  });
}

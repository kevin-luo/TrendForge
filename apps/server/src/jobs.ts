import { createId, nowIso, TrendForgeError, type JobRecord, type JobType } from "@trendforge/core";
import { prisma } from "./prisma.js";
import { writeLog } from "./logging.js";

type JobHandler = (jobId: string, update: (progress: number, step: string) => Promise<void>) => Promise<string | undefined>;

export class JobRunner {
  async create(projectId: string, type: JobType, handler: JobHandler): Promise<JobRecord> {
    const jobId = createId("job");
    const createdAt = nowIso();
    await prisma.renderJob.create({
      data: {
        id: jobId,
        project_id: projectId,
        type,
        status: "pending",
        progress: 0,
        step: "Queued",
        created_at: createdAt
      }
    });
    void this.run(jobId, projectId, handler);
    return {
      id: jobId,
      projectId,
      type,
      status: "pending",
      progress: 0,
      step: "Queued",
      createdAt
    };
  }

  async retry(jobId: string, handler: JobHandler): Promise<void> {
    const job = await prisma.renderJob.findUnique({ where: { id: jobId } });
    if (!job) throw new TrendForgeError("JOB_NOT_FOUND", "任务不存在", { jobId }, 404);
    await this.run(jobId, job.project_id, handler);
  }

  async cancel(jobId: string): Promise<void> {
    await prisma.renderJob.update({
      where: { id: jobId },
      data: { status: "canceled", step: "Canceled", finished_at: nowIso() }
    });
  }

  private async run(jobId: string, projectId: string, handler: JobHandler): Promise<void> {
    await prisma.renderJob.update({
      where: { id: jobId },
      data: { status: "running", started_at: nowIso(), step: "Starting" }
    });
    await writeLog({ projectId, jobId, level: "info", message: "任务开始" });
    try {
      const output = await handler(jobId, async (progress, step) => {
        await prisma.renderJob.update({ where: { id: jobId }, data: { progress, step } });
        await writeLog({ projectId, jobId, level: "info", message: step, context: { progress } });
      });
      await prisma.renderJob.update({
        where: { id: jobId },
        data: {
          status: "success",
          progress: 100,
          step: "Done",
          output_path: output,
          finished_at: nowIso()
        }
      });
      await writeLog({ projectId, jobId, level: "info", message: "任务完成", context: { output } });
    } catch (error) {
      await prisma.renderJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          error_message: error instanceof Error ? error.message : String(error),
          finished_at: nowIso()
        }
      });
      await writeLog({
        projectId,
        jobId,
        level: "error",
        message: error instanceof Error ? error.message : String(error),
        context: error instanceof TrendForgeError ? { code: error.code, details: error.details } : undefined
      });
    }
  }
}

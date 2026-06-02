import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProjectRecord } from "@trendforge/core";

export class StorageService {
  constructor(public readonly rootDir: string) {}

  async ensureRoot(): Promise<void> {
    await Promise.all([
      mkdir(this.projectsDir(), { recursive: true }),
      mkdir(path.join(this.rootDir, "cache"), { recursive: true }),
      mkdir(path.join(this.rootDir, "exports"), { recursive: true }),
      mkdir(path.join(this.rootDir, "logs"), { recursive: true })
    ]);
  }

  projectsDir(): string {
    return path.join(this.rootDir, "projects");
  }

  projectDir(projectId: string): string {
    return path.join(this.projectsDir(), projectId);
  }

  projectPath(projectId: string, ...parts: string[]): string {
    return path.join(this.projectDir(projectId), ...parts);
  }

  async ensureProject(project: ProjectRecord): Promise<void> {
    const dir = this.projectDir(project.id);
    await Promise.all([
      mkdir(path.join(dir, "source", "raw"), { recursive: true }),
      mkdir(path.join(dir, "script", "prompts"), { recursive: true }),
      mkdir(path.join(dir, "audio"), { recursive: true }),
      mkdir(path.join(dir, "subtitles"), { recursive: true }),
      mkdir(path.join(dir, "cover"), { recursive: true }),
      mkdir(path.join(dir, "render"), { recursive: true }),
      mkdir(path.join(dir, "exports"), { recursive: true }),
      mkdir(path.join(dir, "logs"), { recursive: true })
    ]);
    await writeFile(path.join(dir, "project.json"), JSON.stringify(project, null, 2), "utf8");
  }
}

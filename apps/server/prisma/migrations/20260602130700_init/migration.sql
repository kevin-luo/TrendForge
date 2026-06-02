-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source_type" TEXT,
    "language" TEXT NOT NULL DEFAULT 'zh',
    "ratio" TEXT NOT NULL DEFAULT '9:16',
    "template_id" TEXT NOT NULL DEFAULT 'neo-signal',
    "cover_path" TEXT,
    "final_video_path" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "TrendItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT,
    "source" TEXT NOT NULL,
    "external_id" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "summary" TEXT,
    "content" TEXT,
    "author" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "thumbnail" TEXT,
    "raw_json" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "TrendItem_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoScript" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "script_json" TEXT NOT NULL,
    "voiceover_text" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "VideoScript_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "meta_json" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "Asset_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subtitle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "path" TEXT,
    "cues_json" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    CONSTRAINT "Subtitle_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RenderJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'render_video',
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "step" TEXT,
    "output_path" TEXT,
    "error_message" TEXT,
    "started_at" TEXT,
    "finished_at" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "RenderJob_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT,
    "updated_at" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT,
    "job_id" TEXT,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context_json" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "Log_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Log_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "RenderJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

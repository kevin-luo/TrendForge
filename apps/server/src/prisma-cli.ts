import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const action = process.argv[2] ?? "migrate";
const prismaBin = path.resolve("node_modules", ".bin", process.platform === "win32" ? "prisma.CMD" : "prisma");
const args = action === "migrate" || action === "push" ? ["db", "push", "--schema", "prisma/schema.prisma"] : [action, "--schema", "prisma/schema.prisma"];
const defaultDatabaseUrl = `file:${path.resolve("prisma", "dev.db").replace(/\\/g, "/")}`;

if (action === "migrate" || action === "push") {
  const require = createRequire(import.meta.url);
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (filename: string) => { exec: (sql: string) => void; close: () => void } };
  const dbPath = process.env.DATABASE_URL?.startsWith("file:")
    ? process.env.DATABASE_URL.slice(5).replace(/^\/([A-Za-z]:)/, "$1")
    : path.resolve("prisma", "dev.db");
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const migrationSql = readFileSync(path.resolve("prisma", "migrations", "20260602130700_init", "migration.sql"), "utf8");
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(migrationSql);
    console.log(`SQLite schema initialized at ${dbPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("already exists")) {
      console.log(`SQLite schema already exists at ${dbPath}`);
    } else {
      throw error;
    }
  } finally {
    db.close();
  }
  process.exit(0);
}

const result = spawnSync(prismaBin, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? defaultDatabaseUrl,
    RUST_BACKTRACE: process.env.RUST_BACKTRACE ?? "1",
    RUST_LOG: process.env.RUST_LOG ?? "debug"
  }
});

process.exit(result.status ?? 1);

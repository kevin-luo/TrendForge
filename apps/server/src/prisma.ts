import { PrismaClient } from "@prisma/client";
import path from "node:path";

process.env.DATABASE_URL ??= `file:${path.resolve("prisma", "dev.db").replace(/\\/g, "/")}`;

export const prisma = new PrismaClient();

// SQLite is single-writer; under a burst of writes a concurrent statement gets
// SQLITE_BUSY and Prisma surfaces it as a timeout. Tell SQLite to wait for a
// held lock (up to 15s) instead of failing immediately, and use WAL so reads
// don't block the writer. Best-effort: ignored if the pragma can't run.
prisma
  .$queryRawUnsafe("PRAGMA busy_timeout = 15000;")
  .then(() => prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;"))
  .catch(() => {
    /* non-fatal */
  });

import { PrismaClient } from "@prisma/client";
import path from "node:path";

process.env.DATABASE_URL ??= `file:${path.resolve("prisma", "dev.db").replace(/\\/g, "/")}`;

export const prisma = new PrismaClient();

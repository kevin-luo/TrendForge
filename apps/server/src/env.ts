import "dotenv/config";
import path from "node:path";

export const env = {
  appPort: Number(process.env.APP_PORT ?? 4788),
  apiPort: Number(process.env.API_PORT ?? 4790),
  storageDir: path.resolve(process.cwd(), process.env.STORAGE_DIR ?? "../../storage"),
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db"
};

/**
 * Load .env.local / .env from the project root when running API routes locally.
 * `vercel dev` does not always merge these into the serverless isolate's process.env.
 */
import dotenv from "dotenv";
import { existsSync } from "fs";
import path from "path";

const root = process.cwd();
for (const name of [".env.local", ".env"]) {
  const file = path.join(root, name);
  if (existsSync(file)) dotenv.config({ path: file, override: false, quiet: true });
}

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dir, "..", "..", "..");
const logsDir = path.join(projectRoot, "logs");

const buildLogFileName = (prefix: string) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return `${prefix}-${timestamp}.json`;
};

export const writeEvalLog = async (prefix: string, payload: unknown) => {
  const logPath = path.join(logsDir, buildLogFileName(prefix));

  await mkdir(logsDir, { recursive: true });
  await writeFile(logPath, JSON.stringify(payload, null, 2));

  return path.relative(projectRoot, logPath);
};

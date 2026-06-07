import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const logsDir = path.resolve(import.meta.dir, "..", "..", "logs");

const buildLogFileName = (prefix: string) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return `${prefix}-${timestamp}.json`;
};

export const writeEvalLog = async (prefix: string, payload: unknown) => {
  await mkdir(logsDir, { recursive: true });
  await writeFile(path.join(logsDir, buildLogFileName(prefix)), JSON.stringify(payload, null, 2));
};

import { z } from "zod";

export const baseEnvShape = {
  OPENROUTER_API_KEY: z.string().min(1),
  LANGFUSE_SECRET_KEY: z.string().min(1),
  LANGFUSE_PUBLIC_KEY: z.string().min(1),
  LANGFUSE_BASE_URL: z.url().default("https://cloud.langfuse.com"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
};

export const workerEnvShape = {
  ...baseEnvShape,
  TRIAGE_API_KEY: z.string().min(1),
};

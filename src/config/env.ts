import { createEnv } from "@t3-oss/env-core";
import { minLength, optional, pipe, string, url } from "valibot";

export const env = createEnv({
  server: {
    OPENROUTER_API_KEY: pipe(string(), minLength(1)),
    LANGFUSE_SECRET_KEY: pipe(string(), minLength(1)),
    LANGFUSE_PUBLIC_KEY: pipe(string(), minLength(1)),
    LANGFUSE_BASE_URL: optional(pipe(string(), url()), "https://cloud.langfuse.com"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

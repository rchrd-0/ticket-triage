import { createEnv } from "@t3-oss/env-core";
import { baseEnvShape } from "@/config/env.schema";

export const env = createEnv({
  server: baseEnvShape,
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

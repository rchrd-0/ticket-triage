import { createEnv } from "@t3-oss/env-core";
import { workerEnvShape } from "@/config/env.schema";

type WorkerEnvKey = keyof typeof workerEnvShape;

type WorkerRuntimeEnv = Record<WorkerEnvKey, string | number | boolean | undefined>;

export const createWorkerEnv = (runtimeEnv: Env) =>
  createEnv({
    server: workerEnvShape,
    // safe as long as worker config only includes scalar vars/secrets
    // don't pass platform bindings like D1/KV/R2 through T3 Env
    runtimeEnv: runtimeEnv as WorkerRuntimeEnv,
    emptyStringAsUndefined: true,
  });

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError, z } from "zod";
import { createWorkerEnv } from "@/config/worker-env";
import logger from "@/lib/logger";
import { installWorkerObservabilityFetchPatch } from "@/lib/worker-observability-fetch";
import { createCoreMastra } from "@/mastra/core";
import { TicketSchema } from "@/schemas/ticket.schema";
import { TriageOutputSchema } from "@/workflows/triage.workflow";

type WorkerConfig = ReturnType<typeof createWorkerEnv>;
type CoreMastra = ReturnType<typeof createCoreMastra>;

const TriageRequestSchema = z.object({
  ticket: TicketSchema,
});

type AppEnv = {
  Bindings: Env;
  Variables: {
    workerEnv: WorkerConfig;
  };
};

const app = new Hono<AppEnv>();

let coreMastra: CoreMastra | undefined;
const workerLog = logger.child({ surface: "worker" });

const flushObservability = async () => {
  await coreMastra?.observability.getDefaultInstance()?.flush();
};

const runTriageWorkflow = async (input: z.infer<typeof TriageRequestSchema>) => {
  coreMastra = coreMastra ?? createCoreMastra();

  const workflow = coreMastra.getWorkflowById("triage-workflow");
  const run = await workflow.createRun();
  const result = await run.start({
    inputData: input,
    tracingOptions: {
      metadata: {
        traceName: "triage-workflow-worker",
      },
    },
  });

  if (result.status !== "success") {
    throw new HTTPException(500, { message: `Triage workflow failed: ${result.status}` });
  }

  const directParse = TriageOutputSchema.safeParse(result.result);

  if (directParse.success) {
    return directParse.data;
  }

  const branchOutputs = result.result as Record<string, unknown>;
  const output = branchOutputs["draft-workflow"] ?? branchOutputs["human-review"];

  return TriageOutputSchema.parse(output);
};

app.use("/triage", async (c, next) => {
  const workerEnv = createWorkerEnv(c.env);
  c.set("workerEnv", workerEnv);
  installWorkerObservabilityFetchPatch(workerEnv.LANGFUSE_BASE_URL);

  const authorization = c.req.header("Authorization");
  const expected = `Bearer ${workerEnv.TRIAGE_API_KEY}`;

  if (authorization !== expected) {
    workerLog.warn(
      {
        event: "worker.triage.unauthorized",
        method: c.req.method,
        path: c.req.path,
      },
      "Unauthorized triage request rejected"
    );

    return c.json(
      {
        success: false,
        message: "Unauthorized",
      },
      401
    );
  }

  const startedAt = performance.now();
  await next();

  workerLog.info(
    {
      event: "worker.triage.completed",
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round(performance.now() - startedAt),
    },
    "Triage request completed"
  );
});

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json(
      {
        success: false,
        message: "Validation failed",
        errors: err.issues.map((issue) => ({
          field: issue.path.join(".") || "unknown",
          message: issue.message,
        })),
      },
      400
    );
  }

  if (err instanceof HTTPException) {
    return c.json(
      {
        success: false,
        message: err.message,
      },
      err.status
    );
  }

  workerLog.error(
    {
      event: "worker.unhandled_error",
      name: err instanceof Error ? err.name : "UnknownError",
      err: err instanceof Error ? err.message : String(err),
    },
    "Unhandled Worker error"
  );
  return c.json(
    {
      success: false,
      message: "Internal server error",
    },
    500
  );
});

app.notFound((c) =>
  c.json(
    {
      success: false,
      message: "Not found",
    },
    404
  )
);

app.get("/", (c) =>
  c.json({
    success: true,
    message: "Ok",
  })
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "ticket-triage",
  })
);

app.post("/triage", async (c) => {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: "Invalid JSON body" });
  });
  const input = TriageRequestSchema.parse(body);
  const output = await runTriageWorkflow(input);

  c.executionCtx.waitUntil(
    flushObservability().catch((error) => {
      workerLog.error(
        {
          event: "observability.flush.failed",
          name: error instanceof Error ? error.name : "UnknownError",
          err: error instanceof Error ? error.message : String(error),
        },
        "Worker observability flush failed"
      );
    })
  );

  return c.json(output);
});

export default app;

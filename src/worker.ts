import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { ZodError, z } from "zod";
import { createWorkerEnv } from "@/config/worker-env";
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

app.use(logger());

app.use("/triage", async (c, next) => {
  const workerEnv = createWorkerEnv(c.env);
  c.set("workerEnv", workerEnv);

  const authorization = c.req.header("Authorization");
  const expected = `Bearer ${workerEnv.TRIAGE_API_KEY}`;

  if (authorization !== expected) {
    return c.json(
      {
        success: false,
        message: "Unauthorized",
      },
      401
    );
  }

  await next();
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

  console.error("Unhandled Worker error", {
    name: err instanceof Error ? err.name : "UnknownError",
    message: err instanceof Error ? err.message : String(err),
  });
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
      console.error("Worker observability flush failed", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      });
    })
  );

  return c.json(output);
});

export default app;

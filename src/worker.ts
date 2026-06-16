import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { ZodError } from "zod";
import { createWorkerEnv } from "@/config/worker-env";

type WorkerConfig = ReturnType<typeof createWorkerEnv>;

type AppEnv = {
  Bindings: Env;
  Variables: {
    workerEnv: WorkerConfig;
  };
};

const app = new Hono<AppEnv>();

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

  console.error("Unhandled error:", err);
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
    success: true,
    service: "ticket-triage",
  })
);

export default app;

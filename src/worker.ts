import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { ZodError } from "zod";

type Bindings = {
  LANGFUSE_BASE_URL: string;
  LANGFUSE_PUBLIC_KEY: string;
  LANGFUSE_SECRET_KEY: string;
  LOG_LEVEL: "debug" | "info" | "warn" | "error";
  NODE_ENV: "development" | "production" | "test";
  OPENROUTER_API_KEY: string;
  TRIAGE_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use(logger());

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

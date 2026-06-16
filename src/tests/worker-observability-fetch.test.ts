import { describe, expect, test } from "bun:test";
import { isOtelExportRequest } from "@/lib/worker-observability-fetch";

describe("isOtelExportRequest", () => {
  const defaultTargets = [{ origin: "https://jp.cloud.langfuse.com", pathPrefix: "/" }];

  test("matches OTLP trace exports on the configured origin", () => {
    expect(
      isOtelExportRequest("https://jp.cloud.langfuse.com/api/public/otel/v1/traces", defaultTargets)
    ).toBe(true);
  });

  test("matches Request objects for OTLP log exports", () => {
    const request = new Request("https://jp.cloud.langfuse.com/api/public/otel/v1/logs", {
      method: "POST",
    });

    expect(isOtelExportRequest(request, defaultTargets)).toBe(true);
  });

  test("rejects non-OTLP paths on the same origin", () => {
    expect(
      isOtelExportRequest("https://jp.cloud.langfuse.com/api/public/scores", defaultTargets)
    ).toBe(false);
  });

  test("rejects matching paths on a different origin", () => {
    expect(
      isOtelExportRequest("https://openrouter.ai/api/public/otel/v1/traces", defaultTargets)
    ).toBe(false);
  });

  test("respects a configured base-path prefix", () => {
    const prefixedTargets = [{ origin: "https://example.com", pathPrefix: "/langfuse" }];

    expect(
      isOtelExportRequest("https://example.com/langfuse/api/public/otel/v1/traces", prefixedTargets)
    ).toBe(true);
    expect(
      isOtelExportRequest("https://example.com/api/public/otel/v1/traces", prefixedTargets)
    ).toBe(false);
  });
});

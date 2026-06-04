import type { PropagateAttributesParams } from "@langfuse/core";
import { observe, propagateAttributes } from "@langfuse/tracing";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { TelemetrySettings } from "ai";
import { env } from "@/config/env";

import "@/lib/instrumentation";

export const openrouter = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});

/** pass to every AI SDK call (`generateText`, `streamText`, ...). */
export const defaultTelemetry: TelemetrySettings = {
  isEnabled: true,
};

export function aiTelemetry(overrides?: Partial<TelemetrySettings>): TelemetrySettings {
  return {
    ...defaultTelemetry,
    ...overrides,
  };
}

/** wrap a workflow step with a named Langfuse trace and optional session/user/tags. */
export function withLangfuseTrace<T>(
  traceName: string,
  attributes: PropagateAttributesParams,
  run: () => Promise<T>
): Promise<T> {
  return observe(() => propagateAttributes({ traceName, ...attributes }, run), {
    name: traceName,
  })();
}

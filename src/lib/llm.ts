import type { PropagateAttributesParams } from "@langfuse/core";
import { observe, propagateAttributes } from "@langfuse/tracing";
import { createOpenRouter, type OpenRouterUsageAccounting } from "@openrouter/ai-sdk-provider";
import type { generateText, TelemetrySettings } from "ai";
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

export type LlmRunUsage = OpenRouterUsageAccounting;

export const getOpenRouterUsage = (
  providerMetadata: Awaited<ReturnType<typeof generateText>>["providerMetadata"]
): LlmRunUsage | undefined => {
  const openRouterMetadata = providerMetadata?.openrouter as { usage?: LlmRunUsage } | undefined;

  return openRouterMetadata?.usage;
};

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

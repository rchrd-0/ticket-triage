import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { env } from "@/config/env";

export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  publicKey: env.LANGFUSE_PUBLIC_KEY,
  secretKey: env.LANGFUSE_SECRET_KEY,
  baseUrl: env.LANGFUSE_BASE_URL,
});

const otelSdk = new NodeSDK({
  spanProcessors: [langfuseSpanProcessor],
});

otelSdk.start();

/** flush pending spans before short lived processes exit (scripts, evals) */
export async function flushLangfuseTraces(): Promise<void> {
  await langfuseSpanProcessor.forceFlush();
}

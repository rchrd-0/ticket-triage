import { Mastra } from "@mastra/core";
import { LangfuseExporter } from "@mastra/langfuse";
import { Observability } from "@mastra/observability";
import { classifierAgent } from "@/agents/classifier.agent";
import { drafterAgent } from "@/agents/drafter.agent";
import { triageWorkflow } from "@/workflows/triage.workflow";

export const mastra = new Mastra({
  agents: { classifierAgent, drafterAgent },
  workflows: { triageWorkflow },
  observability: new Observability({
    configs: {
      langfuse: {
        serviceName: "ticket-triage",
        exporters: [
          new LangfuseExporter({
            realtime: process.env.NODE_ENV === "development",
          }),
        ],
      },
    },
  }),
});

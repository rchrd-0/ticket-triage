import { Mastra } from "@mastra/core";
import { LangfuseExporter } from "@mastra/langfuse";
import { Observability } from "@mastra/observability";
import { classifierAgent } from "@/agents/classifier.agent";
import { drafterAgent } from "@/agents/drafter.agent";
import { investigatorAgent } from "@/agents/investigator.agent";
import { getOrderStatusTool } from "@/tools/get-order-status";
import { searchKbTool } from "@/tools/search-kb";
import { searchSopTool } from "@/tools/search-sop";
import { triageWorkflow } from "@/workflows/triage.workflow";

export const mastra = new Mastra({
  agents: { classifierAgent, drafterAgent, investigatorAgent },
  workflows: { triageWorkflow },
  tools: { searchKbTool, searchSopTool, getOrderStatusTool },
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

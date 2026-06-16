import { Mastra } from "@mastra/core";
import { LangfuseExporter } from "@mastra/langfuse";
import { Observability } from "@mastra/observability";
import { classifierAgent } from "@/agents/classifier.agent";
import { drafterAgent } from "@/agents/drafter.agent";
import { investigatorAgent } from "@/agents/investigator.agent";
import { env } from "@/config/env";
import { getOrderStatusTool } from "@/tools/get-order-status";
import { searchKbTool } from "@/tools/search-kb";
import { searchSopTool } from "@/tools/search-sop";
import { triageWorkflow } from "@/workflows/triage.workflow";

export const createCoreMastraConfig = () => ({
  agents: { classifierAgent, drafterAgent, investigatorAgent },
  workflows: { triageWorkflow },
  tools: { searchKbTool, searchSopTool, getOrderStatusTool },
  observability: new Observability({
    configs: {
      langfuse: {
        serviceName: "ticket-triage",
        exporters: [
          new LangfuseExporter({
            realtime: env.LANGFUSE_REALTIME,
          }),
        ],
      },
    },
  }),
});

export const createCoreMastra = () => new Mastra(createCoreMastraConfig());

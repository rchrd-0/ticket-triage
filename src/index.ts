import { Mastra } from "@mastra/core";
import { classifierAgent } from "@/agents/classifier.agent";
import { drafterAgent } from "@/agents/drafter.agent";
import { triageWorkflow } from "@/workflows/triage.workflow";

export const mastra = new Mastra({
  agents: { classifierAgent, drafterAgent },
  workflows: { triageWorkflow },
});

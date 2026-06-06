import { Mastra } from "@mastra/core";
import { classifierAgent } from "@/agents/classifier.agent";
import { drafterAgent } from "@/agents/drafter.agent";

export const mastra = new Mastra({
  agents: { classifierAgent, drafterAgent },
});

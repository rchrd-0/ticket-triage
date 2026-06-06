import { Mastra } from "@mastra/core";
import { classifierAgent } from "@/agents/classifier.agent";

export const mastra = new Mastra({
  agents: { classifierAgent },
});

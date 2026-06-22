import { Mastra } from "@mastra/core";
import { classifierScorers } from "@/evals/classifier.scorers";
import { createCoreMastraConfig } from "@/mastra/core";
import { supportContextMcp } from "@/mcp/support-context.mcp";

export const mastra = new Mastra({
  ...createCoreMastraConfig(),
  mcpServers: { supportContextMcp },
  scorers: classifierScorers,
});

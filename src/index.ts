import { Mastra } from "@mastra/core";
import { classifierScorers } from "@/evals/classifier/scorers";
import { replyQualityScorers } from "@/evals/drafter/reply-quality.scorers";
import { replyQualityJudgeScorer } from "@/evals/drafter/reply-quality-judge.scorers";
import { createCoreMastraConfig } from "@/mastra/core";
import { supportContextMcp } from "@/mcp/support-context.mcp";

export const mastra = new Mastra({
  ...createCoreMastraConfig(),
  mcpServers: { supportContextMcp },
  scorers: {
    ...classifierScorers,
    ...replyQualityScorers,
    "reply-quality-judge": replyQualityJudgeScorer,
  },
});

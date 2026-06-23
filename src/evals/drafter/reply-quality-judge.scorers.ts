import { createScorer } from "@mastra/core/evals";
import { z } from "zod";
import { replyQualityJudge } from "@/config/models";
import type {
  ReplyQualityScorerInput,
  ReplyQualityScorerOutput,
} from "@/evals/drafter/reply-quality.scorers";
import type { ReplyQualityManualScores } from "@/evals/shared/types";
import {
  buildReplyQualityJudgePrompt,
  replyQualityJudgeInstructions,
} from "@/prompts/reply-quality-judge.prompt";
import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import type { Ticket } from "@/schemas/ticket.schema";

export type ReplyQualityDimension = keyof ReplyQualityManualScores;

export type ReplyQualityJudgeScorerInput = ReplyQualityScorerInput & {
  ticket: Ticket;
  classification: ClassifiedTicket;
};

export type ReplyQualityJudgeCalibration = {
  manualAverage: number;
  judgeAverage: number;
  averageDelta: number;
  dimensionDeltas: Record<ReplyQualityDimension, number>;
  calibrationMisses: ReplyQualityDimension[];
  withinTolerance: boolean;
};

export const replyQualityDimensions = [
  "groundedness",
  "actionability",
  "policySafety",
  "tone",
  "provenanceDiscipline",
] as const satisfies ReplyQualityDimension[];

const replyQualityJudgeScoreSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const ReplyQualityJudgeOutputSchema = z.object({
  scores: z.object({
    groundedness: replyQualityJudgeScoreSchema,
    actionability: replyQualityJudgeScoreSchema,
    policySafety: replyQualityJudgeScoreSchema,
    tone: replyQualityJudgeScoreSchema,
    provenanceDiscipline: replyQualityJudgeScoreSchema,
  }),
  rationale: z
    .string()
    .min(1)
    .describe("One or two short sentences explaining the main reason for the scores."),
});

export type ReplyQualityJudgeAnalysis = z.infer<typeof ReplyQualityJudgeOutputSchema>;

export type ReplyQualityJudgeOutput = ReplyQualityJudgeAnalysis & {
  average: number;
};

const defaultCalibrationTolerance = {
  maxDimensionDelta: 1,
  maxAverageDelta: 0.5,
};

const getReplyQualityJudgeInput = (
  input: ReplyQualityJudgeScorerInput | undefined
): ReplyQualityJudgeScorerInput => {
  if (!input) {
    throw new Error("Reply-quality judge scorer requires input.");
  }

  return input;
};

export const calculateReplyQualityAverage = (scores: ReplyQualityManualScores) => {
  const total = replyQualityDimensions.reduce((sum, dimension) => sum + scores[dimension], 0);

  return total / replyQualityDimensions.length;
};

export const calculateReplyQualityJudgeCalibration = (
  manualScores: ReplyQualityManualScores,
  judgeOutput: ReplyQualityJudgeOutput,
  tolerance = defaultCalibrationTolerance
): ReplyQualityJudgeCalibration => {
  const dimensionDeltas = Object.fromEntries(
    replyQualityDimensions.map((dimension) => [
      dimension,
      Math.abs(manualScores[dimension] - judgeOutput.scores[dimension]),
    ])
  ) as Record<ReplyQualityDimension, number>;
  const manualAverage = calculateReplyQualityAverage(manualScores);
  const judgeAverage = judgeOutput.average;
  const averageDelta = Math.abs(manualAverage - judgeAverage);
  const calibrationMisses = replyQualityDimensions.filter(
    (dimension) => dimensionDeltas[dimension] > tolerance.maxDimensionDelta
  );

  return {
    manualAverage,
    judgeAverage,
    averageDelta,
    dimensionDeltas,
    calibrationMisses,
    withinTolerance: calibrationMisses.length === 0 && averageDelta <= tolerance.maxAverageDelta,
  };
};

export const replyQualityJudgeScorer = createScorer<
  ReplyQualityJudgeScorerInput,
  ReplyQualityScorerOutput
>({
  id: "reply-quality-judge",
  description: "Advisory LLM judge for drafter reply quality.",
  judge: {
    model: `openrouter/${replyQualityJudge.agentModel}`,
    instructions: replyQualityJudgeInstructions,
  },
})
  .analyze<ReplyQualityJudgeAnalysis>({
    description: "Score the reply against the five reply-quality dimensions.",
    outputSchema: ReplyQualityJudgeOutputSchema,
    createPrompt: ({ run }) => {
      const input = getReplyQualityJudgeInput(run.input);

      return buildReplyQualityJudgePrompt({
        caseId: input.caseId,
        ticket: input.ticket,
        classification: input.classification,
        sources: input.sources,
        terminationReason: input.terminationReason,
        reply: run.output,
      });
    },
  })
  .generateScore(({ results }) => calculateReplyQualityAverage(results.analyzeStepResult.scores))
  .generateReason(({ results }) => results.analyzeStepResult.rationale);

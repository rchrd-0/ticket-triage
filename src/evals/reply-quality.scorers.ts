import { createScorer } from "@mastra/core/evals";
import type { ReplyQualityManualCase } from "@/evals/types";
import type { DraftReply } from "@/schemas/draft-reply.schema";
import type {
  InvestigationSource,
  InvestigationTerminationReason,
} from "@/schemas/investigation.schema";

export type ReplyQualityScorerInput = {
  caseId: string;
  sources: InvestigationSource[];
  terminationReason: InvestigationTerminationReason;
};

export type ReplyQualityScorerOutput = DraftReply;

export type ReplyQualityGroundTruth = ReplyQualityManualCase;

export type ReplyQualityScorerResults = Record<string, { score: number }>;

const getManualBaseline = (groundTruth: unknown): ReplyQualityGroundTruth => {
  if (!groundTruth || typeof groundTruth !== "object") {
    throw new Error("Reply-quality scorer requires manual baseline as groundTruth.");
  }

  return groundTruth as ReplyQualityGroundTruth;
};

const getManualAverage = (manualCase: ReplyQualityGroundTruth) => {
  const scores = Object.values(manualCase.scores);
  const total = scores.reduce((sum, score) => sum + score, 0);

  return total / scores.length;
};

const unsupportedOrderLookupPatterns = [
  /\b(?:i|we)(?:'ve| have| already)?\s+(?:checked|looked into|looked up|investigated)\b/,
  /\btracking\s+(?:has|had|is|was|shows|showed|does not|doesn't|has not|hasn't|not|no)\b/,
  /\b(?:no|not any|no recent|no newer)\s+(?:tracking|carrier)\s+(?:update|updates|scan|scans|movement)\b/,
  /\border\s+(?:lookup|record|status)\s+(?:shows|showed|is|was|could not|cannot|can't)\b/,
  /\bcarrier\s+status\s+(?:shows|showed|is|was)\b/,
];

const hasUnsupportedOrderLookupLanguage = (replyBody: string) => {
  const body = replyBody.toLowerCase();

  return unsupportedOrderLookupPatterns.some((pattern) => pattern.test(body));
};

export const replyProvenanceContractScorer = createScorer<
  ReplyQualityScorerInput,
  ReplyQualityScorerOutput
>({
  id: "reply-provenance-contract",
  description:
    "Checks that reply grounding IDs come from supplied sources and source/no-source citation presence is valid.",
}).generateScore(({ run }) => {
  const providedSourceIds = run.input?.sources.map((source) => source.sourceId) ?? [];
  const groundingSourceIds = run.output.groundingSourceIds;
  const groundingFromProvidedSources = groundingSourceIds.every((sourceId) =>
    providedSourceIds.includes(sourceId)
  );
  const groundingPresenceValid =
    providedSourceIds.length === 0
      ? groundingSourceIds.length === 0
      : groundingSourceIds.length > 0;

  return Number(groundingFromProvidedSources && groundingPresenceValid);
});

export const replyPresenceContractScorer = createScorer<
  ReplyQualityScorerInput,
  ReplyQualityScorerOutput
>({
  id: "reply-presence-contract",
  description: "Checks that a draftable reply contains subject and body text.",
}).generateScore(({ run }) => {
  const hasSubject = run.output.subject.trim().length > 0;
  const hasBody = run.output.body.trim().length > 0;

  return Number(hasSubject && hasBody);
});

export const unknownOrderGuardrailScorer = createScorer<
  ReplyQualityScorerInput,
  ReplyQualityScorerOutput
>({
  id: "unknown-order-guardrail",
  description:
    "Checks that replies without an order-status source do not imply tracking lookup or tracking status.",
}).generateScore(({ run }) => {
  const hasOrderStatusSource =
    run.input?.sources.some((source) => source.sourceType === "order_status") ?? false;

  if (hasOrderStatusSource) {
    return 1;
  }

  return Number(!hasUnsupportedOrderLookupLanguage(run.output.body));
});

export const manualBaselineReferenceScorer = createScorer<
  ReplyQualityScorerInput,
  ReplyQualityScorerOutput
>({
  id: "manual-baseline-reference",
  description: "Reports the stored manual reply-quality average for calibration reference.",
}).generateScore(({ run }) => getManualAverage(getManualBaseline(run.groundTruth)));

export const replyQualityScorers = {
  "reply-provenance-contract": replyProvenanceContractScorer,
  "reply-presence-contract": replyPresenceContractScorer,
  "unknown-order-guardrail": unknownOrderGuardrailScorer,
  "manual-baseline-reference": manualBaselineReferenceScorer,
};

export const deterministicReplyQualityScorerIds = [
  "reply-provenance-contract",
  "reply-presence-contract",
  "unknown-order-guardrail",
] as const;

export const runReplyQualityScorers = async (args: {
  input: ReplyQualityScorerInput;
  output: ReplyQualityScorerOutput;
  groundTruth: ReplyQualityGroundTruth;
}): Promise<ReplyQualityScorerResults> => {
  const scorerEntries = Object.values(replyQualityScorers);
  const results = await Promise.all(
    scorerEntries.map(async (scorer) => {
      const result = await scorer.run(args);

      return [scorer.id, { score: result.score }] as const;
    })
  );

  return Object.fromEntries(results);
};

export const replyQualityDeterministicPassed = (scorerResults: ReplyQualityScorerResults) =>
  deterministicReplyQualityScorerIds.every((scorerId) => scorerResults[scorerId]?.score === 1);

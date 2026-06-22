import { createScorer } from "@mastra/core/evals";
import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";

export type ClassifierScorerInput = {
  ticketId: string;
  product: string;
};

export type ClassifierScorerOutput = ClassifiedTicket;

const getExpectedClassification = (groundTruth: unknown): ClassifiedTicket => {
  if (!groundTruth || typeof groundTruth !== "object") {
    throw new Error("Classifier scorer requires expected classification as groundTruth.");
  }

  return groundTruth as ClassifiedTicket;
};

export const classifierPrimaryContractScorer = createScorer<
  ClassifierScorerInput,
  ClassifierScorerOutput
>({
  id: "classifier-primary-contract",
  description: "Checks that classifier category and needsHuman match the expected golden label.",
}).generateScore(({ run }) => {
  const expected = getExpectedClassification(run.groundTruth);

  return Number(
    run.output.category === expected.category && run.output.needsHuman === expected.needsHuman
  );
});

export const classifierCategoryContractScorer = createScorer<
  ClassifierScorerInput,
  ClassifierScorerOutput
>({
  id: "classifier-category-contract",
  description: "Checks that classifier category matches the expected golden label.",
}).generateScore(({ run }) => {
  const expected = getExpectedClassification(run.groundTruth);

  return Number(run.output.category === expected.category);
});

export const classifierNeedsHumanContractScorer = createScorer<
  ClassifierScorerInput,
  ClassifierScorerOutput
>({
  id: "classifier-needs-human-contract",
  description: "Checks that classifier needsHuman matches the expected golden label.",
}).generateScore(({ run }) => {
  const expected = getExpectedClassification(run.groundTruth);

  return Number(run.output.needsHuman === expected.needsHuman);
});

export const classifierUrgencyContractScorer = createScorer<
  ClassifierScorerInput,
  ClassifierScorerOutput
>({
  id: "classifier-urgency-contract",
  description: "Checks that classifier urgency matches the expected golden label.",
}).generateScore(({ run }) => {
  const expected = getExpectedClassification(run.groundTruth);

  return Number(run.output.urgency === expected.urgency);
});

export const classifierHighRiskFalseNegativeContractScorer = createScorer<
  ClassifierScorerInput,
  ClassifierScorerOutput
>({
  id: "classifier-high-risk-fn-contract",
  description: "Checks that expected human-review cases are not routed to automation.",
}).generateScore(({ run }) => {
  const expected = getExpectedClassification(run.groundTruth);

  return Number(!(expected.needsHuman && !run.output.needsHuman));
});

export const classifierScorers = {
  "classifier-primary-contract": classifierPrimaryContractScorer,
  "classifier-category-contract": classifierCategoryContractScorer,
  "classifier-needs-human-contract": classifierNeedsHumanContractScorer,
  "classifier-urgency-contract": classifierUrgencyContractScorer,
  "classifier-high-risk-fn-contract": classifierHighRiskFalseNegativeContractScorer,
};

export type ClassifierScorerResults = Record<string, { score: number }>;

export const runClassifierScorers = async (args: {
  input: ClassifierScorerInput;
  output: ClassifierScorerOutput;
  groundTruth: ClassifiedTicket;
}): Promise<ClassifierScorerResults> => {
  const scorerEntries = Object.values(classifierScorers);
  const results = await Promise.all(
    scorerEntries.map(async (scorer) => {
      const result = await scorer.run(args);

      return [scorer.id, { score: result.score }] as const;
    })
  );

  return Object.fromEntries(results);
};

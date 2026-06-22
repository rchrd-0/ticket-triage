import type { ClassifyTicketResult } from "@/agents/classifier.agent";
import type { ClassifierScorerResults } from "@/evals/classifier/scorers";
import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import type { Ticket } from "@/schemas/ticket.schema";
import type { ClassifierEvalCaseLog, ClassifierEvalSummary, ClassifierEvalTotals } from "./types";

export const createEvalTotals = (): ClassifierEvalTotals => ({
  pass: 0,
  fail: 0,
  errors: 0,
  categoryPass: 0,
  needsHumanPass: 0,
  urgencyPass: 0,
  confidencePass: 0,
  totalLatencyMs: 0,
  totalCost: 0,
  ticketsWithCost: 0,
});

const scorerPassed = (scorerResults: ClassifierScorerResults, scorerId: string): boolean => {
  const scorerResult = scorerResults[scorerId];

  if (!scorerResult) {
    throw new Error(`Missing classifier scorer result: ${scorerId}`);
  }

  return scorerResult.score === 1;
};

export const buildCaseLog = (
  ticket: Ticket,
  expected: ClassifiedTicket,
  actual: ClassifiedTicket,
  usage: ClassifyTicketResult["usage"],
  latencyMs: number,
  scorerResults: ClassifierScorerResults
): ClassifierEvalCaseLog => {
  const matches = {
    category: scorerPassed(scorerResults, "classifier-category-contract"),
    needsHuman: scorerPassed(scorerResults, "classifier-needs-human-contract"),
    urgency: scorerPassed(scorerResults, "classifier-urgency-contract"),
    confidence: actual.confidence === expected.confidence,
  };
  const costCredits = usage?.cost;

  return {
    ticketId: ticket.id,
    product: ticket.product,
    ok: scorerPassed(scorerResults, "classifier-primary-contract"),
    latencyMs: Math.round(latencyMs),
    actual,
    expected,
    matches,
    scorerResults,
    ...(typeof costCredits === "number" ? { costCredits } : {}),
  };
};

export const addCaseToTotals = (totals: ClassifierEvalTotals, caseLog: ClassifierEvalCaseLog) => {
  totals.pass += Number(caseLog.ok);
  totals.fail += Number(!caseLog.ok);
  totals.categoryPass += Number(caseLog.matches.category);
  totals.needsHumanPass += Number(caseLog.matches.needsHuman);
  totals.urgencyPass += Number(caseLog.matches.urgency);
  totals.confidencePass += Number(caseLog.matches.confidence);
  totals.totalLatencyMs += caseLog.latencyMs;

  if (typeof caseLog.costCredits === "number") {
    totals.totalCost += caseLog.costCredits;
    totals.ticketsWithCost += 1;
  }
};

export const buildSummary = (
  totals: ClassifierEvalTotals,
  datasetSize: number
): ClassifierEvalSummary => {
  const processedCount = datasetSize - totals.errors;

  return {
    pass: totals.pass,
    fail: totals.fail,
    errors: totals.errors,
    primaryAccuracy: totals.pass / datasetSize,
    category: { pass: totals.categoryPass, total: datasetSize },
    needsHuman: { pass: totals.needsHumanPass, total: datasetSize },
    urgency: { pass: totals.urgencyPass, total: datasetSize },
    confidence: { pass: totals.confidencePass, total: datasetSize },
    avgLatencyMs: processedCount > 0 ? Math.round(totals.totalLatencyMs / processedCount) : 0,
    totalCostCredits: Number(totals.totalCost.toFixed(6)),
    ticketsWithCost: totals.ticketsWithCost,
  };
};

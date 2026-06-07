import type { ClassifyTicketResult } from "@/agents/classifier.agent";
import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import type { Ticket } from "@/schemas/ticket.schema";
import type { EvalCaseLog, EvalSummary, EvalTotals } from "./types";

export const createEvalTotals = (): EvalTotals => ({
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

export const compareClassification = (actual: ClassifiedTicket, expected: ClassifiedTicket) => ({
  category: actual.category === expected.category,
  needsHuman: actual.needsHuman === expected.needsHuman,
  urgency: actual.urgency === expected.urgency,
  confidence: actual.confidence === expected.confidence,
});

export const buildCaseLog = (
  ticket: Ticket,
  expected: ClassifiedTicket,
  actual: ClassifiedTicket,
  usage: ClassifyTicketResult["usage"],
  latencyMs: number
): EvalCaseLog => {
  const matches = compareClassification(actual, expected);
  const costCredits = usage?.cost;

  return {
    ticketId: ticket.id,
    product: ticket.product,
    ok: matches.category && matches.needsHuman,
    latencyMs: Math.round(latencyMs),
    actual,
    expected,
    matches,
    ...(typeof costCredits === "number" ? { costCredits } : {}),
  };
};

export const addCaseToTotals = (totals: EvalTotals, caseLog: EvalCaseLog) => {
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

export const buildSummary = (totals: EvalTotals, datasetSize: number): EvalSummary => {
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

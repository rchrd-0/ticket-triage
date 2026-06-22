import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import type { ClassifierScorerResults } from "./classifier.scorers";

export type ClassifierEvalMatches = {
  category: boolean;
  needsHuman: boolean;
  urgency: boolean;
  confidence: boolean;
};

export type ClassifierEvalCaseLog = {
  ticketId: string;
  product: string;
  ok: boolean;
  latencyMs: number;
  actual: ClassifiedTicket;
  expected: ClassifiedTicket;
  matches: ClassifierEvalMatches;
  scorerResults: ClassifierScorerResults;
  costCredits?: number;
};

export type ClassifierEvalErrorLog = {
  ticketId: string;
  product: string;
  error: string;
};

export type ClassifierEvalTotals = {
  pass: number;
  fail: number;
  errors: number;
  categoryPass: number;
  needsHumanPass: number;
  urgencyPass: number;
  confidencePass: number;
  totalLatencyMs: number;
  totalCost: number;
  ticketsWithCost: number;
};

export type ClassifierEvalSummary = {
  pass: number;
  fail: number;
  errors: number;
  primaryAccuracy: number;
  category: { pass: number; total: number };
  needsHuman: { pass: number; total: number };
  urgency: { pass: number; total: number };
  confidence: { pass: number; total: number };
  avgLatencyMs: number;
  totalCostCredits: number;
  ticketsWithCost: number;
};

export type ClassifierEvalCaseOutcome =
  | { kind: "success"; caseLog: ClassifierEvalCaseLog }
  | { kind: "error"; errorLog: ClassifierEvalErrorLog };

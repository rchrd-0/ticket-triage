import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import type { Ticket } from "@/schemas/ticket.schema";

export type GoldenTicket = {
  ticket: Ticket;
  expected: ClassifiedTicket;
};

export type ClassificationMatches = {
  category: boolean;
  needsHuman: boolean;
  urgency: boolean;
  confidence: boolean;
};

export type EvalCaseLog = {
  ticketId: string;
  product: string;
  ok: boolean;
  latencyMs: number;
  actual: ClassifiedTicket;
  expected: ClassifiedTicket;
  matches: ClassificationMatches;
  costCredits?: number;
};

export type EvalErrorLog = {
  ticketId: string;
  product: string;
  error: string;
};

export type EvalTotals = {
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

export type EvalSummary = {
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

export type EvalCaseOutcome =
  | { kind: "success"; caseLog: EvalCaseLog }
  | { kind: "error"; errorLog: EvalErrorLog };

export type EvalLogger = {
  child(bindings: Record<string, unknown>): EvalLogger;
  debug(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
};

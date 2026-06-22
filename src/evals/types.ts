import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import type {
  InvestigationSource,
  InvestigationTerminationReason,
} from "@/schemas/investigation.schema";
import type { Ticket } from "@/schemas/ticket.schema";

export type GoldenTicket = {
  ticket: Ticket;
  expected: ClassifiedTicket;
};

type BaseDrafterGroundingCase = {
  terminationReason: InvestigationTerminationReason;
  sources: InvestigationSource[];
};

type GoldenDrafterGroundingCase = BaseDrafterGroundingCase & {
  ticketId: string;
};

type InlineDrafterGroundingCase = BaseDrafterGroundingCase & {
  ticket: Ticket;
  classification: ClassifiedTicket;
};

export type DrafterGroundingCase = GoldenDrafterGroundingCase | InlineDrafterGroundingCase;

export type ReplyQualityManualScores = {
  groundedness: 1 | 2 | 3;
  actionability: 1 | 2 | 3;
  policySafety: 1 | 2 | 3;
  tone: 1 | 2 | 3;
  provenanceDiscipline: 1 | 2 | 3;
};

export type ReplyQualityManualCase = {
  caseId: string;
  scores: ReplyQualityManualScores;
  notes: string;
};

export type EvalLogger = {
  child(bindings: Record<string, unknown>): EvalLogger;
  debug(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
};

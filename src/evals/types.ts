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

export type DrafterGroundingCase = {
  ticketId: string;
  terminationReason: InvestigationTerminationReason;
  sources: InvestigationSource[];
};

export type EvalLogger = {
  child(bindings: Record<string, unknown>): EvalLogger;
  debug(obj: Record<string, unknown>, msg: string): void;
  error(obj: Record<string, unknown>, msg: string): void;
  info(obj: Record<string, unknown>, msg: string): void;
  warn(obj: Record<string, unknown>, msg: string): void;
};

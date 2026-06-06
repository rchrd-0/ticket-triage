import { type InferOutput, object, picklist } from "valibot";

export const ROUTE_PATHS = ["draft", "human_review"] as const;
export const ROUTE_REASONS = ["automatable", "classifier_requires_human"] as const;

export const RouteTicketSchema = object({
  path: picklist(ROUTE_PATHS),
  reason: picklist(ROUTE_REASONS),
});

export type RouteTicket = InferOutput<typeof RouteTicketSchema>;

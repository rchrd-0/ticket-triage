import { z } from "zod";

export const ROUTE_PATHS = ["draft", "human_review"] as const;
export const ROUTE_REASONS = ["automatable", "classifier_requires_human"] as const;

export const RouteTicketSchema = z.object({
  path: z.enum(ROUTE_PATHS),
  reason: z.enum(ROUTE_REASONS),
});

export type RouteTicket = z.infer<typeof RouteTicketSchema>;

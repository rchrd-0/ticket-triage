import {
  boolean,
  type InferOutput,
  maxValue,
  minValue,
  number,
  object,
  picklist,
  pipe,
} from "valibot";

export const TICKET_CATEGORIES = [
  "Hardware issue",
  "Software / app bug",
  "Connectivity issue",
  "Account access",
  "Data loss",
  "Refund request",
  "Security concern",
  "Billing and payment",
  "Shipping and delivery",
  "General inquiry",
] as const;

export const URGENCY_VALUES = ["low", "medium", "high"] as const;

export const ClassifyTicketSchema = object({
  category: picklist(TICKET_CATEGORIES),
  urgency: picklist(URGENCY_VALUES),
  needsHuman: boolean(),
  confidence: pipe(number(), minValue(0), maxValue(1)),
});

export type ClassifiedTicket = InferOutput<typeof ClassifyTicketSchema>;

import {
  boolean,
  type InferOutput,
  maxValue,
  minValue,
  number,
  object,
  picklist,
  pipe,
  enum as vnum,
} from "valibot";

export const TICKET_CATEGORIES = {
  hardware_issue: "Hardware issue",
  software_bug: "Software / app bug",
  connectivity_issue: "Connectivity issue",
  account_access: "Account access",
  data_loss: "Data loss",
  refund_request: "Refund request",
  security_concern: "Security concern",
  billing_payment: "Billing and payment",
  shipping_delivery: "Shipping and delivery",
  // generic fallback category -> expect to tune model for this one
  general_inquiry: "General inquiry",
} as const;

export const URGENCY_VALUES = ["low", "medium", "high"] as const;

export const ClassifyTicketSchema = object({
  category: vnum(TICKET_CATEGORIES),
  urgency: picklist(URGENCY_VALUES),
  needsHuman: boolean(),
  confidence: pipe(number(), minValue(0), maxValue(1)),
});

export type ClassifiedTicket = InferOutput<typeof ClassifyTicketSchema>;

import { z } from "zod";

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

export const ClassifyTicketSchema = z.object({
  category: z
    .enum(TICKET_CATEGORIES)
    .describe(
      "Primary routing category. Prefer a specific category when the ticket has clear signal; use General inquiry for policy questions, general questions, or low-signal tickets without enough detail to route confidently."
    ),
  urgency: z
    .enum(URGENCY_VALUES)
    .describe(
      "Ticket priority. high = active financial harm, data loss, fraud, or same-day critical blockage; medium = affects use/work without immediate deadline; low = policy/general question or no time pressure."
    ),
  needsHuman: z
    .boolean()
    .describe(
      "Whether a human-only action is required. true for physical RMA judgment, active fraud/account takeover, manual data recovery, or policy exceptions; false when KB/SOP/policy can handle it, even if the issue sounds serious."
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Self-reported certainty from 0 to 1. Use high confidence for clear signals, medium confidence for ambiguous boundaries, and low confidence for low-signal fallback cases."
    ),
});

export type ClassifiedTicket = z.infer<typeof ClassifyTicketSchema>;

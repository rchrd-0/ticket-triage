import { z } from "zod";

export const TICKET_CHANNELS = ["email", "chat", "phone", "social"] as const;

export const TicketSchema = z.object({
  id: z.string(),
  channel: z.enum(TICKET_CHANNELS),
  product: z.string(),
  body: z.string(),
  customer: z.object({
    name: z.string(),
    email: z.string(),
  }),
});

export type Ticket = z.infer<typeof TicketSchema>;

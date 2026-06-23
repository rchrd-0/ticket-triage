import type { RouteTicket } from "@/schemas/route-ticket.schema";
import type { Ticket } from "@/schemas/ticket.schema";

export type SupportWebhookTicket = {
  eventId: string;
  source: "support_webhook";
  receivedAt: string;
  ticket: Ticket;
  expected: {
    routePath: RouteTicket["path"];
    hasReply: boolean;
  };
};

export const adapterDemoTickets: SupportWebhookTicket[] = [
  {
    eventId: "evt-demo-draft-001",
    source: "support_webhook",
    receivedAt: "2026-06-23T08:00:00.000Z",
    ticket: {
      id: "demo-draft-001",
      channel: "email",
      product: "Dyson V15 Detect",
      body: "Hi, my order ORD-88421 was supposed to arrive already, but the tracking has not moved. Can you check what is happening?",
      customer: {
        name: "Jamie Chen",
        email: "jamie@example.com",
      },
    },
    expected: {
      routePath: "draft",
      hasReply: true,
    },
  },
  {
    eventId: "evt-demo-human-review-001",
    source: "support_webhook",
    receivedAt: "2026-06-23T08:00:00.000Z",
    ticket: {
      id: "demo-human-review-001",
      channel: "email",
      product: "Shopify admin",
      body: "I think someone broke into my account and changed the payout bank details. Please lock this down immediately and help me recover access.",
      customer: {
        name: "Morgan Lee",
        email: "morgan@example.com",
      },
    },
    expected: {
      routePath: "human_review",
      hasReply: false,
    },
  },
];

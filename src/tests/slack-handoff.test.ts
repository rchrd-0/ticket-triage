import { describe, expect, test } from "bun:test";
import { createSlackHandoffMessage } from "@/demo/slack-handoff";
import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import type { DraftReply } from "@/schemas/draft-reply.schema";
import type { RouteTicket } from "@/schemas/route-ticket.schema";
import type { Ticket } from "@/schemas/ticket.schema";

const ticket: Ticket = {
  id: "demo-draft-001",
  channel: "email",
  product: "Dyson V15 Detect",
  body: "Hi, my order ORD-88421 was supposed to arrive already, but the tracking has not moved.",
  customer: {
    name: "Jamie Chen",
    email: "jamie@example.com",
  },
};

const classification: ClassifiedTicket = {
  category: "Shipping and delivery",
  urgency: "medium",
  needsHuman: false,
  confidence: 0.94,
};

const draftRoute: RouteTicket = {
  path: "draft",
  reason: "automatable",
};

const humanReviewRoute: RouteTicket = {
  path: "human_review",
  reason: "classifier_requires_human",
};

const reply: DraftReply = {
  subject: "Shipping delay",
  body: "Your package is still in transit. We can begin a delayed-shipment review.",
  groundingSourceIds: ["order-88421", "sop-shipping-delay-001"],
};

describe("Slack handoff mapper", () => {
  test("maps a draft route to a dry-run Slack message with reply details", () => {
    const handoff = createSlackHandoffMessage(ticket, {
      ticketId: ticket.id,
      classification,
      route: draftRoute,
      reply,
    });

    expect(handoff.dryRun).toBe(true);
    expect(handoff.channel).toBe("#support-triage");
    expect(handoff.triageRoute).toBe("draft");
    expect(handoff.metadata.groundingSourceIds).toEqual(["order-88421", "sop-shipping-delay-001"]);
    expect(JSON.stringify(handoff.blocks)).toContain("Proposed customer reply");
    expect(JSON.stringify(handoff.blocks)).toContain(reply.subject);
  });

  test("maps a human-review route without fabricating a reply", () => {
    const handoff = createSlackHandoffMessage(ticket, {
      ticketId: ticket.id,
      classification: {
        ...classification,
        category: "Security concern",
        urgency: "high",
        needsHuman: true,
      },
      route: humanReviewRoute,
    });

    const blocksText = JSON.stringify(handoff.blocks);

    expect(handoff.triageRoute).toBe("human_review");
    expect(handoff.metadata.needsHuman).toBe(true);
    expect(handoff.metadata.groundingSourceIds).toEqual([]);
    expect(blocksText).toContain("not generated");
    expect(blocksText).not.toContain("Proposed customer reply");
  });
});

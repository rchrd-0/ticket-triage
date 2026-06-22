import { describe, expect, test } from "bun:test";
import {
  replyQualityDeterministicPassed,
  runReplyQualityScorers,
} from "@/evals/reply-quality.scorers";
import type { ReplyQualityManualCase } from "@/evals/types";
import type { DraftReply } from "@/schemas/draft-reply.schema";
import type { InvestigationSource } from "@/schemas/investigation.schema";

const manualBaseline: ReplyQualityManualCase = {
  caseId: "reply-quality-test",
  scores: {
    groundedness: 3,
    actionability: 3,
    policySafety: 3,
    tone: 3,
    provenanceDiscipline: 3,
  },
  notes: "Test baseline.",
};

const sopSource: InvestigationSource = {
  sourceId: "sop-shipping-delay-001",
  sourceType: "sop",
  title: "Delayed shipment review",
  content: "Collect order details and follow the delayed-shipment review.",
};

const orderStatusSource: InvestigationSource = {
  sourceId: "order-88421",
  sourceType: "order_status",
  title: "Order ORD-88421 status",
  content: "Status: in_transit. Package remains in transit with no newer carrier scan.",
};

const scoreReply = (args: { reply: DraftReply; sources?: InvestigationSource[] }) =>
  runReplyQualityScorers({
    input: {
      caseId: manualBaseline.caseId,
      sources: args.sources ?? [sopSource],
      terminationReason: "completed",
    },
    output: args.reply,
    groundTruth: manualBaseline,
  });

describe("reply-quality scorers", () => {
  test("passes deterministic contracts for a grounded reply", async () => {
    const results = await scoreReply({
      reply: {
        subject: "Shipping delay",
        body: "Please share the order number so we can follow the delayed-shipment review.",
        groundingSourceIds: ["sop-shipping-delay-001"],
      },
    });

    expect(results["reply-provenance-contract"]?.score).toBe(1);
    expect(results["reply-presence-contract"]?.score).toBe(1);
    expect(results["unknown-order-guardrail"]?.score).toBe(1);
    expect(results["manual-baseline-reference"]?.score).toBe(3);
    expect(replyQualityDeterministicPassed(results)).toBe(true);
  });

  test("fails provenance when a reply cites an unsupplied source", async () => {
    const results = await scoreReply({
      reply: {
        subject: "Shipping delay",
        body: "We can help review the shipment.",
        groundingSourceIds: ["order-99999"],
      },
    });

    expect(results["reply-provenance-contract"]?.score).toBe(0);
    expect(replyQualityDeterministicPassed(results)).toBe(false);
  });

  test("fails no-source cases that cite sources", async () => {
    const results = await scoreReply({
      sources: [],
      reply: {
        subject: "Need more details",
        body: "Please send more information so we can route this correctly.",
        groundingSourceIds: ["kb-general-001"],
      },
    });

    expect(results["reply-provenance-contract"]?.score).toBe(0);
  });

  test("fails source-backed cases that omit citations", async () => {
    const results = await scoreReply({
      reply: {
        subject: "Shipping delay",
        body: "Please share the order number so we can follow the delayed-shipment review.",
        groundingSourceIds: [],
      },
    });

    expect(results["reply-provenance-contract"]?.score).toBe(0);
  });

  test("fails unsupported tracking-status language without an order-status source", async () => {
    const results = await scoreReply({
      reply: {
        subject: "Tracking update",
        body: "I checked the order and tracking has not updated recently.",
        groundingSourceIds: ["sop-shipping-delay-001"],
      },
    });

    expect(results["unknown-order-guardrail"]?.score).toBe(0);
    expect(replyQualityDeterministicPassed(results)).toBe(false);
  });

  test("allows tracking-status language when an order-status source is supplied", async () => {
    const results = await scoreReply({
      sources: [sopSource, orderStatusSource],
      reply: {
        subject: "Tracking update",
        body: "Tracking shows the package remains in transit with no newer carrier scan.",
        groundingSourceIds: ["order-88421", "sop-shipping-delay-001"],
      },
    });

    expect(results["unknown-order-guardrail"]?.score).toBe(1);
    expect(replyQualityDeterministicPassed(results)).toBe(true);
  });
});

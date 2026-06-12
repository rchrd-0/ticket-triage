import { describe, expect, test } from "bun:test";
import { ChunkFrom, type ToolCallChunk, type ToolResultChunk } from "@mastra/core/stream";
import { buildInvestigationResult } from "@/domain/build-investigation-result";

const toolCall = (
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>
): ToolCallChunk => ({
  type: "tool-call",
  runId: "test-run",
  from: ChunkFrom.AGENT,
  payload: { toolCallId, toolName, args },
});

const toolResult = (
  toolCallId: string,
  toolName: string,
  result: unknown,
  isError = false
): ToolResultChunk => ({
  type: "tool-result",
  runId: "test-run",
  from: ChunkFrom.AGENT,
  payload: { toolCallId, toolName, result, isError },
});

const kbResult = {
  articleId: "kb-shipping-001",
  title: "Delayed shipments",
  snippet: "Review the latest carrier event before discussing next steps.",
};

const sopResult = {
  sourceId: "sop-shipping-delay-001",
  title: "Shipping delay procedure",
  content: "Use the delayed-shipment review when tracking has stopped updating.",
};

const foundOrderResult = {
  found: true,
  orderId: "ORD-88421",
  sourceId: "order-88421",
  status: "in_transit",
  lastUpdated: "2026-06-02T08:40:00.000Z",
  trackingEvents: [
    {
      timestamp: "2026-06-02T08:40:00.000Z",
      description: "Package remains in transit.",
    },
  ],
  eligibleActions: ["Begin the standard delayed-shipment review."],
};

describe("buildInvestigationResult", () => {
  test("pairs calls and results by toolCallId while preserving call order", () => {
    const result = buildInvestigationResult({
      toolCalls: [
        toolCall("call-kb", "searchKb", {
          category: "Shipping and delivery",
          query: "delayed package tracking",
        }),
        toolCall("call-sop", "searchSop", { query: "delayed package procedure" }),
      ],
      toolResults: [
        toolResult("call-sop", "searchSop", [sopResult]),
        toolResult("call-kb", "searchKb", [kbResult]),
      ],
    });

    expect(result.toolCalls.map((call) => call.toolName)).toEqual(["searchKb", "searchSop"]);
    expect(result.toolCalls.map((call) => call.sourceIds)).toEqual([
      ["kb-shipping-001"],
      ["sop-shipping-delay-001"],
    ]);
  });

  test("normalizes KB, SOP, and found-order results into sources", () => {
    const result = buildInvestigationResult({
      toolCalls: [
        toolCall("call-kb", "searchKb", {
          category: "Shipping and delivery",
          query: "delayed package tracking",
        }),
        toolCall("call-sop", "searchSop", { query: "delayed package procedure" }),
        toolCall("call-order", "getOrderStatus", { orderId: "ord-88421" }),
      ],
      toolResults: [
        toolResult("call-kb", "searchKb", [kbResult]),
        toolResult("call-sop", "searchSop", [sopResult]),
        toolResult("call-order", "getOrderStatus", foundOrderResult),
      ],
    });

    expect(result.sources).toEqual([
      {
        sourceId: "kb-shipping-001",
        sourceType: "kb_article",
        title: "Delayed shipments",
        content: "Review the latest carrier event before discussing next steps.",
      },
      {
        sourceId: "sop-shipping-delay-001",
        sourceType: "sop",
        title: "Shipping delay procedure",
        content: "Use the delayed-shipment review when tracking has stopped updating.",
      },
      {
        sourceId: "order-88421",
        sourceType: "order_status",
        title: "Order ORD-88421 status",
        content:
          "Status: in_transit\nLast updated: 2026-06-02T08:40:00.000Z\nTracking events:\n- 2026-06-02T08:40:00.000Z: Package remains in transit.\nEligible actions:\n- Begin the standard delayed-shipment review.",
      },
    ]);
    expect(result.terminationReason).toBe("completed");
  });

  test("records an unknown order with no source IDs and incomplete context", () => {
    const result = buildInvestigationResult({
      toolCalls: [toolCall("call-order", "getOrderStatus", { orderId: "ord-99999" })],
      toolResults: [
        toolResult("call-order", "getOrderStatus", {
          found: false,
          orderId: "ORD-99999",
        }),
      ],
    });

    expect(result).toEqual({
      sources: [],
      toolCalls: [
        {
          toolName: "getOrderStatus",
          input: { orderId: "ord-99999" },
          sourceIds: [],
        },
      ],
      terminationReason: "incomplete_context",
    });
  });

  test("deduplicates repeated sources by sourceId", () => {
    const result = buildInvestigationResult({
      toolCalls: [
        toolCall("call-one", "searchKb", {
          category: "Shipping and delivery",
          query: "delayed package tracking",
        }),
        toolCall("call-two", "searchKb", {
          category: "Shipping and delivery",
          query: "package has no new scan",
        }),
      ],
      toolResults: [
        toolResult("call-one", "searchKb", [kbResult]),
        toolResult("call-two", "searchKb", [kbResult]),
      ],
    });

    expect(result.sources).toEqual([
      {
        sourceId: "kb-shipping-001",
        sourceType: "kb_article",
        title: "Delayed shipments",
        content: "Review the latest carrier event before discussing next steps.",
      },
    ]);
    expect(result.toolCalls.map((call) => call.sourceIds)).toEqual([
      ["kb-shipping-001"],
      ["kb-shipping-001"],
    ]);
  });

  test("does not treat failed or missing tool results as evidence", () => {
    const result = buildInvestigationResult({
      toolCalls: [
        toolCall("failed-call", "searchKb", {
          category: "Shipping and delivery",
          query: "delayed package tracking",
        }),
        toolCall("missing-call", "searchSop", {
          query: "delayed package procedure",
        }),
      ],
      toolResults: [toolResult("failed-call", "searchKb", [kbResult], true)],
    });

    expect(result.sources).toEqual([]);
    expect(result.toolCalls.map((call) => call.sourceIds)).toEqual([[], []]);
    expect(result.terminationReason).toBe("incomplete_context");
  });
});

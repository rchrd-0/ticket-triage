import type { FoundOrderStatusResult } from "@/schemas/get-order-status.schema";
import type { InvestigationSource } from "@/schemas/investigation.schema";
import type { SearchKbResult } from "@/schemas/search-kb.schema";
import type { SearchSopResult } from "@/schemas/search-sop.schema";

export const kbResultToInvestigationSource = (result: SearchKbResult): InvestigationSource => ({
  sourceType: "kb_article",
  sourceId: result.articleId,
  title: result.title,
  content: result.snippet,
});

export const sopResultToInvestigationSource = (result: SearchSopResult): InvestigationSource => ({
  sourceType: "sop",
  sourceId: result.sourceId,
  title: result.title,
  content: result.content,
});

export const orderResultToInvestigationSource = (
  result: FoundOrderStatusResult
): InvestigationSource => ({
  sourceType: "order_status",
  sourceId: result.sourceId,
  title: `Order ${result.orderId} status`,
  content: [
    `Status: ${result.status}`,
    `Last updated: ${result.lastUpdated}`,
    "Tracking events:",
    ...result.trackingEvents.map((event) => `- ${event.timestamp}: ${event.description}`),
    "Eligible actions:",
    ...result.eligibleActions.map((action) => `- ${action}`),
  ].join("\n"),
});

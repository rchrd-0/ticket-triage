import { describe, expect, test } from "bun:test";
import { kbArticles } from "@/fixtures/kb-articles";
import { orders } from "@/fixtures/orders";
import rawOrders from "@/fixtures/orders.json";
import { sops } from "@/fixtures/sops";
import rawSops from "@/fixtures/sops.json";

describe("investigation fixtures", () => {
  test("parses every curated SOP fixture", () => {
    expect(sops).toHaveLength(rawSops.length);
  });
  test("parses every curated order fixture", () => {
    expect(orders).toHaveLength(rawOrders.length);
  });
  test("uses globally unique source IDs across KB, SOP, and order fixtures", () => {
    const sopSourceIds = sops.map((sop) => sop.sopId);
    const orderSourceIds = orders.map((order) => order.sourceId);
    const kbArticleIds = kbArticles.map((article) => article.articleId);

    const allIds = [...sopSourceIds, ...orderSourceIds, ...kbArticleIds];

    expect(allIds.length).toBe(new Set(allIds).size);
  });
  test("keeps tracking events in chronological order", () => {
    for (const order of orders) {
      const timestamps = order.trackingEvents.map((event) => new Date(event.timestamp).getTime());
      const sortedTimestamps = [...timestamps].sort((a, b) => a - b);

      expect(timestamps).toEqual(sortedTimestamps);
    }
  });
  test("there are no duplicate orderIds across orders", () => {
    const orderIds = orders.map((order) => order.orderId);
    const uniqueOrderIds = new Set(orderIds);

    expect(uniqueOrderIds.size).toBe(orderIds.length);
  });
  test("each order's lastUpdated is greater than or equal to the latest tracking event's timestamp", () => {
    for (const order of orders) {
      const lastUpdated = new Date(order.lastUpdated).getTime();
      const latestTrackingEventTime = Math.max(
        ...order.trackingEvents.map((event) => new Date(event.timestamp).getTime())
      );

      expect(lastUpdated).toBeGreaterThanOrEqual(latestTrackingEventTime);
    }
  });
});

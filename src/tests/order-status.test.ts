import { describe, expect, test } from "bun:test";
import { orders } from "@/fixtures/orders";
import { getOrderStatusCore } from "@/lib/order-status";
import { GetOrderStatusSchema } from "@/schemas/get-order-status.schema";

describe("getOrderStatusCore", () => {
  test("normalizes a valid order ID before exact lookup", () => {
    const input = GetOrderStatusSchema.parse({ orderId: "  ord-88421  " });

    const result = getOrderStatusCore(input);

    expect(result.found).toBe(true);
    expect(result.orderId).toBe("ORD-88421");
  });

  test("returns the matching fixture-backed order", () => {
    const expectedOrder = orders.find((order) => order.orderId === "ORD-55102");
    const input = GetOrderStatusSchema.parse({ orderId: "ORD-55102" });

    const result = getOrderStatusCore(input);

    expect(expectedOrder).toBeDefined();
    if (!expectedOrder) {
      throw new Error("Expected order fixture ORD-55102");
    }
    expect(result).toEqual({
      found: true,
      ...expectedOrder,
    });
  });

  test("returns found false for a valid unknown order ID", () => {
    const input = GetOrderStatusSchema.parse({ orderId: "ord-99999" });

    const result = getOrderStatusCore(input);

    expect(result).toEqual({
      found: false,
      orderId: "ORD-99999",
    });
  });

  test("does not infer or synthesize tracking events", () => {
    const expectedOrder = orders.find((order) => order.orderId === "ORD-73291");
    const input = GetOrderStatusSchema.parse({ orderId: "ORD-73291" });

    const result = getOrderStatusCore(input);

    expect(expectedOrder).toBeDefined();
    expect(result.found).toBe(true);
    if (result.found && expectedOrder) {
      expect(result.trackingEvents).toEqual(expectedOrder.trackingEvents);
      expect(result.eligibleActions).toEqual(expectedOrder.eligibleActions);
    }
  });

  test("does not mutate the parsed order fixtures", () => {
    const fixturesBeforeLookup = structuredClone(orders);
    const input = GetOrderStatusSchema.parse({ orderId: "ORD-66014" });

    getOrderStatusCore(input);

    expect(orders).toEqual(fixturesBeforeLookup);
  });
});

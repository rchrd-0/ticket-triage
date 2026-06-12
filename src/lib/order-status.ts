import { orders } from "@/fixtures/orders";
import type {
  GetOrderStatusResult,
  ParsedGetOrderStatusInput,
} from "@/schemas/get-order-status.schema";

const normalizeOrderId = (orderId: string): string => orderId.trim().toUpperCase();

export const getOrderStatusCore = (input: ParsedGetOrderStatusInput): GetOrderStatusResult => {
  const normalizedOrderId = normalizeOrderId(input.orderId);

  const matchingOrder = orders.find(
    (order) => normalizeOrderId(order.orderId) === normalizedOrderId
  );

  if (matchingOrder) {
    return {
      found: true,
      ...matchingOrder,
    };
  }

  return {
    found: false,
    orderId: normalizedOrderId,
  };
};

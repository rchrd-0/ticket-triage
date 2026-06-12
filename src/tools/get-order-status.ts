import { createTool } from "@mastra/core/tools";
import logger from "@/lib/logger";
import { getOrderStatusCore } from "@/lib/order-status";
import {
  type GetOrderStatusInput,
  type GetOrderStatusResult,
  GetOrderStatusResultSchema,
  GetOrderStatusSchema,
} from "@/schemas/get-order-status.schema";

export const getOrderStatus = (input: GetOrderStatusInput): GetOrderStatusResult => {
  const startedAt = performance.now();
  const parsedInput = GetOrderStatusSchema.parse(input);

  const result = getOrderStatusCore(parsedInput);

  logger.info(
    {
      tool: "get-order-status",
      durationMs: Math.round(performance.now() - startedAt),
      normalizedOrderId: result.orderId,
      found: result.found,
    },
    "Order status lookup completed"
  );

  return result;
};

export const getOrderStatusTool = createTool({
  id: "get-order-status-tool",
  description:
    "Looks up a customer order by ID and returns its fixture-backed fulfillment status, tracking history, and eligible support actions.",
  inputSchema: GetOrderStatusSchema,
  outputSchema: GetOrderStatusResultSchema,
  execute: (inputData: GetOrderStatusInput) => Promise.resolve(getOrderStatus(inputData)),
});

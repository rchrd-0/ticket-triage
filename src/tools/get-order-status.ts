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
      event: "tool.get_order_status.completed",
      tool: "get_order_status",
      durationMs: Math.round(performance.now() - startedAt),
      sourceIds: result.found ? [result.sourceId] : [],
      orderId: result.orderId,
      found: result.found,
    },
    "Tool call completed"
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

import { createTool } from "@mastra/core/tools";
import { MCPServer } from "@mastra/mcp";
import { z } from "zod";
import type { GetOrderStatusInput } from "@/schemas/get-order-status.schema";
import type { SearchKbInput } from "@/schemas/search-kb.schema";
import type { SearchSopInput } from "@/schemas/search-sop.schema";
import { getOrderStatus, getOrderStatusTool } from "@/tools/get-order-status";
import { searchKb, searchKbTool } from "@/tools/search-kb";
import { searchSop, searchSopTool } from "@/tools/search-sop";

const searchKbMcpTool = createTool({
  id: `${searchKbTool.id}-mcp`,
  description: searchKbTool.description,
  inputSchema: searchKbTool.inputSchema,
  outputSchema: z.object({
    results: searchKbTool.outputSchema,
  }),
  execute: (inputData: SearchKbInput) => Promise.resolve({ results: searchKb(inputData) }),
});

const searchSopMcpTool = createTool({
  id: `${searchSopTool.id}-mcp`,
  description: searchSopTool.description,
  inputSchema: searchSopTool.inputSchema,
  outputSchema: z.object({
    results: searchSopTool.outputSchema,
  }),
  execute: (inputData: SearchSopInput) => Promise.resolve({ results: searchSop(inputData) }),
});

const getOrderStatusMcpTool = createTool({
  id: `${getOrderStatusTool.id}-mcp`,
  description: getOrderStatusTool.description,
  inputSchema: getOrderStatusTool.inputSchema,
  outputSchema: z.object({
    result: getOrderStatusTool.outputSchema,
  }),
  execute: (inputData: GetOrderStatusInput) =>
    Promise.resolve({ result: getOrderStatus(inputData) }),
});

export const supportContextMcp = new MCPServer({
  id: "support-context-mcp",
  name: "Support Context Tools",
  version: "1.0.0",
  tools: {
    search_kb: searchKbMcpTool,
    search_sop: searchSopMcpTool,
    get_order_status: getOrderStatusMcpTool,
  },
});

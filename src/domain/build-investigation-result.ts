import type { ToolCallChunk, ToolResultChunk } from "@mastra/core/stream";
import type { GetOrderStatusResult } from "@/schemas/get-order-status.schema";
import {
  type InvestigationResult,
  InvestigationResultSchema,
  type InvestigationSource,
  type InvestigationToolCall,
} from "@/schemas/investigation.schema";
import type { SearchKbResult } from "@/schemas/search-kb.schema";
import type { SearchSopResult } from "@/schemas/search-sop.schema";
import {
  kbResultToInvestigationSource,
  orderResultToInvestigationSource,
  sopResultToInvestigationSource,
} from "./investigation-sources";

export type BuildInvestigationResultInput = {
  toolCalls: ToolCallChunk[];
  toolResults: ToolResultChunk[];
};

type NormalizedToolResult = {
  sources: InvestigationSource[];

  // A valid result can still say that the requested evidence was unavailable.
  // Currently this represents a valid order lookup with found: false.
  hasMissingContext: boolean;
};

// Mastra has already validated each result against the tool's outputSchema.
// This function only converts the three tool-specific shapes into one shape.
const normalizeToolResult = (
  toolName: InvestigationToolCall["toolName"],
  result: unknown
): NormalizedToolResult => {
  switch (toolName) {
    case "searchKb":
      return {
        sources: (result as SearchKbResult[]).map(kbResultToInvestigationSource),
        hasMissingContext: false,
      };
    case "searchSop":
      return {
        sources: (result as SearchSopResult[]).map(sopResultToInvestigationSource),
        hasMissingContext: false,
      };
    case "getOrderStatus": {
      const orderResult = result as GetOrderStatusResult;

      return {
        sources: orderResult.found ? [orderResultToInvestigationSource(orderResult)] : [],
        hasMissingContext: !orderResult.found,
      };
    }
    default:
      throw new Error(`Unsupported investigation tool: ${toolName}`);
  }
};

/*
 * Convert Mastra's execution transcript into the small, trusted domain result
 * consumed by later workflow steps.
 *
 * Mastra owns tool-input validation and execution limits. Investigator evals
 * own tool-selection quality and duplicate-call detection. This builder only:
 *
 * - pairs calls with results
 * - normalizes successful evidence
 * - records call provenance
 * - reports whether an attempted lookup lacked usable evidence
 */
export const buildInvestigationResult = (
  input: BuildInvestigationResultInput
): InvestigationResult => {
  // Calls and results are separate arrays, so pair them by their stable ID
  // rather than assuming both arrays have matching indexes.
  const toolResultsByCallId = new Map(
    input.toolResults.map((result) => [result.payload.toolCallId, result])
  );
  const sourcesById = new Map<string, InvestigationSource>();
  const toolCalls: InvestigationToolCall[] = [];

  let hasMissingContext = false;

  for (const toolCall of input.toolCalls) {
    // The agent exposes only these three registered tools. Mastra's generic
    // transcript type widens toolName to string, so restore the known union.
    const toolName = toolCall.payload.toolName as InvestigationToolCall["toolName"];

    // Mastra has already validated these arguments against the tool's input
    // schema. The final InvestigationResult parse still verifies object shape.
    const toolInput = (toolCall.payload.args ?? {}) as Record<string, unknown>;
    const toolResult = toolResultsByCallId.get(toolCall.payload.toolCallId);

    // Failed or missing results remain visible as attempted calls, but cannot
    // contribute evidence.
    if (!toolResult || toolResult.payload.isError || toolResult.payload.toolName !== toolName) {
      hasMissingContext = true;
      toolCalls.push({ toolName, input: toolInput, sourceIds: [] });
      continue;
    }

    const normalizedResult = normalizeToolResult(toolName, toolResult.payload.result);
    const sourceIds = normalizedResult.sources.map((source) => source.sourceId);
    toolCalls.push({ toolName, input: toolInput, sourceIds });

    // Different searches may return the same article or procedure. Preserve
    // both calls as provenance while storing each source body only once.
    for (const source of normalizedResult.sources) {
      if (!sourcesById.has(source.sourceId)) {
        sourcesById.set(source.sourceId, source);
      }
    }

    hasMissingContext ||= normalizedResult.hasMissingContext;
  }

  return InvestigationResultSchema.parse({
    sources: [...sourcesById.values()],
    toolCalls,
    terminationReason: hasMissingContext ? "incomplete_context" : "completed",
  });
};

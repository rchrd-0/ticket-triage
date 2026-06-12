import { Agent } from "@mastra/core/agent";
import { investigator } from "@/config/models";
import { buildInvestigationResult } from "@/domain/build-investigation-result";
import logger from "@/lib/logger";
import { buildInvestigationPrompt, investigatorSystemPrompt } from "@/prompts/investigator.prompt";
import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import type { InvestigationResult } from "@/schemas/investigation.schema";
import type { Ticket } from "@/schemas/ticket.schema";
import { getOrderStatusTool } from "@/tools/get-order-status";
import { searchKbTool } from "@/tools/search-kb";
import { searchSopTool } from "@/tools/search-sop";

export const investigatorAgent = new Agent({
  id: "investigator-agent",
  name: "Investigator",
  description: "Gathers read-only support context before a customer reply is drafted.",
  instructions: investigatorSystemPrompt,
  model: `openrouter/${investigator.agentModel}`,
  tools: {
    searchKb: searchKbTool,
    searchSop: searchSopTool,
    getOrderStatus: getOrderStatusTool,
  },
  defaultOptions: {
    modelSettings: {
      temperature: investigator.temperature,
    },
    providerOptions: {
      openrouter: {
        reasoning: investigator.reasoning,
      },
    },
  },
});

// ticket + classification
// → model chooses tools
// → tools execute
// → pair calls with results
// → validate each result
// → normalize into sources
// → schema-validate
// → return trusted InvestigationResult
export const investigateTicket = async (
  ticket: Ticket,
  classification: ClassifiedTicket
): Promise<InvestigationResult> => {
  const prompt = buildInvestigationPrompt({ ticket, classification });

  const response = await investigatorAgent.generate(prompt, {
    activeTools: ["searchKb", "searchSop", "getOrderStatus"],
    toolChoice: "auto",
    maxSteps: 5,
  });

  const investigationResult = buildInvestigationResult({
    toolCalls: response.toolCalls,
    toolResults: response.toolResults,
  });

  logger.info(
    {
      toolCallCount: investigationResult.toolCalls.length,
      toolNames: investigationResult.toolCalls.map((call) => call.toolName),
      sourceIds: investigationResult.sources.map((source) => source.sourceId),
      terminationReason: investigationResult.terminationReason,
    },
    "Ticket investigation completed"
  );

  return investigationResult;
};

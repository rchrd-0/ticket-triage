import { z } from "zod";

export const InvestigationResultSchema = z
  .object({
    sources: z
      .array(
        z.object({
          sourceId: z.string(),
          sourceType: z.enum(["kb_article", "sop", "order_status"]),
          title: z.string(),
          content: z.string(),
        })
      )
      .describe("Deduplicated sources gathered from actual tool results."),
    toolCalls: z
      .array(
        z.object({
          toolName: z.enum(["searchKb", "searchSop", "getOrderStatus"]),
          input: z.record(z.string(), z.unknown()),
          sourceIds: z.array(z.string()),
        })
      )
      .describe("Executed tool calls in their original order."),
    terminationReason: z
      .enum(["completed", "incomplete_context"])
      .describe("Whether every attempted lookup supplied usable evidence."),
  })
  .describe("Normalized output of the bounded investigation step.");

export type InvestigationResult = z.infer<typeof InvestigationResultSchema>;
export type InvestigationSource = InvestigationResult["sources"][number];
export type InvestigationSourceType = InvestigationSource["sourceType"];
export type InvestigationToolCall = InvestigationResult["toolCalls"][number];
export type InvestigationToolName = InvestigationToolCall["toolName"];
export type InvestigationTerminationReason = InvestigationResult["terminationReason"];

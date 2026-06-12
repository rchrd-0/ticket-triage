import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import logger from "@/lib/logger";
import { searchSopCore } from "@/lib/sop-search";
import {
  type SearchSopInput,
  type SearchSopResult,
  SearchSopResultSchema,
  SearchSopSchema,
} from "@/schemas/search-sop.schema";

export const searchSop = (input: SearchSopInput): SearchSopResult[] => {
  const startedAt = performance.now();
  const parsedInput = SearchSopSchema.parse(input);
  const results = searchSopCore(parsedInput);

  logger.info(
    {
      tool: "search-sop",
      durationMs: Math.round(performance.now() - startedAt),
      resultCount: results.length,
      sourceIds: results.map((result) => result.sourceId),
    },

    "SOP search completed"
  );

  return results;
};

export const searchSopTool = createTool({
  id: "search-sop-tool",
  description:
    "Searches approved support procedures and returns source IDs, titles, and operational guidance for grounded investigation.",
  inputSchema: SearchSopSchema,
  outputSchema: z.array(SearchSopResultSchema),
  execute: (inputData: SearchSopInput) => Promise.resolve(searchSop(inputData)),
});

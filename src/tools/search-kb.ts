import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchKbCore } from "@/lib/kb-search";
import logger from "@/lib/logger";
import {
  type SearchKbInput,
  type SearchKbResult,
  SearchKbResultSchema,
  SearchKbSchema,
} from "@/schemas/search-kb.schema";

export const searchKb = (input: SearchKbInput): SearchKbResult[] => {
  const startedAt = performance.now();
  const parsedInput = SearchKbSchema.parse(input);
  const results = searchKbCore(parsedInput);

  logger.info(
    {
      tool: "search-kb",
      category: parsedInput.category,
      durationMs: Math.round(performance.now() - startedAt),
      resultCount: results.length,
      articleIds: results.map((result) => result.articleId),
    },
    "KB search completed"
  );

  return results;
};

export const searchKbTool = createTool({
  id: "search-kb-tool",
  description:
    "Searches support knowledge-base articles and returns article IDs, titles, and snippets for grounded drafting.",
  inputSchema: SearchKbSchema,
  outputSchema: z.array(SearchKbResultSchema),
  execute: (inputData: SearchKbInput) => {
    // type inference broken re: https://github.com/mastra-ai/mastra/pull/17011
    return Promise.resolve(searchKb(inputData));
  },
});

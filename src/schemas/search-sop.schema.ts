import { z } from "zod";

export const DEFAULT_SEARCH_SOP_LIMIT = 3;
export const MAX_SEARCH_SOP_LIMIT = 5;

export const SearchSopSchema = z
  .object({
    query: z
      .string()
      .min(5)
      .describe(
        "Short issue-focused query for finding the relevant support procedure. Exclude customer details and unrelated ticket text."
      ),
    limit: z
      .int()
      .positive()
      .max(MAX_SEARCH_SOP_LIMIT)
      .default(DEFAULT_SEARCH_SOP_LIMIT)
      .describe("Maximum number of focused SOP results to return."),
  })
  .describe("Input for searching approved support procedures.");

export const SearchSopResultSchema = z
  .object({
    sourceId: z.string().describe("Stable grounding ID of the matched procedure."),
    title: z.string().min(1).describe("Title of the matched support procedure."),
    content: z.string().min(1).describe("Approved operational guidance and decision boundaries."),
  })
  .describe("One support procedure returned for grounded investigation.");

export type SearchSopInput = z.input<typeof SearchSopSchema>;
export type ParsedSearchSopInput = z.output<typeof SearchSopSchema>;
export type SearchSopResult = z.infer<typeof SearchSopResultSchema>;

import { z } from "zod";
import { TicketCategoriesEnum } from "@/schemas/classify-ticket.schema";

export const DEFAULT_SEARCH_KB_LIMIT = 3;

export const SearchKbSchema = z
  .object({
    category: TicketCategoriesEnum.describe(
      "The classifier category for the ticket. Used as a retrieval boost, not as a hard filter; relevant KB articles from other categories may still be returned."
    ),

    query: z
      .string()
      .min(5)
      .describe(
        "A short, sanitized search query derived from the ticket issue. Should not include customer email, secrets, or the full raw ticket body."
      ),

    limit: z
      .number()
      .int()
      .positive()
      .max(5)
      .default(DEFAULT_SEARCH_KB_LIMIT)
      .describe(
        "Maximum number of KB results to return. Keep this small so the drafter receives focused context."
      ),
  })
  .describe(
    "Input for the KB search tool. Searches support knowledge-base articles and returns article IDs, titles, and snippets for grounded drafting."
  );

export type SearchKbInput = z.input<typeof SearchKbSchema>;

export const SearchKbResultSchema = z.object({
  articleId: z.string().describe("Unique identifier for the KB article."),
  title: z.string().describe("Title of the KB article."),
  snippet: z
    .string()
    .describe(
      "A short excerpt from the KB article content that is relevant to the search query. Should be concise and informative to help the drafter understand the article's relevance."
    ),
});

export type SearchKbResult = z.infer<typeof SearchKbResultSchema>;

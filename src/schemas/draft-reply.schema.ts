import { z } from "zod";

export const DraftReplySchema = z.object({
  subject: z
    .string()
    .min(1)
    .describe("Short customer-facing email subject. Do not include internal labels."),
  body: z
    .string()
    .min(1)
    .describe(
      "Customer-facing support reply. Be concise, helpful, and do not expose internal classification or routing labels."
    ),
  citedArticleIds: z
    .array(z.string())
    .describe(
      "IDs of KB articles explicitly provided as context. If no KB article or context is provided, return []. Do not fabricate citations."
    ),
});

export type DraftReply = z.infer<typeof DraftReplySchema>;

import { array, type InferOutput, metadata, minLength, object, pipe, string } from "valibot";

export const DraftReplySchema = object({
  subject: pipe(
    string(),
    minLength(1),
    metadata({
      description: "Short customer-facing email subject. Do not include internal labels.",
    })
  ),
  body: pipe(
    string(),
    minLength(1),
    metadata({
      description:
        "Customer-facing support reply. Be concise, helpful, and do not expose internal classification or routing labels.",
    })
  ),
  citedArticleIds: pipe(
    array(string()),
    metadata({
      description:
        "IDs of KB articles explicitly provided as context. If no KB article or context is provided, return []. Do not fabricate citations.",
    })
  ),
});

export type DraftReply = InferOutput<typeof DraftReplySchema>;

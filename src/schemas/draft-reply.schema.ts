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
  groundingSourceIds: z
    .array(z.string())
    .describe(
      "IDs of supplied investigation sources used to ground the reply. Must be a subset of the provided source IDs. Return [] when no useful source was used."
    ),
});

export type DraftReply = z.infer<typeof DraftReplySchema>;

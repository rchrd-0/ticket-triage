import { z } from "zod";

export const SopSchema = z
  .object({
    sopId: z.string().startsWith("sop-").describe("Stable ID of the support procedure."),
    title: z.string().min(1).describe("Short searchable procedure title."),
    content: z.string().min(1).describe("Approved operational guidance and boundaries."),
    keywords: z
      .array(z.string().min(1))
      .min(1)
      .describe("Curated terms used to retrieve this procedure."),
  })
  .describe("Curated standard operating procedure used during support investigation.");

export type Sop = z.infer<typeof SopSchema>;

import { z } from "zod";
import { TicketCategoriesEnum } from "@/schemas/classify-ticket.schema";

export const KbArticleSchema = z
  .object({
    articleId: z.string().startsWith("kb-").describe("Stable ID of the knowledge-base article."),
    category: TicketCategoriesEnum.describe("Primary support category for retrieval boosting."),
    title: z.string().min(1).describe("Short searchable article title."),
    content: z.string().min(1).describe("Approved troubleshooting or support guidance."),
  })
  .describe("Curated support knowledge-base article.");

export type KbArticle = z.infer<typeof KbArticleSchema>;

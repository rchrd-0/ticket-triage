import type { TicketCategories } from "@/schemas/classify-ticket.schema";

export type KbArticle = {
  articleId: string;
  category: TicketCategories;
  title: string;
  content: string;
};

import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";

export type KbArticle = {
  articleId: string;
  category: ClassifiedTicket["category"];
  title: string;
  content: string;
};

export type KbSearchResult = {
  articleId: string;
  title: string;
  snippet: string;
};

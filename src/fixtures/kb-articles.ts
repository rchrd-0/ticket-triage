import { KbArticleSchema } from "@/schemas/kb-article.schema";
import rawKbArticles from "./kb-articles.json";

export const kbArticles = KbArticleSchema.array().parse(rawKbArticles);

import type { KbArticle } from "@/domain/kb";
import rawKbArticles from "./kb-articles.json";

export const kbArticles = rawKbArticles as KbArticle[];

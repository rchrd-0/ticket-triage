import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { z } from "zod";
import type { KbArticle } from "@/domain/kb";
import type { TicketCategories } from "@/schemas/classify-ticket.schema";
import type { SearchKbResult, SearchKbSchema } from "@/schemas/search-kb.schema";

const MINIMUM_SCORE = 2;
const SNIPPET_LENGTH = 220;

type ParsedSearchKbInput = z.output<typeof SearchKbSchema>;

const WORD_REGEX = /[a-z0-9]+/g;
const NON_WORD_REGEX = /[^a-z0-9]+/g;
const SENTENCE_BOUNDARY_REGEX = /(?<=[.!?])\s+/;

const STOP_WORDS = new Set([
  "and",
  "are",
  "but",
  "for",
  "has",
  "not",
  "the",
  "this",
  "with",
  "can",
  "you",
  "help",
  "please",
  "need",
  "just",
  "still",
  "says",
  "said",
  "have",
  "been",
  "from",
  "that",
  "they",
  "them",
  "when",
  "what",
  "why",
  "how",
  "into",
  "after",
  "before",
  "your",
  "their",
  "order",
  "product",
  "customer",
]);

const kbArticlesPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "kb-articles.json"
);

const normalizeText = (value: string): string =>
  value.toLowerCase().replace(NON_WORD_REGEX, " ").trim();

const tokenize = (query: string): string[] => {
  const terms = normalizeText(query).match(WORD_REGEX) ?? [];
  const filteredTerms = terms.filter((term) => term.length > 2 && !STOP_WORDS.has(term));

  return [...new Set(filteredTerms)];
};

let cachedArticles: KbArticle[] | null = null;

const readKbArticles = async (): Promise<KbArticle[]> => {
  if (cachedArticles) {
    return cachedArticles;
  }

  const rawArticles = await readFile(kbArticlesPath, "utf8");
  cachedArticles = JSON.parse(rawArticles) as KbArticle[];

  return cachedArticles;
};

const scoreArticle = (
  article: KbArticle,
  terms: string[],
  options: {
    category?: TicketCategories;
  }
): number => {
  const normalizedCategory = normalizeText(article.category);
  const normalizedTitle = normalizeText(article.title);
  const normalizedContent = normalizeText(article.content);

  let score = 0;

  if (options.category === article.category) {
    score += 6;
  }

  for (const term of terms) {
    if (normalizedTitle.includes(term)) {
      score += 4;
    }

    if (normalizedCategory.includes(term)) {
      score += 3;
    }

    if (normalizedContent.includes(term)) {
      score += 1;
    }
  }

  return score;
};

const buildSnippet = (article: KbArticle, terms: string[]): string => {
  const matchingSentence = article.content.split(SENTENCE_BOUNDARY_REGEX).find((sentence) => {
    const normalizedSentence = normalizeText(sentence);

    return terms.some((term) => normalizedSentence.includes(term));
  });

  const source = matchingSentence ?? article.content;

  if (source.length <= SNIPPET_LENGTH) {
    return source;
  }

  return `${source.slice(0, SNIPPET_LENGTH).trimEnd()}...`;
};

export const searchKbCore = async (input: ParsedSearchKbInput): Promise<SearchKbResult[]> => {
  const terms = tokenize(input.query);

  if (terms.length === 0) {
    return [];
  }

  const articles = await readKbArticles();

  const scoredArticles = articles.map((article) => ({
    article,
    score: scoreArticle(article, terms, {
      category: input.category,
    }),
  }));

  const relevantArticles = scoredArticles.filter(({ score }) => score >= MINIMUM_SCORE);

  const rankedArticles = relevantArticles.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.article.title.localeCompare(right.article.title);
  });

  return rankedArticles.slice(0, input.limit).map(({ article }) => ({
    articleId: article.articleId,
    title: article.title,
    snippet: buildSnippet(article, terms),
  }));
};

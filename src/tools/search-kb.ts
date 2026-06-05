import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { observe } from "@langfuse/tracing";
import type { KbArticle, KbSearchResult } from "@/domain/kb";
import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";

const DEFAULT_RESULT_LIMIT = 3;
const MINIMUM_SCORE = 2;
const SNIPPET_LENGTH = 220;

/** find every continuous run of lowercase letters or digits */
const WORD_REGEX = /[a-z0-9]+/g;

/** find every continuous run of non-alphanumeric characters */
const NON_WORD_REGEX = /[^a-z0-9]+/g;

/** match whitespace, but only if it comes right after a sentence-ending punctuation mark*/
const SENTENCE_BOUNDARY_REGEX = /(?<=[.!?])\s+/;

/** common words to strip out of the query */
const STOP_WORDS = ["and", "are", "but", "for", "has", "not", "the", "this", "with"];

const kbArticlesPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "kb-articles.json"
);

const normalizeText = (value: string): string =>
  value.toLowerCase().replace(NON_WORD_REGEX, " ").trim();

/**
 * tokenize the input query into an array of usable search terms
 * @example
 * tokenize("shipping and delivery package marked delivered but not received");
 * // [ "shipping", "delivery", "package", "marked", "delivered", "received" ]
 */
const tokenize = (query: string): string[] => {
  const terms = normalizeText(query).match(WORD_REGEX) ?? [];
  const filteredTerms = terms.filter((term) => term.length > 2 && !STOP_WORDS.includes(term));

  return [...new Set(filteredTerms)];
};

const readKbArticles = async (): Promise<KbArticle[]> => {
  const rawArticles = await readFile(kbArticlesPath, "utf8");

  return JSON.parse(rawArticles) as KbArticle[];
};

const scoreArticle = (article: KbArticle, terms: string[], normalizedQuery: string): number => {
  const normalizedCategory = normalizeText(article.category);
  const normalizedTitle = normalizeText(article.title);
  const normalizedContent = normalizeText(article.content);

  let score = 0;
  if (normalizedQuery.includes(normalizedCategory)) {
    score += 8;
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

const searchKbInternal = async (
  query: string,
  limit = DEFAULT_RESULT_LIMIT
): Promise<KbSearchResult[]> => {
  const terms = tokenize(query);

  if (terms.length === 0) {
    return [];
  }

  const articles = await readKbArticles();
  const normalizedQuery = normalizeText(query);

  const matchedCategories = new Set(
    articles
      .map((article) => article.category)
      .filter((category) => normalizedQuery.includes(normalizeText(category)))
  );
  const candidateArticles =
    matchedCategories.size > 0
      ? articles.filter((article) => matchedCategories.has(article.category))
      : articles;

  const scoredArticles = candidateArticles.map((article) => ({
    article,
    score: scoreArticle(article, terms, normalizedQuery),
  }));

  const relevantArticles = scoredArticles.filter(({ score }) => score >= MINIMUM_SCORE);

  const rankedArticles = relevantArticles.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.article.title.localeCompare(right.article.title);
  });

  const topArticles = rankedArticles.slice(0, limit);

  return topArticles.map(({ article }) => ({
    articleId: article.articleId,
    title: article.title,
    snippet: buildSnippet(article, terms),
  }));
};

export const buildKbSearchQuery = (category: ClassifiedTicket["category"], ticketBody: string) =>
  `${category} ${ticketBody}`;

export const searchKb = observe(searchKbInternal, {
  name: "search-kb",
  asType: "tool",
});

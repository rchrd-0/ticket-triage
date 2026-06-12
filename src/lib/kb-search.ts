import { kbArticles } from "@/fixtures/kb-articles";
import { normalizeText, tokenize } from "@/lib/lexical-search";
import type { TicketCategories } from "@/schemas/classify-ticket.schema";
import type { KbArticle } from "@/schemas/kb-article.schema";
import type { ParsedSearchKbInput, SearchKbResult } from "@/schemas/search-kb.schema";

const MINIMUM_SCORE = 2;
const SNIPPET_LENGTH = 220;
const SENTENCE_BOUNDARY_REGEX = /(?<=[.!?])\s+/;

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

  let categoryBoost = 0;
  let termScore = 0;

  if (options.category === article.category) {
    categoryBoost += 6;
  }

  for (const term of terms) {
    if (normalizedTitle.includes(term)) {
      termScore += 4;
    }

    if (normalizedCategory.includes(term)) {
      termScore += 3;
    }

    if (normalizedContent.includes(term)) {
      termScore += 1;
    }
  }

  if (termScore === 0) {
    return 0;
  }

  return termScore + categoryBoost;
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

export const searchKbCore = (input: ParsedSearchKbInput): SearchKbResult[] => {
  const terms = tokenize(input.query);

  if (terms.length === 0) {
    return [];
  }

  const scoredArticles = kbArticles.map((article) => ({
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

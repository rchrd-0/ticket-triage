import { sops } from "@/fixtures/sops";
import { normalizeText, tokenize } from "@/lib/lexical-search";
import type { ParsedSearchSopInput, SearchSopResult } from "@/schemas/search-sop.schema";
import type { Sop } from "@/schemas/sop.schema";

const scoreSop = (sop: Sop, terms: string[]): number => {
  const normalizedTitle = normalizeText(sop.title);
  const normalizedContent = normalizeText(sop.content);
  const normalizedKeywords = sop.keywords.map(normalizeText);

  let score = 0;

  for (const term of terms) {
    if (normalizedKeywords.some((keyword) => keyword.includes(term))) {
      score += 3;
    }

    if (normalizedTitle.includes(term)) {
      score += 2;
    }

    if (normalizedContent.includes(term)) {
      score += 1;
    }
  }

  return score;
};

export const searchSopCore = (input: ParsedSearchSopInput): SearchSopResult[] => {
  const terms = tokenize(input.query);

  if (terms.length === 0) {
    return [];
  }

  const scoredSops = sops.map((sop) => ({
    sop,
    score: scoreSop(sop, terms),
  }));

  const rankedSops = scoredSops.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.sop.title.localeCompare(right.sop.title);
  });

  const relevantSops = rankedSops.filter(({ score }) => score > 0);

  return relevantSops.slice(0, input.limit).map(({ sop }) => ({
    sourceId: sop.sopId,
    content: sop.content,
    title: sop.title,
  }));
};

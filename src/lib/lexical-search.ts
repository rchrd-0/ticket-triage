const WORD_REGEX = /[a-z0-9]+/g;
const NON_WORD_REGEX = /[^a-z0-9]+/g;
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

export const normalizeText = (value: string): string =>
  value.toLowerCase().replace(NON_WORD_REGEX, " ").trim();

export const tokenize = (query: string): string[] => {
  const terms = normalizeText(query).match(WORD_REGEX) ?? [];
  const filteredTerms = terms.filter((term) => term.length > 2 && !STOP_WORDS.has(term));

  return [...new Set(filteredTerms)];
};

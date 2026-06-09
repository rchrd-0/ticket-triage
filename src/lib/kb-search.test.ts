import { describe, expect, test } from "bun:test";
import { buildKbSearchQuery } from "@/domain/kb-query";
import goldenRetrievals from "@/evals/datasets/golden-retrievals.json";
import goldenTickets from "@/evals/datasets/golden-tickets.json";
import { searchKbCore } from "@/lib/kb-search";
import type { TicketCategories } from "@/schemas/classify-ticket.schema";
import { SearchKbSchema } from "@/schemas/search-kb.schema";

type GoldenTicket = (typeof goldenTickets)[number];
type RetrievalGoldenCase = (typeof goldenRetrievals)[number];

const getGoldenTicket = (ticketId: string): GoldenTicket => {
  const goldenTicket = goldenTickets.find(({ ticket }) => ticket.id === ticketId);

  if (!goldenTicket) {
    throw new Error(`Missing golden ticket for retrieval case: ${ticketId}`);
  }

  return goldenTicket;
};

const parseSearchInput = (category: TicketCategories, query: string, limit = 3) =>
  SearchKbSchema.parse({ category, query, limit });

describe("buildKbSearchQuery", () => {
  test("removes emails and order ids from the query", () => {
    const searchInput = buildKbSearchQuery(
      "Shipping and delivery",
      "My order ORD-88421 is delayed. Contact me at marcus.webb@example.com please."
    );

    expect(searchInput.query).not.toContain("ORD-88421");
    expect(searchInput.query).not.toContain("marcus.webb@example.com");
    expect(searchInput.query).toContain("my order");
    expect(searchInput.query).toContain("is delayed");
  });
});

describe("searchKbCore", () => {
  test("returns an empty array for an empty query", () => {
    const searchInput = parseSearchInput("General inquiry", "     ", 5);

    const results = searchKbCore(searchInput);

    expect(results).toEqual([]);
  });

  test("returns an empty array for a noise-only query", () => {
    const searchInput = parseSearchInput("General inquiry", "and the for please customer", 5);

    const results = searchKbCore(searchInput);

    expect(results).toEqual([]);
  });

  test("respects the provided limit", () => {
    const searchInput = parseSearchInput("Billing and payment", "duplicate charge refund", 1);

    const results = searchKbCore(searchInput);

    expect(results).toHaveLength(1);
  });

  test("ranks title matches above content-only matches", () => {
    const searchInput = parseSearchInput("Billing and payment", "duplicate", 3);

    const results = searchKbCore(searchInput);

    expect(results[0]?.articleId).toBe("kb-billing-001");
    expect(results.map((result) => result.articleId)).toContain("kb-billing-003");
  });

  test("applies category boost", () => {
    const hardwareResults = searchKbCore(parseSearchInput("Hardware issue", "warranty", 3));
    const generalResults = searchKbCore(parseSearchInput("General inquiry", "warranty", 3));

    expect(hardwareResults[0]?.articleId).toBe("kb-hardware-002");
    expect(generalResults[0]?.articleId).toBe("kb-general-002");
  });

  test.each(
    goldenRetrievals.filter((retrievalCase) =>
      [
        "g-002",
        "g-004",
        "g-005",
        "g-007",
        "g-008",
        "g-011",
        "g-013",
        "g-015",
        "g-019",
        "g-020",
      ].includes(retrievalCase.ticketId)
    )
  )("finds an expected article for representative draftable ticket $ticketId", (retrievalCase: RetrievalGoldenCase) => {
    const goldenTicket = getGoldenTicket(retrievalCase.ticketId);
    const searchInput = buildKbSearchQuery(
      goldenTicket.expected.category as TicketCategories,
      goldenTicket.ticket.body
    );
    const parsedSearchInput = SearchKbSchema.parse(searchInput);
    const articleIds = searchKbCore(parsedSearchInput).map((result) => result.articleId);

    expect(
      retrievalCase.expectedAnyArticleIds.some((articleId) => articleIds.includes(articleId))
    ).toBeTrue();
  });

  test.each(
    goldenRetrievals.filter((retrievalCase) => retrievalCase.forbiddenArticleIds?.length)
  )("excludes obvious forbidden articles for safety boundaries on $ticketId", (retrievalCase: RetrievalGoldenCase) => {
    const goldenTicket = getGoldenTicket(retrievalCase.ticketId);
    const searchInput = buildKbSearchQuery(
      goldenTicket.expected.category as TicketCategories,
      goldenTicket.ticket.body
    );
    const parsedSearchInput = SearchKbSchema.parse(searchInput);
    const articleIds = searchKbCore(parsedSearchInput).map((result) => result.articleId);

    for (const forbiddenArticleId of retrievalCase.forbiddenArticleIds ?? []) {
      expect(articleIds).not.toContain(forbiddenArticleId);
    }
  });

  test.each(
    goldenRetrievals
  )("retrieves acceptable KB context for $ticketId", (retrievalCase: RetrievalGoldenCase) => {
    const goldenTicket = getGoldenTicket(retrievalCase.ticketId);
    const searchInput = buildKbSearchQuery(
      goldenTicket.expected.category as TicketCategories,
      goldenTicket.ticket.body
    );
    const parsedSearchInput = SearchKbSchema.parse(searchInput);
    const results = searchKbCore(parsedSearchInput);
    const articleIds = results.map((result) => result.articleId);

    expect(articleIds.length).toBeLessThanOrEqual(parsedSearchInput.limit);

    if (retrievalCase.expectedPrimaryArticleId) {
      expect(articleIds).toContain(retrievalCase.expectedPrimaryArticleId);
    }

    expect(
      retrievalCase.expectedAnyArticleIds.some((articleId) => articleIds.includes(articleId))
    ).toBeTrue();

    for (const forbiddenArticleId of retrievalCase.forbiddenArticleIds ?? []) {
      expect(articleIds).not.toContain(forbiddenArticleId);
    }
  });
});

import { describe, expect, test } from "bun:test";
import { buildKbSearchQuery } from "@/domain/kb-query";
import { searchKbCore } from "@/lib/kb-search";
import type { TicketCategories } from "@/schemas/classify-ticket.schema";
import { SearchKbSchema } from "@/schemas/search-kb.schema";

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

  test("requires lexical overlap instead of returning category-only matches", () => {
    const results = searchKbCore(
      parseSearchInput("Billing and payment", "unrelated vocabulary", 3)
    );

    expect(results).toEqual([]);
  });

  test("retrieves the app-crash article for a representative ticket", () => {
    const searchInput = buildKbSearchQuery(
      "Software / app bug",
      "Adobe Premiere Pro crashes every time I export a video."
    );
    const articleIds = searchKbCore(SearchKbSchema.parse(searchInput)).map(
      (result) => result.articleId
    );

    expect(articleIds).toContain("kb-software-001");
  });

  test("does not surface account-takeover guidance for ordinary password recovery", () => {
    const searchInput = buildKbSearchQuery(
      "Account access",
      "My password reset link expired and there are no suspicious logins."
    );
    const articleIds = searchKbCore(SearchKbSchema.parse(searchInput)).map(
      (result) => result.articleId
    );

    expect(articleIds).toContain("kb-account-001");
    expect(articleIds).not.toContain("kb-security-001");
  });
});

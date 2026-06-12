import { describe, expect, test } from "bun:test";
import { searchSopCore } from "@/lib/sop-search";
import { SearchSopSchema } from "@/schemas/search-sop.schema";

const parseSearchInput = (query: string, limit = 3) => SearchSopSchema.parse({ query, limit });

describe("searchSopCore", () => {
  test("returns an empty array for empty or noise-only queries", () => {
    const cases = ["           ", "and the please customer"];
    for (const testCase of cases) {
      const results = searchSopCore(parseSearchInput(testCase));

      expect(results).toEqual([]);
    }
  });
  test("respects the parsed result limit", () => {
    const LIMIT = 1;
    const query = parseSearchInput("hardware issue", LIMIT);

    const results = searchSopCore(query);

    expect(results).toHaveLength(LIMIT);
  });
  test("ranks title and curated keyword matches deliberately", () => {
    const cases = [
      { query: "account recover expired reset link", expectedSourceId: "sop-account-recovery-001" },
      { query: "Delayed shipment review", expectedSourceId: "sop-shipping-delay-001" },
    ];

    for (const { query, expectedSourceId } of cases) {
      const results = searchSopCore(parseSearchInput(query));

      expect(results[0]?.sourceId).toBe(expectedSourceId);
    }
  });
  test("does not return SOPs without lexical overlap", () => {
    const query = parseSearchInput("penguin migration patterns");

    const results = searchSopCore(query);

    expect(results).toEqual([]);
  });
  test("uses stable ordering when scores are equal", () => {
    const query = parseSearchInput("replacement");
    const results = searchSopCore(query);

    expect(results[0]?.sourceId).toBe("sop-shipping-delay-001");
    expect(results[1]?.sourceId).toBe("sop-missing-delivery-001");
    expect(results[2]?.sourceId).toBe("sop-warranty-review-001");
  });
  test("finds representative account, shipping, billing, and return SOPs", () => {
    const cases = [
      {
        query: "locked account expired reset link",
        expectedSourceId: "sop-account-recovery-001",
      },
      {
        query: "shipment stuck in transit carrier delay",
        expectedSourceId: "sop-shipping-delay-001",
      },
      {
        query: "duplicate subscription charge",
        expectedSourceId: "sop-billing-dispute-001",
      },
      {
        query: "unopened item return window",
        expectedSourceId: "sop-return-eligibility-001",
      },
    ];

    for (const { query, expectedSourceId } of cases) {
      const results = searchSopCore(parseSearchInput(query));

      expect(results[0]?.sourceId).toBe(expectedSourceId);
    }
  });
});

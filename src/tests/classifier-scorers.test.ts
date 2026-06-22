import { describe, expect, test } from "bun:test";
import { runClassifierScorers } from "@/evals/classifier/scorers";
import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";

const expectedAccountAccess: ClassifiedTicket = {
  category: "Account access",
  urgency: "medium",
  needsHuman: false,
  confidence: 0.9,
};

const scoreClassification = (output: ClassifiedTicket, groundTruth = expectedAccountAccess) =>
  runClassifierScorers({
    input: { ticketId: "scorer-test", product: "Test product" },
    output,
    groundTruth,
  });

describe("classifier scorers", () => {
  test("passes all deterministic contracts for a matching classification", async () => {
    const results = await scoreClassification(expectedAccountAccess);

    expect(results["classifier-primary-contract"]?.score).toBe(1);
    expect(results["classifier-category-contract"]?.score).toBe(1);
    expect(results["classifier-needs-human-contract"]?.score).toBe(1);
    expect(results["classifier-urgency-contract"]?.score).toBe(1);
    expect(results["classifier-high-risk-fn-contract"]?.score).toBe(1);
  });

  test("fails primary and category contracts for a category mismatch", async () => {
    const results = await scoreClassification({
      ...expectedAccountAccess,
      category: "Billing and payment",
    });

    expect(results["classifier-primary-contract"]?.score).toBe(0);
    expect(results["classifier-category-contract"]?.score).toBe(0);
    expect(results["classifier-needs-human-contract"]?.score).toBe(1);
  });

  test("fails high-risk false-negative contract when human review is expected but not returned", async () => {
    const expectedSecurityConcern: ClassifiedTicket = {
      category: "Security concern",
      urgency: "high",
      needsHuman: true,
      confidence: 0.97,
    };
    const automatedSecurityConcern: ClassifiedTicket = {
      ...expectedSecurityConcern,
      needsHuman: false,
    };

    const results = await scoreClassification(automatedSecurityConcern, expectedSecurityConcern);

    expect(results["classifier-primary-contract"]?.score).toBe(0);
    expect(results["classifier-needs-human-contract"]?.score).toBe(0);
    expect(results["classifier-high-risk-fn-contract"]?.score).toBe(0);
  });
});

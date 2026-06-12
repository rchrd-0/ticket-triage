import { describe, expect, test } from "bun:test";
import {
  kbResultToInvestigationSource,
  orderResultToInvestigationSource,
  sopResultToInvestigationSource,
} from "@/domain/investigation-sources";
import type { FoundOrderStatusResult } from "@/schemas/get-order-status.schema";
import type { SearchKbResult } from "@/schemas/search-kb.schema";
import type { SearchSopResult } from "@/schemas/search-sop.schema";

describe("investigation source adapters", () => {
  test("maps a KB result into the shared investigation source contract", () => {
    const result: SearchKbResult = {
      articleId: "kb-test-001",
      title: "Reset password",
      snippet: "Use the password reset form.",
    };

    expect(kbResultToInvestigationSource(result)).toEqual({
      sourceId: "kb-test-001",
      sourceType: "kb_article",
      title: "Reset password",
      content: "Use the password reset form.",
    });
  });
  test("maps an SOP result without changing its source content", () => {
    const result: SearchSopResult = {
      sourceId: "sop-account-recovery-001",
      title: "Standard account recovery",
      content:
        "Use the standard recovery path when the customer still controls the account email and reports no suspicious login, password change, purchase, or payout activity. Confirm which recovery method is failing and direct the customer to request a fresh reset link or use available backup codes. Never ask for a password or one-time verification code. Loss of the account email, disputed ownership, or any compromise indicator requires human review.",
    };

    expect(sopResultToInvestigationSource(result)).toEqual({
      sourceId: "sop-account-recovery-001",
      sourceType: "sop",
      title: "Standard account recovery",
      content:
        "Use the standard recovery path when the customer still controls the account email and reports no suspicious login, password change, purchase, or payout activity. Confirm which recovery method is failing and direct the customer to request a fresh reset link or use available backup codes. Never ask for a password or one-time verification code. Loss of the account email, disputed ownership, or any compromise indicator requires human review.",
    });
  });
  test("maps a found order result into deterministic title and content", () => {
    const result: FoundOrderStatusResult = {
      orderId: "ORD-88421",
      sourceId: "order-88421",
      status: "in_transit",
      found: true,
      lastUpdated: "2026-06-02T08:40:00.000Z",
      trackingEvents: [
        {
          timestamp: "2026-05-28T14:20:00.000Z",
          description: "Package accepted by carrier.",
        },
        {
          timestamp: "2026-05-30T03:15:00.000Z",
          description: "Package arrived at regional sorting facility.",
        },
        {
          timestamp: "2026-06-02T08:40:00.000Z",
          description: "Package remains in transit with no newer carrier scan.",
        },
      ],
      eligibleActions: [
        "Provide the latest tracking event.",
        "Begin the standard delayed-shipment review.",
      ],
    };

    expect(orderResultToInvestigationSource(result)).toEqual({
      sourceType: "order_status",
      sourceId: "order-88421",
      title: "Order ORD-88421 status",
      content:
        "Status: in_transit\nLast updated: 2026-06-02T08:40:00.000Z\nTracking events:\n- 2026-05-28T14:20:00.000Z: Package accepted by carrier.\n- 2026-05-30T03:15:00.000Z: Package arrived at regional sorting facility.\n- 2026-06-02T08:40:00.000Z: Package remains in transit with no newer carrier scan.\nEligible actions:\n- Provide the latest tracking event.\n- Begin the standard delayed-shipment review.",
    });
  });
});

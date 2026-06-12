import { z } from "zod";

export const OrderIdSchema = z.string().regex(/^ORD-\d+$/);

const OrderStatusSchema = z
  .enum(["label_created", "in_transit", "delivered", "cancelled", "refunded"])
  .describe("Current fixture-backed fulfillment status.");

const TrackingEventSchema = z
  .object({
    timestamp: z.iso.datetime().describe("UTC timestamp of the carrier event."),
    description: z.string().min(1).describe("Recorded carrier event summary."),
  })
  .describe("One recorded event in the order tracking history.");

export const OrderFixtureSchema = z
  .object({
    orderId: OrderIdSchema.describe("Customer-facing order reference."),
    sourceId: z.string().startsWith("order-").describe("Stable grounding ID for this order."),
    status: OrderStatusSchema,
    lastUpdated: z.iso.datetime().describe("UTC timestamp of the latest known order state."),
    trackingEvents: z
      .array(TrackingEventSchema)
      .min(1)
      .describe("Chronological carrier tracking history."),
    eligibleActions: z
      .array(z.string().min(1))
      .describe("Fixture-backed support actions currently permitted."),
  })
  .describe("Curated read-only order record used for status lookup.");

export type OrderFixture = z.infer<typeof OrderFixtureSchema>;

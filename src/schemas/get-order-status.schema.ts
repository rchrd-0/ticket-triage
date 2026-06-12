import { z } from "zod";
import { OrderFixtureSchema, OrderIdSchema } from "@/schemas/order-status.schema";

export const GetOrderStatusSchema = z.object({
  orderId: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .pipe(OrderIdSchema),
});

export const GetOrderStatusResultSchema = z.discriminatedUnion("found", [
  z.object({
    found: z.literal(false),
    orderId: OrderIdSchema,
  }),
  z.object({
    found: z.literal(true),
    ...OrderFixtureSchema.shape,
  }),
]);

export type GetOrderStatusInput = z.input<typeof GetOrderStatusSchema>;
export type ParsedGetOrderStatusInput = z.output<typeof GetOrderStatusSchema>;
export type GetOrderStatusResult = z.infer<typeof GetOrderStatusResultSchema>;
export type FoundOrderStatusResult = Extract<GetOrderStatusResult, { found: true }>;

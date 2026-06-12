import { OrderFixtureSchema } from "@/schemas/order-status.schema";
import rawOrders from "./orders.json";

export const orders = OrderFixtureSchema.array().parse(rawOrders);

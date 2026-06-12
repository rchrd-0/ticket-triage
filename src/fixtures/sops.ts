import { SopSchema } from "@/schemas/sop.schema";
import rawSops from "./sops.json";

export const sops = SopSchema.array().parse(rawSops);

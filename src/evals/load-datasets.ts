import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GoldenRetrieval, GoldenTicket } from "@/evals/types";

export const goldenTicketsPath = path.resolve(import.meta.dir, "datasets", "golden-tickets.json");
export const goldenTickets = JSON.parse(
  await readFile(goldenTicketsPath, "utf8")
) as GoldenTicket[];

export const goldenRetrievalsPath = path.resolve(
  import.meta.dir,
  "datasets",
  "golden-retrievals.json"
);
export const goldenRetrievals = JSON.parse(
  await readFile(goldenRetrievalsPath, "utf8")
) as GoldenRetrieval[];

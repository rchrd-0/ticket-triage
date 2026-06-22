import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DrafterGroundingCase, GoldenTicket, ReplyQualityManualCase } from "@/evals/types";

export const goldenTicketsPath = path.resolve(import.meta.dir, "datasets", "golden-tickets.json");
export const goldenTickets = JSON.parse(
  await readFile(goldenTicketsPath, "utf8")
) as GoldenTicket[];

export const drafterGroundingCasesPath = path.resolve(
  import.meta.dir,
  "datasets",
  "drafter-grounding.json"
);
export const drafterGroundingCases = JSON.parse(
  await readFile(drafterGroundingCasesPath, "utf8")
) as DrafterGroundingCase[];

export const replyQualityManualCasesPath = path.resolve(
  import.meta.dir,
  "datasets",
  "reply-quality-manual.json"
);
export const replyQualityManualCases = JSON.parse(
  await readFile(replyQualityManualCasesPath, "utf8")
) as ReplyQualityManualCase[];

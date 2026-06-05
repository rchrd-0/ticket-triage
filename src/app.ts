import { readFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import "@/lib/instrumentation";
import { classifierAgentRun } from "@/agents/classifier.agent";
import type { Ticket } from "@/domain/tickets";
import { flushLangfuseTraces } from "@/lib/instrumentation";
import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import { classifier } from "./config/models";

type GoldenTicket = {
  ticket: Ticket;
  expected: ClassifiedTicket;
};

const goldenPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "evals",
  "datasets",
  "goldenTickets.json"
);

const golden = JSON.parse(await readFile(goldenPath, "utf8")) as GoldenTicket[];

let pass = 0;
let _fail = 0;
let categoryPass = 0;
let needsHumanPass = 0;
let urgencyPass = 0;
let confidencePass = 0;
let totalLatencyMs = 0;
let totalCost = 0;
let ticketsWithCost = 0;

console.dir({ classifier });

for (const { ticket, expected } of golden) {
  const start = performance.now();
  const { usage: openRouterUsage, output: actual } = await classifierAgentRun(ticket.body);
  const latencyMs = performance.now() - start;

  totalLatencyMs += latencyMs;

  if (typeof openRouterUsage?.cost === "number") {
    totalCost += openRouterUsage.cost;
    ticketsWithCost++;
  }

  const categoryMatch = actual.category === expected.category;
  const needsHumanMatch = actual.needsHuman === expected.needsHuman;
  const urgencyMatch = actual.urgency === expected.urgency;
  const confidenceMatch = actual.confidence === expected.confidence;
  const ok = categoryMatch && needsHumanMatch;

  if (ok) {
    pass++;
  } else {
    _fail++;
  }

  if (categoryMatch) {
    categoryPass++;
  }

  if (needsHumanMatch) {
    needsHumanPass++;
  }

  if (urgencyMatch) {
    urgencyPass++;
  }

  if (confidenceMatch) {
    confidencePass++;
  }

  console.log(
    `${ok ? "✓" : "✗"} [${ticket.id}] ${ticket.product}`,
    `\n  category : ${categoryMatch ? "✓" : "✗"} actual=${actual.category} expected=${expected.category}`,
    `\n  needsHuman: ${needsHumanMatch ? "✓" : "✗"} actual=${actual.needsHuman} expected=${expected.needsHuman}`,
    `\n  urgency  : ${urgencyMatch ? "✓" : "✗"} actual=${actual.urgency} expected=${expected.urgency}`,
    `\n  confidence: ${confidenceMatch ? "✓" : "✗"} actual=${actual.confidence} expected=${expected.confidence}`,
    `\n  latency : ${latencyMs.toFixed(0)}ms`,
    openRouterUsage
      ? `\n  cost    : ${openRouterUsage.cost?.toFixed(6) ?? "n/a"} credits`
      : "\n  cost    : n/a"
  );
}

console.log(`\n--- Results: ${pass}/${golden.length} passed (category + needsHuman) ---`);
console.log(`--- Category: ${categoryPass}/${golden.length} ---`);
console.log(`--- needsHuman: ${needsHumanPass}/${golden.length} ---`);
console.log(`--- Urgency: ${urgencyPass}/${golden.length} ---`);
console.log(`--- Confidence exact: ${confidencePass}/${golden.length} ---`);
console.log(`--- Avg latency: ${(totalLatencyMs / golden.length).toFixed(0)}ms/ticket ---`);
console.log(
  ticketsWithCost === golden.length
    ? `--- Total cost: ${totalCost.toFixed(6)} credits ---`
    : `--- Total cost: ${totalCost.toFixed(6)} credits (${ticketsWithCost}/${golden.length} tickets reported cost) ---`
);

await flushLangfuseTraces();

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "@/lib/instrumentation";
import { classifierAgent } from "@/agents/classifier.agent";
import type { Ticket } from "@/domain/tickets";
import { flushLangfuseTraces } from "@/lib/instrumentation";
import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";

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

for (const { ticket, expected } of golden) {
  const actual = await classifierAgent(ticket.body);

  const categoryMatch = actual.category === expected.category;
  const needsHumanMatch = actual.needsHuman === expected.needsHuman;
  const ok = categoryMatch && needsHumanMatch;

  if (ok) {
    pass++;
  } else {
    _fail++;
  }

  console.log(
    `${ok ? "✓" : "✗"} [${ticket.id}] ${ticket.product}`,
    `\n  category : ${categoryMatch ? "✓" : "✗"} actual=${actual.category} expected=${expected.category}`,
    `\n  needsHuman: ${needsHumanMatch ? "✓" : "✗"} actual=${actual.needsHuman} expected=${expected.needsHuman}`,
    `\n  urgency  : actual=${actual.urgency} expected=${expected.urgency}`,
    `\n  confidence: actual=${actual.confidence} expected=${expected.confidence}`
  );
}

console.log(`\n--- Results: ${pass}/${golden.length} passed (category + needsHuman) ---`);

await flushLangfuseTraces();

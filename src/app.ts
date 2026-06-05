import { readFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { classifierAgentRun } from "@/agents/classifier.agent";
import { classifier } from "@/config/models";
import type { Ticket } from "@/domain/tickets";
import { flushLangfuseTraces } from "@/lib/instrumentation";
import { withLangfuseTrace } from "@/lib/llm";
import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import { buildKbSearchQuery, searchKb } from "@/tools/search-kb";

type GoldenTicket = {
  ticket: Ticket;
  expected: ClassifiedTicket;
};

const goldenTicketsPath = path.resolve(import.meta.dir, "evals", "datasets", "golden-tickets.json");
const goldenTickets = JSON.parse(await readFile(goldenTicketsPath, "utf8")) as GoldenTicket[];

const processTicket = async (ticket: Ticket) =>
  withLangfuseTrace(
    "process-ticket",
    {
      traceName: `ticket-${ticket.id}`,
      metadata: { ticketId: ticket.id, product: ticket.product },
      input: {
        ticketId: ticket.id,
        product: ticket.product,
        body: ticket.body,
      },
    },
    async () => {
      const { usage, output: classification } = await classifierAgentRun(ticket.body);
      const kbResults = await searchKb(buildKbSearchQuery(classification.category, ticket.body));

      return { usage, classification, kbResults };
    }
  );

const evalGoldenTickets = async () => {
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

  for (const { ticket, expected } of goldenTickets) {
    const start = performance.now();
    const {
      usage: openRouterUsage,
      classification: actual,
      // kbResults,
    } = await processTicket(ticket);
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

  console.log(`\n--- Results: ${pass}/${goldenTickets.length} passed (category + needsHuman) ---`);
  console.log(`--- Category: ${categoryPass}/${goldenTickets.length} ---`);
  console.log(`--- needsHuman: ${needsHumanPass}/${goldenTickets.length} ---`);
  console.log(`--- Urgency: ${urgencyPass}/${goldenTickets.length} ---`);
  console.log(`--- Confidence exact: ${confidencePass}/${goldenTickets.length} ---`);
  console.log(
    `--- Avg latency: ${(totalLatencyMs / goldenTickets.length).toFixed(0)}ms/ticket ---`
  );
  console.log(
    ticketsWithCost === goldenTickets.length
      ? `--- Total cost: ${totalCost.toFixed(6)} credits ---`
      : `--- Total cost: ${totalCost.toFixed(6)} credits (${ticketsWithCost}/${goldenTickets.length} tickets reported cost) ---`
  );
};

const main = async () => {
  await evalGoldenTickets();
};

try {
  await main();
} finally {
  await flushLangfuseTraces();
}

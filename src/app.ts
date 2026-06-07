import { readFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { classifyTicket } from "@/agents/classifier.agent";
import { classifier } from "@/config/models";
import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import type { Ticket } from "@/schemas/ticket.schema";
import logger from "./lib/logger";

type GoldenTicket = {
  ticket: Ticket;
  expected: ClassifiedTicket;
};

const goldenTicketsPath = path.resolve(import.meta.dir, "evals", "datasets", "golden-tickets.json");
const goldenTickets = JSON.parse(await readFile(goldenTicketsPath, "utf8")) as GoldenTicket[];

const processTicket = async (ticket: Ticket) => {
  const { usage, classification } = await classifyTicket(ticket.body);

  return { usage, classification };
};

const evalGoldenTickets = async () => {
  const evalLog = logger.child({
    script: "evalGoldenTickets",
    datasetSize: goldenTickets.length,
  });

  evalLog.info(
    {
      model: classifier.agentModel,
      temperature: classifier.temperature,
      reasoningEffort: classifier.reasoning.effort,
    },
    "START GOLDEN TICKET EVAL"
  );

  let pass = 0;
  let fail = 0;
  let errors = 0;
  let categoryPass = 0;
  let needsHumanPass = 0;
  let urgencyPass = 0;
  let confidencePass = 0;
  let totalLatencyMs = 0;
  let totalCost = 0;
  let ticketsWithCost = 0;

  for (const { ticket, expected } of goldenTickets) {
    const ticketLog = evalLog.child({ ticketId: ticket.id, product: ticket.product });
    const start = performance.now();

    let openRouterUsage: Awaited<ReturnType<typeof processTicket>>["usage"];
    let actual: ClassifiedTicket;

    try {
      const result = await processTicket(ticket);
      openRouterUsage = result.usage;
      actual = result.classification;
    } catch (error) {
      errors += 1;

      ticketLog.error(
        { err: error instanceof Error ? error.message : String(error) },
        "CASE ERRORED"
      );
      continue;
    }

    const latencyMs = performance.now() - start;

    totalLatencyMs += latencyMs;

    if (typeof openRouterUsage?.cost === "number") {
      totalCost += openRouterUsage.cost;
      ticketsWithCost += 1;
    }

    const categoryMatch = actual.category === expected.category;
    const needsHumanMatch = actual.needsHuman === expected.needsHuman;
    const urgencyMatch = actual.urgency === expected.urgency;
    const confidenceMatch = actual.confidence === expected.confidence;
    const ok = categoryMatch && needsHumanMatch;

    if (ok) {
      pass += 1;

      ticketLog.debug(
        {
          category: actual.category,
          needsHuman: actual.needsHuman,
          urgency: actual.urgency,
          confidence: actual.confidence,
        },
        "CASE PASSED"
      );
    } else {
      fail += 1;

      ticketLog.warn(
        {
          category: { actual: actual.category, expected: expected.category, match: categoryMatch },
          needsHuman: {
            actual: actual.needsHuman,
            expected: expected.needsHuman,
            match: needsHumanMatch,
          },
          urgency: { actual: actual.urgency, expected: expected.urgency, match: urgencyMatch },
          confidence: {
            actual: actual.confidence,
            expected: expected.confidence,
            match: confidenceMatch,
          },
        },
        "CASE FAILED"
      );
    }

    if (categoryMatch) {
      categoryPass += 1;
    }

    if (needsHumanMatch) {
      needsHumanPass += 1;
    }

    if (urgencyMatch) {
      urgencyPass += 1;
    }

    if (confidenceMatch) {
      confidencePass += 1;
    }
  }

  const datasetSize = goldenTickets.length;
  const processedCount = datasetSize - errors;

  evalLog.info(
    {
      pass,
      fail,
      errors,
      primaryAccuracy: pass / datasetSize,
      category: { pass: categoryPass, total: datasetSize },
      needsHuman: { pass: needsHumanPass, total: datasetSize },
      urgency: { pass: urgencyPass, total: datasetSize },
      confidence: { pass: confidencePass, total: datasetSize },
      avgLatencyMs: processedCount > 0 ? Math.round(totalLatencyMs / processedCount) : 0,
      totalCostCredits: Number(totalCost.toFixed(6)),
      ticketsWithCost,
    },
    "GOLDEN TICKET EVAL COMPLETE"
  );
};

const main = async () => {
  await evalGoldenTickets();
};

await main();

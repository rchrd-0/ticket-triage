import { mkdir, readFile, writeFile } from "node:fs/promises";
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
const logsDir = path.resolve(import.meta.dir, "..", "logs");

type EvalCaseLog = {
  ticketId: string;
  product: string;
  ok: boolean;
  latencyMs: number;
  actual: ClassifiedTicket;
  expected: ClassifiedTicket;
  matches: {
    category: boolean;
    needsHuman: boolean;
    urgency: boolean;
    confidence: boolean;
  };
  costCredits?: number;
};

type EvalErrorLog = {
  ticketId: string;
  product: string;
  error: string;
};

const buildLogFileName = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return `eval-${timestamp}.json`;
};

const writeEvalLog = async (payload: unknown) => {
  await mkdir(logsDir, { recursive: true });
  await writeFile(path.join(logsDir, buildLogFileName()), JSON.stringify(payload, null, 2));
};

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
  const cases: EvalCaseLog[] = [];
  const errorCases: EvalErrorLog[] = [];

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
      errorCases.push({
        ticketId: ticket.id,
        product: ticket.product,
        error: error instanceof Error ? error.message : String(error),
      });

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
    const costCredits = openRouterUsage?.cost;

    cases.push({
      ticketId: ticket.id,
      product: ticket.product,
      ok,
      latencyMs: Math.round(latencyMs),
      actual,
      expected,
      matches: {
        category: categoryMatch,
        needsHuman: needsHumanMatch,
        urgency: urgencyMatch,
        confidence: confidenceMatch,
      },
      ...(typeof costCredits === "number" ? { costCredits } : {}),
    });

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

  const summary = {
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
  };

  await writeEvalLog({
    runAt: new Date().toISOString(),
    dataset: {
      path: path.relative(path.resolve(import.meta.dir, ".."), goldenTicketsPath),
      size: datasetSize,
    },
    model: {
      name: classifier.agentModel,
      temperature: classifier.temperature,
      reasoningEffort: classifier.reasoning.effort,
    },
    summary,
    cases,
    errors: errorCases,
  });

  evalLog.info(summary, "GOLDEN TICKET EVAL COMPLETE");
};

const main = async () => {
  await evalGoldenTickets();
};

await main();

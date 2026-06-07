import { readFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { classifyTicket } from "@/agents/classifier.agent";
import { classifier } from "@/config/models";
import {
  addCaseToTotals,
  buildCaseLog,
  buildSummary,
  createEvalTotals,
} from "@/evals/classifier-eval";
import type {
  EvalCaseLog,
  EvalCaseOutcome,
  EvalErrorLog,
  EvalLogger,
  GoldenTicket,
} from "@/evals/types";
import logger from "@/lib/logger";
import { writeEvalLog } from "./log-writer";

const goldenTicketsPath = path.resolve(import.meta.dir, "datasets", "golden-tickets.json");
const goldenTickets = JSON.parse(await readFile(goldenTicketsPath, "utf8")) as GoldenTicket[];

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const logCaseResult = (ticketLog: EvalLogger, caseLog: EvalCaseLog) => {
  if (caseLog.ok) {
    ticketLog.debug(
      {
        category: caseLog.actual.category,
        needsHuman: caseLog.actual.needsHuman,
        urgency: caseLog.actual.urgency,
        confidence: caseLog.actual.confidence,
      },
      "CASE PASSED"
    );

    return;
  }

  ticketLog.warn(
    {
      category: {
        actual: caseLog.actual.category,
        expected: caseLog.expected.category,
        match: caseLog.matches.category,
      },
      needsHuman: {
        actual: caseLog.actual.needsHuman,
        expected: caseLog.expected.needsHuman,
        match: caseLog.matches.needsHuman,
      },
      urgency: {
        actual: caseLog.actual.urgency,
        expected: caseLog.expected.urgency,
        match: caseLog.matches.urgency,
      },
      confidence: {
        actual: caseLog.actual.confidence,
        expected: caseLog.expected.confidence,
        match: caseLog.matches.confidence,
      },
    },
    "CASE FAILED"
  );
};

const evaluateGoldenTicket = async (
  { ticket, expected }: GoldenTicket,
  evalLog: EvalLogger
): Promise<EvalCaseOutcome> => {
  const ticketLog = evalLog.child({ ticketId: ticket.id, product: ticket.product });
  const start = performance.now();

  try {
    const { usage, classification } = await classifyTicket(ticket.body);
    const caseLog = buildCaseLog(
      ticket,
      expected,
      classification,
      usage,
      performance.now() - start
    );

    logCaseResult(ticketLog, caseLog);

    return { kind: "success", caseLog };
  } catch (error) {
    const errorLog = { ticketId: ticket.id, product: ticket.product, error: toErrorMessage(error) };

    ticketLog.error({ err: errorLog.error }, "CASE ERRORED");

    return { kind: "error", errorLog };
  }
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

  const totals = createEvalTotals();
  const cases: EvalCaseLog[] = [];
  const errorCases: EvalErrorLog[] = [];

  for (const goldenTicket of goldenTickets) {
    const outcome = await evaluateGoldenTicket(goldenTicket, evalLog);

    if (outcome.kind === "error") {
      totals.errors += 1;
      errorCases.push(outcome.errorLog);
      continue;
    }

    cases.push(outcome.caseLog);
    addCaseToTotals(totals, outcome.caseLog);
  }

  const datasetSize = goldenTickets.length;
  const summary = buildSummary(totals, datasetSize);

  await writeEvalLog("eval", {
    runAt: new Date().toISOString(),
    dataset: {
      path: path.relative(path.resolve(import.meta.dir, "..", ".."), goldenTicketsPath),
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

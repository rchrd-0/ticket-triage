import path from "node:path";
import { performance } from "node:perf_hooks";
import type { ClassifyTicketResult } from "@/agents/classifier.agent";
import { classifier } from "@/config/models";
import {
  addCaseToTotals,
  buildCaseLog,
  buildSummary,
  createEvalTotals,
} from "@/evals/classifier-eval";
import type {
  ClassifierEvalCaseLog,
  ClassifierEvalCaseOutcome,
  ClassifierEvalErrorLog,
} from "@/evals/classifier-types";
import { goldenTickets, goldenTicketsPath } from "@/evals/load-datasets";
import type { EvalLogger, GoldenTicket } from "@/evals/types";
import { mastra } from "@/index";
import { toErrorMessage } from "@/lib/format";
import logger from "@/lib/logger";
import { getOpenRouterUsage } from "@/lib/openrouter-usage";
import { buildClassifyTicketPrompt } from "@/prompts/classify-ticket.prompt";
import { ClassifyTicketSchema } from "@/schemas/classify-ticket.schema";
import { writeEvalLog } from "./log-writer";

const classifierAgent = mastra.getAgent("classifierAgent");

const classifyTicket = async (ticketBody: string): Promise<ClassifyTicketResult> => {
  const { object, providerMetadata } = await classifierAgent.generate(
    buildClassifyTicketPrompt(ticketBody),
    {
      structuredOutput: {
        schema: ClassifyTicketSchema,
      },
    }
  );

  return {
    classification: object,
    usage: getOpenRouterUsage(providerMetadata),
  };
};

const logCaseResult = (ticketLog: EvalLogger, caseLog: ClassifierEvalCaseLog) => {
  if (caseLog.ok) {
    ticketLog.debug(
      {
        event: "eval.classifier.case_completed",
        ok: true,
        category: caseLog.actual.category,
        needsHuman: caseLog.actual.needsHuman,
        urgency: caseLog.actual.urgency,
        confidence: caseLog.actual.confidence,
      },
      "Classifier eval case completed"
    );

    return;
  }

  ticketLog.warn(
    {
      event: "eval.classifier.case_completed",
      ok: false,
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
    "Classifier eval case completed"
  );
};

const evaluateGoldenTicket = async (
  { ticket, expected }: GoldenTicket,
  evalLog: EvalLogger
): Promise<ClassifierEvalCaseOutcome> => {
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

    ticketLog.error(
      { event: "eval.classifier.case_errored", err: errorLog.error },
      "Classifier eval case errored"
    );

    return { kind: "error", errorLog };
  }
};

const evalGoldenTickets = async () => {
  const evalLog = logger.child({
    script: "eval_classifier",
    datasetSize: goldenTickets.length,
  });

  evalLog.info(
    {
      event: "eval.classifier.started",
      model: classifier.agentModel,
      temperature: classifier.temperature,
      reasoningEffort: classifier.reasoning.effort,
    },
    "Classifier eval started"
  );

  const totals = createEvalTotals();
  const cases: ClassifierEvalCaseLog[] = [];
  const errorCases: ClassifierEvalErrorLog[] = [];

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

  await writeEvalLog("eval-classifier", {
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

  evalLog.info(
    {
      event: "eval.classifier.completed",
      ...summary,
    },
    "Classifier eval completed"
  );
};

const main = async () => {
  await evalGoldenTickets();
};

try {
  await main();
} finally {
  await mastra.shutdown();
}

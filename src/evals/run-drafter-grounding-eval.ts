import path from "node:path";
import { draftReply } from "@/agents/drafter.agent";
import {
  drafterGroundingCases,
  drafterGroundingCasesPath,
  goldenTickets,
} from "@/evals/load-datasets";
import { writeEvalLog } from "@/evals/log-writer";
import type { DrafterGroundingCase, EvalLogger } from "@/evals/types";
import { toErrorMessage } from "@/lib/format";
import logger from "@/lib/logger";

type DrafterGroundingResult = {
  ticketId: string;
  providedSourceIds: string[];
  groundingSourceIds: string[];
  checks: {
    groundingFromProvidedSources: boolean;
    groundingPresenceValid: boolean;
  };
};

type DrafterGroundingOutcome =
  | { kind: "success"; caseLog: DrafterGroundingResult }
  | { kind: "error"; errorLog: { ticketId: string; error: string } };

const casePassed = (result: DrafterGroundingResult) =>
  result.checks.groundingFromProvidedSources && result.checks.groundingPresenceValid;

const getGoldenTicket = (ticketId: string) => {
  const goldenTicket = goldenTickets.find(({ ticket }) => ticket.id === ticketId);

  if (!goldenTicket) {
    throw new Error(`Missing golden ticket for drafter grounding case: ${ticketId}`);
  }

  return goldenTicket;
};

const evaluateGrounding = (args: {
  providedSourceIds: string[];
  groundingSourceIds: string[];
}) => ({
  groundingFromProvidedSources: args.groundingSourceIds.every((id) =>
    args.providedSourceIds.includes(id)
  ),
  groundingPresenceValid:
    args.providedSourceIds.length === 0
      ? args.groundingSourceIds.length === 0
      : args.groundingSourceIds.length >= 1,
});

const logCaseResult = (caseLog: EvalLogger, result: DrafterGroundingResult) => {
  if (casePassed(result)) {
    caseLog.debug(result, "CASE PASSED");
    return;
  }

  caseLog.warn(result, "CASE FAILED");
};

const evaluateCase = async (
  groundingCase: DrafterGroundingCase,
  evalLog: EvalLogger
): Promise<DrafterGroundingOutcome> => {
  const caseLog = evalLog.child({ ticketId: groundingCase.ticketId });

  try {
    const { ticket, expected: classification } = getGoldenTicket(groundingCase.ticketId);
    const reply = await draftReply(ticket, classification, {
      sources: groundingCase.sources,
      terminationReason: groundingCase.terminationReason,
    });

    const providedSourceIds = groundingCase.sources.map((source) => source.sourceId);

    const result: DrafterGroundingResult = {
      ticketId: ticket.id,
      providedSourceIds,
      groundingSourceIds: reply.groundingSourceIds,
      checks: evaluateGrounding({
        providedSourceIds,
        groundingSourceIds: reply.groundingSourceIds,
      }),
    };

    logCaseResult(caseLog, result);

    return { kind: "success", caseLog: result };
  } catch (error) {
    const errorLog = { ticketId: groundingCase.ticketId, error: toErrorMessage(error) };
    caseLog.error({ err: errorLog.error }, "CASE ERRORED");

    return { kind: "error", errorLog };
  }
};

const main = async () => {
  const evalLog = logger.child({
    script: "evalDrafterGrounding",
    datasetSize: drafterGroundingCases.length,
  });
  const results: DrafterGroundingOutcome[] = [];

  evalLog.info("START DRAFTER GROUNDING EVAL");

  for (const groundingCase of drafterGroundingCases) {
    results.push(await evaluateCase(groundingCase, evalLog));
  }

  const successCases = results.filter((result) => result.kind === "success");
  const failedCases = successCases.filter((result) => !casePassed(result.caseLog));
  const erroredCases = results.filter((result) => result.kind === "error");
  const summary = {
    total: results.length,
    passed: successCases.length - failedCases.length,
    failed: failedCases.length,
    errored: erroredCases.length,
  };

  logger.info(
    {
      ...summary,
      failures: failedCases.map((result) => result.caseLog),
      errors: erroredCases.map((result) => result.errorLog),
    },
    "Drafter grounding eval completed"
  );

  await writeEvalLog("eval-drafter-grounding", {
    runAt: new Date().toISOString(),
    dataset: {
      path: path.relative(path.resolve(import.meta.dir, "..", ".."), drafterGroundingCasesPath),
      size: drafterGroundingCases.length,
    },
    summary,
    results,
  });

  if (failedCases.length > 0 || erroredCases.length > 0) {
    process.exitCode = 1;
  }
};

await main();

import path from "node:path";
import {
  drafterGroundingCases,
  drafterGroundingCasesPath,
  goldenTickets,
} from "@/evals/load-datasets";
import { writeEvalLog } from "@/evals/log-writer";
import type { DrafterGroundingCase, EvalLogger } from "@/evals/types";
import { mastra } from "@/index";
import { toErrorMessage } from "@/lib/format";
import logger from "@/lib/logger";
import { buildDraftReplyPrompt, type DraftGroundingContext } from "@/prompts/draft-reply.prompt";
import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import { type DraftReply, DraftReplySchema } from "@/schemas/draft-reply.schema";
import type { Ticket } from "@/schemas/ticket.schema";

const drafterAgent = mastra.getAgent("drafterAgent");

const draftReply = async (
  ticket: Ticket,
  classification: ClassifiedTicket,
  groundingContext: DraftGroundingContext
): Promise<DraftReply> => {
  const { object } = await drafterAgent.generate(
    buildDraftReplyPrompt({ ticket, classification, groundingContext }),
    {
      structuredOutput: {
        schema: DraftReplySchema,
      },
    }
  );

  return object;
};

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
  const logFields = {
    event: "eval.drafter_grounding.case_completed",
    ok: casePassed(result),
    ...result,
  };

  if (casePassed(result)) {
    caseLog.debug(logFields, "Drafter grounding eval case completed");
    return;
  }

  caseLog.warn(logFields, "Drafter grounding eval case completed");
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
    caseLog.error(
      { event: "eval.drafter_grounding.case_errored", err: errorLog.error },
      "Drafter grounding eval case errored"
    );

    return { kind: "error", errorLog };
  }
};

const main = async () => {
  const evalLog = logger.child({
    script: "eval_drafter_grounding",
    datasetSize: drafterGroundingCases.length,
  });
  const results: DrafterGroundingOutcome[] = [];

  evalLog.info(
    {
      event: "eval.drafter_grounding.started",
    },
    "Drafter grounding eval started"
  );

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

  const logPath = await writeEvalLog("eval-drafter-grounding", {
    runAt: new Date().toISOString(),
    dataset: {
      path: path.relative(path.resolve(import.meta.dir, "..", ".."), drafterGroundingCasesPath),
      size: drafterGroundingCases.length,
    },
    summary,
    results,
  });

  evalLog.info(
    {
      event: "eval.drafter_grounding.completed",
      logPath,
      ...summary,
      failures: failedCases.map((result) => result.caseLog),
      errors: erroredCases.map((result) => result.errorLog),
    },
    "Drafter grounding eval completed"
  );

  if (failedCases.length > 0 || erroredCases.length > 0) {
    process.exitCode = 1;
  }
};

try {
  await main();
} finally {
  await mastra.shutdown();
}

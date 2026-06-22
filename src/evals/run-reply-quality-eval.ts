import path from "node:path";
import {
  drafterGroundingCases,
  drafterGroundingCasesPath,
  goldenTickets,
  replyQualityManualCases,
  replyQualityManualCasesPath,
} from "@/evals/load-datasets";
import { writeEvalLog } from "@/evals/log-writer";
import {
  type ReplyQualityScorerResults,
  replyQualityDeterministicPassed,
  runReplyQualityScorers,
} from "@/evals/reply-quality.scorers";
import type { DrafterGroundingCase, EvalLogger, ReplyQualityManualCase } from "@/evals/types";
import { mapWithWorkerCount } from "@/evals/workers";
import { mastra } from "@/index";
import { toErrorMessage } from "@/lib/format";
import logger from "@/lib/logger";
import { buildDraftReplyPrompt, type DraftGroundingContext } from "@/prompts/draft-reply.prompt";
import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import { type DraftReply, DraftReplySchema } from "@/schemas/draft-reply.schema";
import type { Ticket } from "@/schemas/ticket.schema";

const REPLY_QUALITY_EVAL_WORKER_COUNT = 4;

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

type ReplyQualityResult = {
  caseId: string;
  reply: DraftReply;
  providedSourceIds: string[];
  manualScores: ReplyQualityManualCase["scores"];
  manualAverage: number;
  manualNotes: string;
  scorerResults: ReplyQualityScorerResults;
  deterministicPassed: boolean;
};

type ReplyQualityOutcome =
  | { kind: "success"; caseLog: ReplyQualityResult }
  | { kind: "error"; errorLog: { caseId: string; error: string } };

const manualCasesById = new Map(
  replyQualityManualCases.map((manualCase) => [manualCase.caseId, manualCase])
);

const getGoldenTicket = (ticketId: string) => {
  const goldenTicket = goldenTickets.find(({ ticket }) => ticket.id === ticketId);

  if (!goldenTicket) {
    throw new Error(`Missing golden ticket for reply-quality case: ${ticketId}`);
  }

  return goldenTicket;
};

const getGroundingCaseId = (groundingCase: DrafterGroundingCase) =>
  "ticketId" in groundingCase ? groundingCase.ticketId : groundingCase.ticket.id;

const getGroundingCaseInputs = (groundingCase: DrafterGroundingCase) => {
  if ("ticketId" in groundingCase) {
    const { ticket, expected: classification } = getGoldenTicket(groundingCase.ticketId);
    return { ticket, classification };
  }

  return {
    ticket: groundingCase.ticket,
    classification: groundingCase.classification,
  };
};

const getManualCase = (caseId: string) => {
  const manualCase = manualCasesById.get(caseId);

  if (!manualCase) {
    throw new Error(`Missing manual reply-quality baseline for case: ${caseId}`);
  }

  return manualCase;
};

const getManualAverage = (scores: ReplyQualityManualCase["scores"]) => {
  const values = Object.values(scores);
  const total = values.reduce((sum, score) => sum + score, 0);

  return total / values.length;
};

const logCaseResult = (caseLog: EvalLogger, result: ReplyQualityResult) => {
  const logFields = {
    event: "eval.reply_quality.case_completed",
    ok: result.deterministicPassed,
    caseId: result.caseId,
    groundingSourceIds: result.reply.groundingSourceIds,
    manualAverage: result.manualAverage,
    scorerResults: result.scorerResults,
  };

  if (result.deterministicPassed) {
    caseLog.debug(logFields, "Reply-quality eval case completed");
    return;
  }

  caseLog.warn(logFields, "Reply-quality eval case completed");
};

const evaluateCase = async (
  groundingCase: DrafterGroundingCase,
  evalLog: EvalLogger
): Promise<ReplyQualityOutcome> => {
  const caseId = getGroundingCaseId(groundingCase);
  const caseLog = evalLog.child({ caseId });

  try {
    const manualCase = getManualCase(caseId);
    const { ticket, classification } = getGroundingCaseInputs(groundingCase);
    const reply = await draftReply(ticket, classification, {
      sources: groundingCase.sources,
      terminationReason: groundingCase.terminationReason,
    });
    const scorerResults = await runReplyQualityScorers({
      input: {
        caseId,
        sources: groundingCase.sources,
        terminationReason: groundingCase.terminationReason,
      },
      output: reply,
      groundTruth: manualCase,
    });
    const result = {
      caseId,
      reply,
      providedSourceIds: groundingCase.sources.map((source) => source.sourceId),
      manualScores: manualCase.scores,
      manualAverage: getManualAverage(manualCase.scores),
      manualNotes: manualCase.notes,
      scorerResults,
      deterministicPassed: replyQualityDeterministicPassed(scorerResults),
    };

    logCaseResult(caseLog, result);

    return { kind: "success", caseLog: result };
  } catch (error) {
    const errorLog = { caseId, error: toErrorMessage(error) };
    caseLog.error(
      { event: "eval.reply_quality.case_errored", err: errorLog.error },
      "Reply-quality eval case errored"
    );

    return { kind: "error", errorLog };
  }
};

const main = async () => {
  const evalLog = logger.child({
    script: "eval_reply_quality",
    datasetSize: drafterGroundingCases.length,
  });

  evalLog.info(
    {
      event: "eval.reply_quality.started",
    },
    "Reply-quality eval started"
  );

  const outcomes = await mapWithWorkerCount(
    drafterGroundingCases,
    REPLY_QUALITY_EVAL_WORKER_COUNT,
    (groundingCase) => evaluateCase(groundingCase, evalLog)
  );
  const successCases = outcomes.filter((outcome) => outcome.kind === "success");
  const failedCases = successCases.filter(
    (outcome) => !replyQualityDeterministicPassed(outcome.caseLog.scorerResults)
  );
  const erroredCases = outcomes.filter((outcome) => outcome.kind === "error");
  const summary = {
    total: outcomes.length,
    deterministicPassed: successCases.length - failedCases.length,
    deterministicFailed: failedCases.length,
    errored: erroredCases.length,
  };
  const logPath = await writeEvalLog("eval-reply-quality", {
    runAt: new Date().toISOString(),
    dataset: {
      drafterGroundingPath: path.relative(
        path.resolve(import.meta.dir, "..", ".."),
        drafterGroundingCasesPath
      ),
      manualBaselinePath: path.relative(
        path.resolve(import.meta.dir, "..", ".."),
        replyQualityManualCasesPath
      ),
      size: drafterGroundingCases.length,
    },
    summary,
    results: outcomes,
  });

  evalLog.info(
    {
      event: "eval.reply_quality.completed",
      logPath,
      ...summary,
      failures: failedCases.map((outcome) => outcome.caseLog),
      errors: erroredCases.map((outcome) => outcome.errorLog),
    },
    "Reply-quality eval completed"
  );

  if (summary.deterministicFailed > 0 || summary.errored > 0) {
    process.exitCode = 1;
  }
};

try {
  await main();
} finally {
  await mastra.shutdown();
}

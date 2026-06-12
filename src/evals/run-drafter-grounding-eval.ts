import path from "node:path";
import { draftReply } from "@/agents/drafter.agent";
import {
  drafterGroundingCases,
  drafterGroundingCasesPath,
  goldenTickets,
} from "@/evals/load-datasets";
import { writeEvalLog } from "@/evals/log-writer";
import type { DrafterGroundingCase, EvalLogger } from "@/evals/types";
import { kbArticles } from "@/fixtures/kb-articles";
import { toErrorMessage } from "@/lib/format";
import logger from "@/lib/logger";
import type { KbArticle } from "@/schemas/kb-article.schema";
import type { SearchKbResult } from "@/schemas/search-kb.schema";

type DrafterGroundingResult = {
  ticketId: string;
  providedArticleIds: string[];
  citedArticleIds: string[];
  checks: {
    citationsFromProvidedContext: boolean;
    citationPresenceValid: boolean;
  };
};

type DrafterGroundingOutcome =
  | { kind: "success"; caseLog: DrafterGroundingResult }
  | { kind: "error"; errorLog: { ticketId: string; error: string } };

const casePassed = (result: DrafterGroundingResult) =>
  result.checks.citationsFromProvidedContext && result.checks.citationPresenceValid;

const getGoldenTicket = (ticketId: string) => {
  const goldenTicket = goldenTickets.find(({ ticket }) => ticket.id === ticketId);

  if (!goldenTicket) {
    throw new Error(`Missing golden ticket for drafter grounding case: ${ticketId}`);
  }

  return goldenTicket;
};

const getProvidedContext = (articleIds: string[]): SearchKbResult[] =>
  articleIds.map((articleId) => {
    const article = kbArticles.find((candidate) => candidate.articleId === articleId);

    if (!article) {
      throw new Error(`Missing KB article for drafter grounding case: ${articleId}`);
    }

    return toSearchResult(article);
  });

const toSearchResult = (article: KbArticle): SearchKbResult => ({
  articleId: article.articleId,
  title: article.title,
  snippet: article.content,
});

const evaluateGrounding = (args: { providedArticleIds: string[]; citedArticleIds: string[] }) => ({
  citationsFromProvidedContext: args.citedArticleIds.every((id) =>
    args.providedArticleIds.includes(id)
  ),
  citationPresenceValid:
    args.providedArticleIds.length === 0
      ? args.citedArticleIds.length === 0
      : args.citedArticleIds.length >= 1,
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
    const providedContext = getProvidedContext(groundingCase.providedArticleIds);
    const reply = await draftReply(ticket, classification, providedContext);
    const result: DrafterGroundingResult = {
      ticketId: ticket.id,
      providedArticleIds: groundingCase.providedArticleIds,
      citedArticleIds: reply.citedArticleIds,
      checks: evaluateGrounding({
        providedArticleIds: groundingCase.providedArticleIds,
        citedArticleIds: reply.citedArticleIds,
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

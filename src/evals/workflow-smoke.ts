import path from "node:path";
import { goldenTickets, goldenTicketsPath } from "@/evals/load-datasets";
import { mastra } from "@/index";
import { toErrorMessage } from "@/lib/format";
import logger from "@/lib/logger";
import type { Ticket } from "@/schemas/ticket.schema";
import { TriageOutputSchema } from "@/workflows/triage.workflow";
import { writeEvalLog } from "./log-writer";

const workflow = mastra.getWorkflowById("triage-workflow");

const smokeTicketIds = ["g-002", "g-006"] as const;
const expectedSmokeResults = {
  "g-002": { routePath: "draft", hasReply: true, minCitations: 1 },
  "g-006": { routePath: "human_review", hasReply: false, minCitations: 0 },
} as const;

const smokeLog = logger.child({ script: "workflowSmoke", datasetSize: smokeTicketIds.length });

type SmokeCaseLog = {
  ticketId: (typeof smokeTicketIds)[number];
  expectedRoute: (typeof expectedSmokeResults)[(typeof smokeTicketIds)[number]]["routePath"];
  actualRoute?: string;
  expectedReply: boolean;
  actualReply?: boolean;
  expectedMinCitations: number;
  citedArticleIds?: string[];
  ok: boolean;
  error?: string;
};

const getSmokeTicket = (ticketId: (typeof smokeTicketIds)[number]) => {
  const goldenTicket = goldenTickets.find(({ ticket }) => ticket.id === ticketId);

  if (!goldenTicket) {
    throw new Error(`Missing smoke ticket: ${ticketId}`);
  }

  return goldenTicket.ticket;
};

const runSmokeTicket = async (ticket: Ticket) => {
  const run = await workflow.createRun();
  const result = await run.start({ inputData: { ticket } });

  if (result.status !== "success") {
    throw new Error(`Workflow smoke failed for ${ticket.id}: ${result.status}`);
  }

  const directParse = TriageOutputSchema.safeParse(result.result);

  if (directParse.success) {
    return directParse.data;
  }

  const branchOutputs = result.result as Record<string, unknown>;
  const output = branchOutputs["draft-workflow"] ?? branchOutputs["human-review"];

  return TriageOutputSchema.parse(output);
};

const main = async () => {
  const cases: SmokeCaseLog[] = [];

  for (const ticketId of smokeTicketIds) {
    const expected = expectedSmokeResults[ticketId];

    try {
      const result = await runSmokeTicket(getSmokeTicket(ticketId));
      const hasReply = Boolean(result.reply);
      const citedArticleIds = result.reply?.citedArticleIds ?? [];
      const ok =
        result.route.path === expected.routePath &&
        hasReply === expected.hasReply &&
        citedArticleIds.length >= expected.minCitations;

      cases.push({
        ticketId,
        expectedRoute: expected.routePath,
        actualRoute: result.route.path,
        expectedReply: expected.hasReply,
        actualReply: hasReply,
        expectedMinCitations: expected.minCitations,
        citedArticleIds,
        ok,
        ...(ok ? {} : { error: `Unexpected smoke result for ${ticketId}` }),
      });

      if (ok) {
        smokeLog.info(
          {
            ticketId,
            routePath: result.route.path,
            hasReply,
            citedArticleIds,
          },
          `${ticketId} -> ${result.route.path} -> reply ${hasReply ? "yes" : "no"}`
        );
      } else {
        smokeLog.error(
          {
            ticketId,
            expectedRoute: expected.routePath,
            actualRoute: result.route.path,
            expectedReply: expected.hasReply,
            actualReply: hasReply,
            expectedMinCitations: expected.minCitations,
            citedArticleIds,
          },
          `WORKFLOW SMOKE FAILED: ${ticketId}`
        );
      }
    } catch (error) {
      const errorMessage = toErrorMessage(error);

      cases.push({
        ticketId,
        expectedRoute: expected.routePath,
        expectedReply: expected.hasReply,
        expectedMinCitations: expected.minCitations,
        ok: false,
        error: errorMessage,
      });

      smokeLog.error({ ticketId, err: errorMessage }, `WORKFLOW SMOKE ERRORED: ${ticketId}`);
    }
  }

  const summary = {
    pass: cases.filter((smokeCase) => smokeCase.ok).length,
    fail: cases.filter((smokeCase) => !smokeCase.ok).length,
  };

  await writeEvalLog("workflow-smoke", {
    runAt: new Date().toISOString(),
    script: "workflow:smoke",
    dataset: {
      path: path.relative(path.resolve(import.meta.dir, "..", ".."), goldenTicketsPath),
      ticketIds: smokeTicketIds,
    },
    summary,
    cases,
  });

  if (summary.fail > 0) {
    process.exitCode = 1;
  }
};

try {
  await main();
} finally {
  await mastra.shutdown();
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GoldenTicket } from "@/evals/types";
import logger from "@/lib/logger";
import type { Ticket } from "@/schemas/ticket.schema";
import { TriageOutputSchema, triageWorkflow } from "@/workflows/triage.workflow";
import { writeEvalLog } from "./log-writer";

const smokeTicketIds = ["g-002", "g-006"] as const;
const expectedSmokeResults = {
  "g-002": { routePath: "draft", hasReply: true },
  "g-006": { routePath: "human_review", hasReply: false },
} as const;

const goldenTicketsPath = path.resolve(import.meta.dir, "datasets", "golden-tickets.json");

const goldenTickets = JSON.parse(await readFile(goldenTicketsPath, "utf8")) as GoldenTicket[];
const smokeLog = logger.child({ script: "workflowSmoke", datasetSize: smokeTicketIds.length });

type SmokeCaseLog = {
  ticketId: (typeof smokeTicketIds)[number];
  expectedRoute: (typeof expectedSmokeResults)[(typeof smokeTicketIds)[number]]["routePath"];
  actualRoute?: string;
  expectedReply: boolean;
  actualReply?: boolean;
  citedArticleIds?: string[];
  ok: boolean;
  error?: string;
};

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const getSmokeTicket = (ticketId: (typeof smokeTicketIds)[number]) => {
  const goldenTicket = goldenTickets.find(({ ticket }) => ticket.id === ticketId);

  if (!goldenTicket) {
    throw new Error(`Missing smoke ticket: ${ticketId}`);
  }

  return goldenTicket.ticket;
};

const runSmokeTicket = async (ticket: Ticket) => {
  const run = await triageWorkflow.createRun();
  const result = await run.start({ inputData: { ticket } });

  if (result.status !== "success") {
    throw new Error(`Workflow smoke failed for ${ticket.id}: ${result.status}`);
  }

  const branchOutputs = result.result as Record<string, unknown>;
  const output = branchOutputs["draft-reply"] ?? branchOutputs["human-review"];

  return TriageOutputSchema.parse(output);
};

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
      citedArticleIds.length === 0;

    cases.push({
      ticketId,
      expectedRoute: expected.routePath,
      actualRoute: result.route.path,
      expectedReply: expected.hasReply,
      actualReply: hasReply,
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
  process.exit(1);
}

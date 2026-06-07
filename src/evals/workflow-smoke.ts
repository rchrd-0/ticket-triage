import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GoldenTicket } from "@/evals/types";
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

type SmokeCaseLog = {
  ticketId: (typeof smokeTicketIds)[number];
  expectedRoute: (typeof expectedSmokeResults)[(typeof smokeTicketIds)[number]]["routePath"];
  actualRoute: string;
  expectedReply: boolean;
  actualReply: boolean;
  citedArticleIds: string[];
  ok: boolean;
};

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
  const result = await runSmokeTicket(getSmokeTicket(ticketId));
  const expected = expectedSmokeResults[ticketId];
  const hasReply = Boolean(result.reply);
  const citedArticleIds = result.reply?.citedArticleIds ?? [];
  const ok = result.route.path === expected.routePath && hasReply === expected.hasReply;

  cases.push({
    ticketId,
    expectedRoute: expected.routePath,
    actualRoute: result.route.path,
    expectedReply: expected.hasReply,
    actualReply: hasReply,
    citedArticleIds,
    ok,
  });

  if (!ok) {
    throw new Error(`Unexpected smoke result for ${ticketId}`);
  }

  if (citedArticleIds.length > 0) {
    throw new Error(`Unexpected citations for ${ticketId}`);
  }

  console.log(`${ticketId} -> ${result.route.path} -> reply ${hasReply ? "yes" : "no"}`);
}

await writeEvalLog("workflow-smoke", {
  runAt: new Date().toISOString(),
  script: "workflow:smoke",
  dataset: {
    path: path.relative(path.resolve(import.meta.dir, "..", ".."), goldenTicketsPath),
    ticketIds: smokeTicketIds,
  },
  summary: {
    pass: cases.filter((smokeCase) => smokeCase.ok).length,
    fail: cases.filter((smokeCase) => !smokeCase.ok).length,
  },
  cases,
});

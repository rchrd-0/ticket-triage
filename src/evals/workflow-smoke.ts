import path from "node:path";
import { goldenTickets, goldenTicketsPath } from "@/evals/load-datasets";
import { mastra } from "@/index";
import { toErrorMessage } from "@/lib/format";
import logger from "@/lib/logger";
import type { Ticket } from "@/schemas/ticket.schema";
import { TriageOutputSchema } from "@/workflows/triage.workflow";
import { writeEvalLog } from "./log-writer";

const workflow = mastra.getWorkflowById("triage-workflow");

type SmokeExpectation = {
  routePath: "draft" | "human_review";
  hasReply: boolean;
  minGroundingSources: number;
  requiredGroundingSourceIds?: string[];
  forbiddenGroundingSourceIds?: string[];
};

type SmokeCase = {
  ticket: Ticket;
  source: "golden" | "inline";
  expected: SmokeExpectation;
};

const getSmokeTicket = (ticketId: string) => {
  const goldenTicket = goldenTickets.find(({ ticket }) => ticket.id === ticketId);

  if (!goldenTicket) {
    throw new Error(`Missing smoke ticket: ${ticketId}`);
  }

  return goldenTicket.ticket;
};

const smokeCases: SmokeCase[] = [
  {
    ticket: getSmokeTicket("g-002"),
    source: "golden",
    expected: { routePath: "draft", hasReply: true, minGroundingSources: 1 },
  },
  {
    ticket: getSmokeTicket("g-003"),
    source: "golden",
    expected: {
      routePath: "draft",
      hasReply: true,
      minGroundingSources: 1,
      requiredGroundingSourceIds: ["order-88421"],
    },
  },
  {
    ticket: {
      id: "smoke-unknown-order",
      channel: "email",
      product: "Logitech MX Master 3",
      body: "My order ORD-99999 was supposed to arrive last week, but I cannot find any tracking update. Can you check what happened and tell me whether it can be resent?",
      customer: {
        name: "Smoke Test",
        email: "smoke.unknown.order@example.com",
      },
    },
    source: "inline",
    expected: {
      routePath: "draft",
      hasReply: true,
      minGroundingSources: 0,
      forbiddenGroundingSourceIds: ["order-99999"],
    },
  },
  {
    ticket: getSmokeTicket("g-006"),
    source: "golden",
    expected: { routePath: "human_review", hasReply: false, minGroundingSources: 0 },
  },
];

const smokeLog = logger.child({ script: "workflowSmoke", datasetSize: smokeCases.length });

type SmokeCaseLog = {
  ticketId: string;
  source: SmokeCase["source"];
  expectedRoute: SmokeExpectation["routePath"];
  actualRoute?: string;
  classification?: {
    category: string;
    urgency: string;
    needsHuman: boolean;
  };
  expectedReply: boolean;
  actualReply?: boolean;
  expectedMinGroundingSources: number;
  groundingSourceIds?: string[];
  requiredGroundingSourceIds?: string[];
  forbiddenGroundingSourceIds?: string[];
  ok: boolean;
  error?: string;
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

  for (const smokeCase of smokeCases) {
    const { expected, source, ticket } = smokeCase;

    try {
      const result = await runSmokeTicket(ticket);
      const hasReply = Boolean(result.reply);
      const groundingSourceIds = result.reply?.groundingSourceIds ?? [];
      const classification = {
        category: result.classification.category,
        urgency: result.classification.urgency,
        needsHuman: result.classification.needsHuman,
      };
      const hasRequiredGrounding =
        expected.requiredGroundingSourceIds?.every((sourceId) =>
          groundingSourceIds.includes(sourceId)
        ) ?? true;
      const avoidsForbiddenGrounding =
        expected.forbiddenGroundingSourceIds?.every(
          (sourceId) => !groundingSourceIds.includes(sourceId)
        ) ?? true;
      const ok =
        result.route.path === expected.routePath &&
        hasReply === expected.hasReply &&
        groundingSourceIds.length >= expected.minGroundingSources &&
        hasRequiredGrounding &&
        avoidsForbiddenGrounding;

      cases.push({
        ticketId: ticket.id,
        source,
        expectedRoute: expected.routePath,
        actualRoute: result.route.path,
        classification,
        expectedReply: expected.hasReply,
        actualReply: hasReply,
        expectedMinGroundingSources: expected.minGroundingSources,
        groundingSourceIds,
        requiredGroundingSourceIds: expected.requiredGroundingSourceIds,
        forbiddenGroundingSourceIds: expected.forbiddenGroundingSourceIds,
        ok,
        ...(ok ? {} : { error: `Unexpected smoke result for ${ticket.id}` }),
      });

      smokeLog.info(
        {
          ticketId: ticket.id,
          ...classification,
          routePath: result.route.path,
        },
        `${ticket.id} -> classified ${classification.category} -> ${result.route.path}`
      );

      if (ok) {
        smokeLog.info(
          {
            ticketId: ticket.id,
            routePath: result.route.path,
            hasReply,
            groundingSourceIds,
          },
          `${ticket.id} -> ${result.route.path} -> reply ${hasReply ? "yes" : "no"}`
        );
      } else {
        smokeLog.error(
          {
            ticketId: ticket.id,
            expectedRoute: expected.routePath,
            actualRoute: result.route.path,
            expectedReply: expected.hasReply,
            actualReply: hasReply,
            expectedMinGroundingSources: expected.minGroundingSources,
            groundingSourceIds,
            requiredGroundingSourceIds: expected.requiredGroundingSourceIds,
            forbiddenGroundingSourceIds: expected.forbiddenGroundingSourceIds,
          },
          `WORKFLOW SMOKE FAILED: ${ticket.id}`
        );
      }
    } catch (error) {
      const errorMessage = toErrorMessage(error);

      cases.push({
        ticketId: ticket.id,
        source,
        expectedRoute: expected.routePath,
        expectedReply: expected.hasReply,
        expectedMinGroundingSources: expected.minGroundingSources,
        requiredGroundingSourceIds: expected.requiredGroundingSourceIds,
        forbiddenGroundingSourceIds: expected.forbiddenGroundingSourceIds,
        ok: false,
        error: errorMessage,
      });

      smokeLog.error(
        { ticketId: ticket.id, err: errorMessage },
        `WORKFLOW SMOKE ERRORED: ${ticket.id}`
      );
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
      ticketIds: smokeCases.map(({ ticket }) => ticket.id),
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

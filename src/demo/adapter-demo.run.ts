import { z } from "zod";
import { adapterDemoTickets, type SupportWebhookTicket } from "@/demo/adapter-fixtures";
import { createSlackHandoffMessage, type SlackHandoffMessage } from "@/demo/slack-handoff";
import { writeEvalLog } from "@/evals/shared/log-writer";
import { ClassifyTicketSchema } from "@/schemas/classify-ticket.schema";
import { DraftReplySchema } from "@/schemas/draft-reply.schema";
import { RouteTicketSchema } from "@/schemas/route-ticket.schema";
import { TicketSchema } from "@/schemas/ticket.schema";

const TriageResponseSchema = z.object({
  ticketId: z.string(),
  classification: ClassifyTicketSchema,
  route: RouteTicketSchema,
  reply: DraftReplySchema.optional(),
});

const TRAILING_SLASHES_PATTERN = /\/+$/;

type TriageResponse = z.infer<typeof TriageResponseSchema>;

type AdapterDemoCaseResult = {
  eventId: string;
  ticketId: string;
  status: "passed" | "failed";
  ok: boolean;
  durationMs?: number;
  route?: TriageResponse["route"]["path"];
  classification?: TriageResponse["classification"];
  hasReply?: boolean;
  groundingSourceIds?: string[];
  handoff?: SlackHandoffMessage;
  error?: string;
};

const requireEnv = (name: "TRIAGE_API_KEY" | "TRIAGE_API_URL") => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}. Set ${name} before running bun run demo:adapter.`);
  }

  return value;
};

const buildTriageUrl = (baseUrl: string) =>
  `${baseUrl.replace(TRAILING_SLASHES_PATTERN, "")}/triage`;

const readErrorBody = async (response: Response) => {
  const body = await response.text().catch(() => "");

  if (!body) {
    return "empty response body";
  }

  return body.length > 500 ? `${body.slice(0, 497)}...` : body;
};

const postTriage = async (
  triageUrl: string,
  apiKey: string,
  webhookTicket: SupportWebhookTicket
) => {
  const response = await fetch(triageUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ticket: webhookTicket.ticket }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errorBody = await readErrorBody(response);
    throw new Error(`POST /triage failed with HTTP ${response.status}: ${errorBody}`);
  }

  const payload = await response.json();

  return TriageResponseSchema.parse(payload);
};

const runAdapterCase = async (
  triageUrl: string,
  apiKey: string,
  webhookTicket: SupportWebhookTicket
): Promise<AdapterDemoCaseResult> => {
  const startedAt = performance.now();

  try {
    const ticket = TicketSchema.parse(webhookTicket.ticket);
    const result = await postTriage(triageUrl, apiKey, webhookTicket);
    const groundingSourceIds = result.reply?.groundingSourceIds ?? [];
    const hasReply = Boolean(result.reply);
    const expectationErrors = [
      result.route.path === webhookTicket.expected.routePath
        ? undefined
        : `expected route ${webhookTicket.expected.routePath}, received ${result.route.path}`,
      hasReply === webhookTicket.expected.hasReply
        ? undefined
        : `expected reply=${webhookTicket.expected.hasReply}, received reply=${hasReply}`,
    ].filter((message): message is string => Boolean(message));

    if (expectationErrors.length > 0) {
      return {
        eventId: webhookTicket.eventId,
        ticketId: ticket.id,
        status: "failed",
        ok: false,
        durationMs: Math.round(performance.now() - startedAt),
        route: result.route.path,
        classification: result.classification,
        hasReply,
        groundingSourceIds,
        error: expectationErrors.join("; "),
      };
    }

    const handoff = createSlackHandoffMessage(ticket, result);

    return {
      eventId: webhookTicket.eventId,
      ticketId: ticket.id,
      status: "passed",
      ok: true,
      durationMs: Math.round(performance.now() - startedAt),
      route: result.route.path,
      classification: result.classification,
      hasReply,
      groundingSourceIds,
      handoff,
    };
  } catch (error) {
    return {
      eventId: webhookTicket.eventId,
      ticketId: webhookTicket.ticket.id,
      status: "failed",
      ok: false,
      durationMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const printSummary = (cases: AdapterDemoCaseResult[], logPath: string) => {
  console.log("Slack handoff adapter dry run");

  for (const result of cases) {
    if (!result.ok) {
      console.log(`- ${result.ticketId}: failed in ${result.durationMs ?? 0}ms (${result.error})`);
      continue;
    }

    const grounding = result.groundingSourceIds?.length
      ? result.groundingSourceIds.join(", ")
      : "none";

    console.log(
      `- ${result.ticketId}: ${result.status} ${result.route}/${result.classification?.category}/${result.classification?.urgency}, reply=${result.hasReply}, grounding=${grounding}, ${result.durationMs}ms`
    );
  }

  console.log(`Outbox artifact: ${logPath}`);
};

const main = async () => {
  const triageApiUrl = requireEnv("TRIAGE_API_URL");
  const triageApiKey = requireEnv("TRIAGE_API_KEY");
  const triageUrl = buildTriageUrl(triageApiUrl);
  const cases: AdapterDemoCaseResult[] = [];

  for (const webhookTicket of adapterDemoTickets) {
    cases.push(await runAdapterCase(triageUrl, triageApiKey, webhookTicket));
  }

  const summary = {
    total: cases.length,
    handoffs: cases.filter((result) => result.ok).length,
    errors: cases.filter((result) => !result.ok).length,
  };

  const logPath = await writeEvalLog("adapter-demo", {
    runAt: new Date().toISOString(),
    script: "demo:adapter",
    dryRun: true,
    adapter: {
      input: "support_webhook_fixture",
      output: "slack_handoff_message",
      channel: "#support-triage",
      triageUrl,
    },
    summary,
    cases,
  });

  printSummary(cases, logPath);

  if (summary.errors > 0) {
    process.exitCode = 1;
  }
};

await main();

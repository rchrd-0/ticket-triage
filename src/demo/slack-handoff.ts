import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import type { DraftReply } from "@/schemas/draft-reply.schema";
import type { RouteTicket } from "@/schemas/route-ticket.schema";
import type { Ticket } from "@/schemas/ticket.schema";

type TriageResult = {
  ticketId: string;
  classification: ClassifiedTicket;
  route: RouteTicket;
  reply?: DraftReply;
};

export type SlackHandoffMessage = {
  channel: "#support-triage";
  text: string;
  blocks: Record<string, unknown>[];
  sourceTicketId: string;
  triageRoute: RouteTicket["path"];
  metadata: {
    category: ClassifiedTicket["category"];
    urgency: ClassifiedTicket["urgency"];
    needsHuman: boolean;
    routeReason: RouteTicket["reason"];
    groundingSourceIds: string[];
  };
  dryRun: true;
};

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
};

const formatGroundingIds = (groundingSourceIds: string[]) =>
  groundingSourceIds.length > 0 ? groundingSourceIds.join(", ") : "none";

const formatReplySection = (reply: DraftReply | undefined) => {
  if (!reply) {
    return "*Customer reply:* not generated. This ticket needs human review.";
  }

  return [
    "*Proposed customer reply*",
    `*Subject:* ${reply.subject}`,
    "```",
    reply.body,
    "```",
    "_Review before sending._",
  ].join("\n");
};

export const createSlackHandoffMessage = (
  ticket: Ticket,
  result: TriageResult
): SlackHandoffMessage => {
  const groundingSourceIds = result.reply?.groundingSourceIds ?? [];
  const routeLabel = result.route.path === "draft" ? "Draft ready" : "Human review";
  const headerText = `${routeLabel}: ${ticket.id}`;
  const text = `${routeLabel} for ${ticket.customer.name} (${result.classification.category}, ${result.classification.urgency})`;
  const summary = truncate(ticket.body.replace(/\s+/g, " ").trim(), 280);

  return {
    channel: "#support-triage",
    text,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: headerText,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*Category:* ${result.classification.category} | *Urgency:* ${result.classification.urgency} | *needsHuman:* ${result.classification.needsHuman}`,
          },
          {
            type: "mrkdwn",
            text: `*Route:* ${result.route.path} (${result.route.reason})`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Customer:* ${ticket.customer.name} <${ticket.customer.email}>\n*Product:* ${ticket.product}\n*Ticket summary:* ${summary}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: formatReplySection(result.reply),
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*Grounding source IDs:* ${formatGroundingIds(groundingSourceIds)}`,
          },
          {
            type: "mrkdwn",
            text: "Dry run only. No Slack message was posted.",
          },
        ],
      },
    ],
    sourceTicketId: ticket.id,
    triageRoute: result.route.path,
    metadata: {
      category: result.classification.category,
      urgency: result.classification.urgency,
      needsHuman: result.classification.needsHuman,
      routeReason: result.route.reason,
      groundingSourceIds,
    },
    dryRun: true,
  };
};

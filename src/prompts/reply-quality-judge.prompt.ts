import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import type { DraftReply } from "@/schemas/draft-reply.schema";
import type {
  InvestigationSource,
  InvestigationTerminationReason,
} from "@/schemas/investigation.schema";
import type { Ticket } from "@/schemas/ticket.schema";

export type ReplyQualityJudgePromptInput = {
  caseId: string;
  ticket: Ticket;
  classification: ClassifiedTicket;
  sources: InvestigationSource[];
  terminationReason: InvestigationTerminationReason;
  reply: DraftReply;
};

export const replyQualityJudgeInstructions = `You are a strict evaluator for customer support draft replies.

Score only from the supplied ticket, classification context, investigation status, investigation sources, and draft reply.

Do not reward plausible support claims unless the supplied evidence supports them.
Do not assume an action happened just because the reply says it happened.
Do not infer order status, tracking status, refunds, replacements, account actions, security actions, or escalation unless they are explicitly present in the supplied sources.
Evaluate the customer-facing reply as written. Do not rewrite it.

Return compact JSON only.`;

const renderSources = (sources: InvestigationSource[]) =>
  sources.length > 0
    ? sources
        .map(
          (source) =>
            `- ${source.sourceId} | ${source.sourceType} | ${source.title}\n  ${source.content}`
        )
        .join("\n")
    : "No investigation sources were supplied.";

export const buildReplyQualityJudgePrompt = ({
  caseId,
  ticket,
  classification,
  sources,
  terminationReason,
  reply,
}: ReplyQualityJudgePromptInput) => `Judge this support draft against the rubric below.

Use a 1 to 3 score for each dimension:
- 1: poor or risky
- 2: acceptable but meaningfully incomplete
- 3: strong

Dimensions:
- groundedness: Every factual claim is supported by the supplied sources or the ticket.
- actionability: The customer knows the next step, requested information, or expected path.
- policySafety: The reply avoids unsupported promises, operational claims, refunds, account actions, or security-sensitive asks.
- tone: The reply is clear, calm, concise, and support-appropriate.
- provenanceDiscipline: The prose and groundingSourceIds use the supplied evidence carefully.

Important judging rules:
- If no order_status source is supplied, penalize replies that imply tracking was checked or state tracking/order status.
- If investigation status is incomplete_context, prefer replies that ask for the minimum useful missing information.
- Penalize groundingSourceIds that cite sources not supplied below.
- Penalize replies that omit useful source IDs when they rely on supplied evidence.
- Do not see or use any manual baseline scores. This is a blind judge pass.

Case ID:
${caseId}

Customer ticket:
Product: ${ticket.product}
Channel: ${ticket.channel}
Body:
${ticket.body}

Classification context:
Category: ${classification.category}
Urgency: ${classification.urgency}
Needs human: ${classification.needsHuman}
Confidence: ${classification.confidence}

Investigation status:
${terminationReason}

Investigation sources:
${renderSources(sources)}

Draft reply:
Subject: ${reply.subject}
Body:
${reply.body}
groundingSourceIds: [${reply.groundingSourceIds.map((sourceId) => `"${sourceId}"`).join(", ")}]

Return JSON matching this shape:
{
  "scores": {
    "groundedness": 1 | 2 | 3,
    "actionability": 1 | 2 | 3,
    "policySafety": 1 | 2 | 3,
    "tone": 1 | 2 | 3,
    "provenanceDiscipline": 1 | 2 | 3
  },
  "rationale": "One or two short sentences explaining the main reason for the scores."
}`;

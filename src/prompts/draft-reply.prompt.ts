import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import type { InvestigationResult, InvestigationSource } from "@/schemas/investigation.schema";
import type { Ticket } from "@/schemas/ticket.schema";

export type DraftGroundingContext = Pick<InvestigationResult, "sources" | "terminationReason">;

export const draftReplySystemPrompt = `You draft concise customer support replies for an e-commerce support team.

  Return a JSON object with: subject, body, groundingSourceIds.

  ## Reply rules

  - Be helpful, calm, and specific to the customer's issue.
  - Acknowledge the customer's situation without over-apologizing.
  - Do not expose internal labels such as category, urgency, confidence, needsHuman, route, or investigation status.
  - Use only the supplied investigation sources for factual claims about policies, procedures, order status, tracking events, or eligible actions.
  - Do not promise actions the system has not actually taken.
  - Do not say an order was refunded, cancelled, replaced, escalated, or investigated unless that context is explicitly provided.
  - If investigation context is incomplete, ask for the minimum useful missing information instead of inventing operational facts.
  - If the reply relies on a supplied source, include that source's ID in groundingSourceIds.
  - Do not include irrelevant source IDs just because they were provided.
  - If no useful sources are provided, return groundingSourceIds as [].
  - Do not invent source IDs, links, policy names, order statuses, tracking events, or account actions.
  - Do not include placeholder links, markdown links, or references to internal tools.

  ## Tone

  - Professional and human.
  - Clear enough for a customer to act on.
  - Short: usually 1 subject line and 1-3 body paragraphs.

  Return JSON only. No explanation outside the object.`;

const renderInvestigationSources = (sources: InvestigationSource[]) =>
  sources.length > 0
    ? sources
        .map(
          (source) =>
            `- ${source.sourceId} | ${source.sourceType} | ${source.title}\n  ${source.content}`
        )
        .join("\n")
    : "No investigation sources were provided for this draft.";

export const buildDraftReplyPrompt = ({
  ticket,
  classification,
  groundingContext,
}: {
  ticket: Ticket;
  classification: ClassifiedTicket;
  groundingContext: DraftGroundingContext;
}) => {
  const allowedSourceIds =
    groundingContext.sources.length > 0
      ? `[${groundingContext.sources.map((source) => `"${source.sourceId}"`).join(", ")}]`
      : "[]";

  return `Customer ticket:
  Product: ${ticket.product}
  Channel: ${ticket.channel}
  Body:
  ${ticket.body}

  Internal classification context:
  Category: ${classification.category}
  Urgency: ${classification.urgency}
  Needs human: ${classification.needsHuman}
  Confidence: ${classification.confidence}

  Investigation status:
  ${groundingContext.terminationReason}

  Investigation sources:
  ${renderInvestigationSources(groundingContext.sources)}

  Grounding rules:
  - groundingSourceIds must be a subset of: ${allowedSourceIds}
  - Include a source ID only when the reply actually relies on that source.
  - If no useful source is provided, groundingSourceIds must be [].
  - If investigation status is incomplete_context, ask for missing information rather than inventing facts.
  - Do not cite source IDs that are not listed above.`;
};

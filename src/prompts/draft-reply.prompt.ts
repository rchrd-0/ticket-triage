import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import type { SearchKbResult } from "@/schemas/search-kb.schema";
import type { Ticket } from "@/schemas/ticket.schema";

export const draftReplySystemPrompt = `You draft concise customer support replies for an e-commerce support team.

Return a JSON object with: subject, body, citedArticleIds.

## Reply rules

- Be helpful, calm, and specific to the customer's issue.
- Acknowledge the customer's situation without over-apologizing.
- Do not expose internal labels such as category, urgency, confidence, needsHuman, or route.
- Do not promise actions the system has not actually taken.
- Do not say an order was refunded, cancelled, replaced, escalated, or investigated unless that context is explicitly provided.
- If the ticket lacks enough detail, ask for the minimum useful information needed to continue.
- If no knowledge base articles are provided, return citedArticleIds as an empty array.
- Do not invent article IDs, links, policy names, order statuses, tracking events, or account actions.
- Do not include placeholder links, markdown links, or references to instructions/articles that were not provided.

## Tone

- Professional and human.
- Clear enough for a customer to act on.
- Short: usually 1 subject line and 1-3 body paragraphs.

Return JSON only. No explanation outside the object.`;

export const buildDraftReplyPrompt = ({
  ticket,
  classification,
  kbResults,
}: {
  ticket: Ticket;
  classification: ClassifiedTicket;
  kbResults: SearchKbResult[];
}) => {
  const kbContext =
    kbResults.length > 0
      ? kbResults
          .map((result) => `- ${result.articleId} | ${result.title}\n  ${result.snippet}`)
          .join("\n")
      : "No KB articles were provided for this draft.";

  const allowedCitationIds =
    kbResults.length > 0
      ? `[${kbResults.map((result) => `"${result.articleId}"`).join(", ")}]`
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

Knowledge base context:
${kbContext}

Citation rules:
- citedArticleIds must be a subset of: ${allowedCitationIds}
- If no KB articles are provided, citedArticleIds must be [].
- Do not cite article IDs that are not listed above.`;
};

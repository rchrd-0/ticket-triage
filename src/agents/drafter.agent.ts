import { Agent } from "@mastra/core/agent";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { drafter } from "@/config/models";
import type { Ticket } from "@/domain/tickets";
import { buildDraftReplyPrompt, draftReplySystemPrompt } from "@/prompts/draft-reply.prompt";
import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import { type DraftReply, DraftReplySchema } from "@/schemas/draft-reply.schema";

export const drafterAgent = new Agent({
  id: "drafter-agent",
  name: "Drafter",
  instructions: draftReplySystemPrompt,
  model: `openrouter/${drafter.agentModel}`,
  defaultOptions: {
    modelSettings: {
      temperature: drafter.temperature,
    },
    providerOptions: {
      openrouter: {
        reasoning: drafter.reasoning,
      },
    },
  },
});

export const draftReply = async (
  ticket: Ticket,
  classification: ClassifiedTicket
): Promise<DraftReply> => {
  const prompt = buildDraftReplyPrompt({ ticket, classification });

  const { object } = await drafterAgent.generate(prompt, {
    structuredOutput: {
      schema: toStandardJsonSchema(DraftReplySchema),
    },
  });

  return object;
};

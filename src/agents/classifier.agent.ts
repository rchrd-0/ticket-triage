import { Agent } from "@mastra/core/agent";
import { classifier } from "@/config/models";
import { getOpenRouterUsage, type LlmRunUsage } from "@/lib/openrouter-usage";
import {
  buildClassifyTicketPrompt,
  classifyTicketSystemPrompt,
} from "@/prompts/classify-ticket.prompt";
import { type ClassifiedTicket, ClassifyTicketSchema } from "@/schemas/classify-ticket.schema";

export type ClassifyTicketResult = {
  classification: ClassifiedTicket;
  usage?: LlmRunUsage;
};

export const classifierAgent = new Agent({
  id: "classifier-agent",
  name: "Classifier",
  instructions: classifyTicketSystemPrompt,
  model: `openrouter/${classifier.agentModel}`,
  defaultOptions: {
    modelSettings: {
      temperature: classifier.temperature,
    },
    providerOptions: {
      openrouter: {
        reasoning: classifier.reasoning,
      },
    },
  },
});

export const classifyTicket = async (ticketBody: string): Promise<ClassifyTicketResult> => {
  const prompt = buildClassifyTicketPrompt(ticketBody);

  const { object, providerMetadata } = await classifierAgent.generate(prompt, {
    structuredOutput: {
      schema: ClassifyTicketSchema,
    },
  });

  return {
    classification: object,
    usage: getOpenRouterUsage(providerMetadata),
  };
};

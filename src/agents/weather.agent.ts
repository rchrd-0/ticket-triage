import { Agent } from "@mastra/core/agent";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import { classifier } from "@/config/models";
import {
  buildClassifyTicketPrompt,
  classifyTicketSystemPrompt,
} from "@/prompts/classify-ticket.prompt";
import { type ClassifiedTicket, ClassifyTicketSchema } from "@/schemas/classify-ticket.schema";

export const classifierAgent = new Agent({
  id: "classifier-agent",
  name: "classifier",
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

export const classifyTicket = async (ticketBody: string): Promise<ClassifiedTicket> => {
  const prompt = buildClassifyTicketPrompt(ticketBody);

  const { object } = await classifierAgent.generate(prompt, {
    structuredOutput: {
      schema: toStandardJsonSchema(ClassifyTicketSchema),
    },
  });

  return object;
};

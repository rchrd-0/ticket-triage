import { Agent } from "@mastra/core/agent";
import { generateText, Output } from "ai";
import { classifier } from "@/config/models";
import { aiTelemetry, getOpenRouterUsage, type LlmRunUsage, openrouter } from "@/lib/llm";
import {
  buildClassifyTicketPrompt,
  classifyTicketSystemPrompt,
} from "@/prompts/classify-ticket.prompt";
import { type ClassifiedTicket, ClassifyTicketSchema } from "@/schemas/classify-ticket.schema";

export type ClassifierAgentRun = {
  output: ClassifiedTicket;
  usage?: LlmRunUsage;
};

/** phase 1 AI sdk implementation, for eval purposes. pending removal */
export const classifierEvalAgent = async (ticketBody: string): Promise<ClassifierAgentRun> => {
  const { output, providerMetadata } = await generateText({
    model: openrouter.chat(classifier.agentModel, {
      usage: {
        include: true,
      },
    }),
    temperature: classifier.temperature,
    providerOptions: {
      openrouter: {
        reasoning: classifier.reasoning,
      },
    },
    system: classifyTicketSystemPrompt,
    prompt: buildClassifyTicketPrompt(ticketBody),
    output: Output.object({
      schema: ClassifyTicketSchema,
    }),
    experimental_telemetry: aiTelemetry({ functionId: "classify-ticket" }),
  });

  return {
    output,
    usage: getOpenRouterUsage(providerMetadata),
  };
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

export const classifyTicket = async (ticketBody: string): Promise<ClassifiedTicket> => {
  const prompt = buildClassifyTicketPrompt(ticketBody);

  const { object } = await classifierAgent.generate(prompt, {
    structuredOutput: {
      schema: ClassifyTicketSchema,
    },
  });

  return object;
};

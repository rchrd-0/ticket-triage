import { valibotSchema } from "@ai-sdk/valibot";
import { generateText, Output } from "ai";
import { classifier } from "@/config/models";
import { aiTelemetry, openrouter } from "@/lib/llm";
import {
  buildClassifyTicketPrompt,
  classifyTicketSystemPrompt,
} from "@/prompts/classify-ticket.prompt";
import { type ClassifiedTicket, ClassifyTicketSchema } from "@/schemas/classify-ticket.schema";

export const classifierAgent = async (ticketBody: string): Promise<ClassifiedTicket> => {
  const { output } = await generateText({
    model: openrouter.chat(classifier.agentModel),
    temperature: classifier.temperature,
    providerOptions: {
      openrouter: {
        reasoning: classifier.reasoning,
      },
    },
    system: classifyTicketSystemPrompt,
    prompt: buildClassifyTicketPrompt(ticketBody),
    output: Output.object({
      schema: valibotSchema(ClassifyTicketSchema),
    }),
    experimental_telemetry: aiTelemetry({ functionId: "classify-ticket" }),
  });

  return output;
};

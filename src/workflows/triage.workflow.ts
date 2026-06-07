import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { classifyTicket } from "@/agents/classifier.agent";
import { draftReply } from "@/agents/drafter.agent";
import { routeTicket } from "@/domain/routing";
import { ClassifyTicketSchema } from "@/schemas/classify-ticket.schema";
import { DraftReplySchema } from "@/schemas/draft-reply.schema";
import { RouteTicketSchema } from "@/schemas/route-ticket.schema";
import { TicketSchema } from "@/schemas/ticket.schema";

const TriageInputSchema = z.object({
  ticket: TicketSchema,
});

const ClassifyOutputSchema = z.object({
  ...TriageInputSchema.shape,
  classification: ClassifyTicketSchema,
});

const RouteOutputSchema = z.object({
  ...ClassifyOutputSchema.shape,
  route: RouteTicketSchema,
});

export const TriageOutputSchema = z.object({
  ticketId: z.string(),
  classification: ClassifyTicketSchema,
  route: RouteTicketSchema,
  reply: DraftReplySchema.optional(),
});

const classifyStep = createStep({
  id: "classify-ticket",
  inputSchema: TriageInputSchema,
  outputSchema: ClassifyOutputSchema,
  execute: async ({ inputData }) => {
    const { classification } = await classifyTicket(inputData.ticket.body);

    return {
      ticket: inputData.ticket,
      classification,
    };
  },
});

const routeStep = createStep({
  id: "route-ticket",
  inputSchema: ClassifyOutputSchema,
  outputSchema: RouteOutputSchema,
  // biome-ignore lint/suspicious/useAwait: Mastra execute must return a Promise; routeTicket is sync
  execute: async ({ inputData }) => {
    const route = routeTicket(inputData.classification);

    return {
      ...inputData,
      route,
    };
  },
});

const draftStep = createStep({
  id: "draft-reply",
  inputSchema: RouteOutputSchema,
  outputSchema: TriageOutputSchema,
  execute: async ({ inputData }) => {
    const reply = await draftReply(inputData.ticket, inputData.classification);

    return {
      ticketId: inputData.ticket.id,
      classification: inputData.classification,
      route: inputData.route,
      reply,
    };
  },
});

export const humanStep = createStep({
  id: "human-review",
  inputSchema: RouteOutputSchema,
  outputSchema: TriageOutputSchema,
  execute: async ({ inputData }) => ({
    ticketId: inputData.ticket.id,
    classification: inputData.classification,
    route: inputData.route,
  }),
});

export const triageWorkflow = createWorkflow({
  id: "triage-workflow",
  inputSchema: TriageInputSchema,
  outputSchema: TriageOutputSchema,
})
  .then(classifyStep)
  .then(routeStep)
  .branch([
    [async ({ inputData }) => inputData.route.path === "draft", draftStep],
    [async ({ inputData }) => inputData.route.path === "human_review", humanStep],
  ])
  .commit();

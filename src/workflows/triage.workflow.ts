import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { classifyTicket } from "@/agents/classifier.agent";
import { draftReply } from "@/agents/drafter.agent";
import { buildKbSearchQuery } from "@/domain/kb-query";
import { routeTicket } from "@/domain/routing";
import { ClassifyTicketSchema } from "@/schemas/classify-ticket.schema";
import { DraftReplySchema } from "@/schemas/draft-reply.schema";
import { RouteTicketSchema } from "@/schemas/route-ticket.schema";
import { SearchKbResultSchema } from "@/schemas/search-kb.schema";
import { TicketSchema } from "@/schemas/ticket.schema";
import { searchKb } from "@/tools/search-kb";

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

const RetrievedRouteOutputSchema = z.object({
  ...RouteOutputSchema.shape,
  kbResults: z.array(SearchKbResultSchema),
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

const retrieveKbStep = createStep({
  id: "retrieve-kb-context",
  inputSchema: RouteOutputSchema,
  outputSchema: RetrievedRouteOutputSchema,
  // biome-ignore lint/suspicious/useAwait: Mastra execute must return a Promise; searchKb is sync
  execute: async ({ inputData }) => {
    const searchQuery = buildKbSearchQuery(
      inputData.classification.category,
      inputData.ticket.body
    );

    const kbResults = searchKb(searchQuery);

    return {
      ...inputData,
      kbResults,
    };
  },
});

const draftStep = createStep({
  id: "draft-reply",
  inputSchema: RetrievedRouteOutputSchema,
  outputSchema: TriageOutputSchema,
  execute: async ({ inputData }) => {
    const reply = await draftReply(inputData.ticket, inputData.classification, inputData.kbResults);

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

const draftWorkflow = createWorkflow({
  id: "draft-workflow",
  inputSchema: RouteOutputSchema,
  outputSchema: TriageOutputSchema,
})
  .then(retrieveKbStep)
  .then(draftStep)
  .commit();

export const triageWorkflow = createWorkflow({
  id: "triage-workflow",
  inputSchema: TriageInputSchema,
  outputSchema: TriageOutputSchema,
})
  .then(classifyStep)
  .then(routeStep)
  .branch([
    [async ({ inputData }) => inputData.route.path === "draft", draftWorkflow],
    [async ({ inputData }) => inputData.route.path === "human_review", humanStep],
  ])
  .commit();

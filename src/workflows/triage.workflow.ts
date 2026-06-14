import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { classifyTicket } from "@/agents/classifier.agent";
import { draftReply } from "@/agents/drafter.agent";
import { investigateTicket } from "@/agents/investigator.agent";
import { routeTicket } from "@/domain/routing";
import { ClassifyTicketSchema } from "@/schemas/classify-ticket.schema";
import { DraftReplySchema } from "@/schemas/draft-reply.schema";
import { InvestigationResultSchema } from "@/schemas/investigation.schema";
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

const InvestigatedRouteOutputSchema = z.object({
  ...RouteOutputSchema.shape,
  investigation: InvestigationResultSchema,
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
  execute: ({ inputData }) => {
    const route = routeTicket(inputData.classification);

    return Promise.resolve({
      ...inputData,
      route,
    });
  },
});

const investigateContextStep = createStep({
  id: "investigate-context",
  inputSchema: RouteOutputSchema,
  outputSchema: InvestigatedRouteOutputSchema,
  execute: async ({ inputData }) => {
    const investigationContext = await investigateTicket(
      inputData.ticket,
      inputData.classification
    );

    return {
      ...inputData,
      investigation: investigationContext,
    };
  },
});

const draftStep = createStep({
  id: "draft-reply",
  inputSchema: InvestigatedRouteOutputSchema,
  outputSchema: TriageOutputSchema,
  execute: async ({ inputData }) => {
    const reply = await draftReply(inputData.ticket, inputData.classification, {
      sources: inputData.investigation.sources,
      terminationReason: inputData.investigation.terminationReason,
    });

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
  .then(investigateContextStep)
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

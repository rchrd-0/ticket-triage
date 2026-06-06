import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import type { RouteTicket } from "@/schemas/route-ticket.schema";

export const routeTicket = (classification: ClassifiedTicket): RouteTicket => {
  if (classification.needsHuman) {
    return {
      path: "human_review",
      reason: "classifier_requires_human",
    };
  }

  return {
    path: "draft",
    reason: "automatable",
  };
};

import type { ClassifiedTicket } from "@/schemas/classify-ticket.schema";
import type { RouteTicket } from "@/schemas/route-ticket.schema";

export const routeTicket = (classifiction: ClassifiedTicket): RouteTicket => {
  if (classifiction.needsHuman) {
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

export type TicketChannel = "email" | "web_form" | "chat" | "phone" | "social";

export type Ticket = {
  id: string;
  channel: TicketChannel;
  product: string;
  body: string;
  customer: {
    name: string;
    email: string;
  };
  /** dev/eval only, can strip before prompting */
  metaLabels?: {
    category: string;
    priority: string;
    escalated: boolean;
  };
};

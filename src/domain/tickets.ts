export type TicketChannel = "email" | "chat" | "phone" | "social";

export type Ticket = {
  id: string;
  channel: TicketChannel;
  product: string;
  body: string;
  customer: {
    name: string;
    email: string;
  };
};

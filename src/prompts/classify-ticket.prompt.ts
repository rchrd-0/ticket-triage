export const buildClassifyTicketPrompt = (ticket: string) => `
You classify customer support tickets on an e-commerce platform.

Return a JSON object only.

Ticket:
${ticket}
`;

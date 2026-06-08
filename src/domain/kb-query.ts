import type { TicketCategories } from "@/schemas/classify-ticket.schema";
import { DEFAULT_SEARCH_KB_LIMIT, type SearchKbInput } from "@/schemas/search-kb.schema";

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const ORDER_ID_REGEX = /\bORD-\d+\b/gi;

const stripEmails = (text: string): string =>
  text.replace(EMAIL_REGEX, " ").replace(/\s+/g, " ").trim();

const stripOrderIds = (text: string): string =>
  text.replace(ORDER_ID_REGEX, " ").replace(/\s+/g, " ").trim();

const sanitizeKbQuery = (ticketBody: string): string => {
  let sanitized = stripEmails(ticketBody);
  sanitized = stripOrderIds(sanitized);
  sanitized = sanitized.toLowerCase();

  return sanitized.replace(/\s+/g, " ").trim();
};

export const buildKbSearchQuery = (
  category: TicketCategories,
  ticketBody: string,
  limit = DEFAULT_SEARCH_KB_LIMIT
): SearchKbInput => {
  const sanitized = sanitizeKbQuery(ticketBody);

  return {
    category,
    limit,
    query: sanitized,
  };
};

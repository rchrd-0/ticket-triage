import { createReadStream, promises } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import type { Ticket, TicketChannel } from "@/domain/tickets";

type CsvRow = {
  ticket_id: string;
  customer_name: string;
  customer_email: string;
  product: string;
  category: string;
  issue_description: string;
  priority: string;
  channel: string;
  escalated: string;
};

const SAMPLE_SIZE = 500;
const MAX_PER_CATEGORY = SAMPLE_SIZE / 10;

const csvPath = path.resolve(import.meta.dir, "..", "data", "customer_support_tickets_200k.csv");
const outPath = path.resolve(import.meta.dir, "..", "src", "fixtures", "tickets.json");
const csvStream = createReadStream(csvPath);

const channelByCsv: Record<string, TicketChannel> = {
  Email: "email",
  "Web Form": "web_form",
  Chat: "chat",
  Phone: "phone",
  "Social Media": "social",
};

const mapRowToTicket = (row: CsvRow): Ticket | null => {
  const channel = channelByCsv[row.channel];
  if (!channel) {
    return null;
  }

  const body = row.issue_description?.trim();
  if (!body) {
    return null;
  }

  return {
    id: row.ticket_id,
    channel,
    product: row.product,
    body,
    customer: {
      name: row.customer_name,
      email: row.customer_email,
    },
    metaLabels: {
      category: row.category,
      priority: row.priority,
      escalated: row.escalated === "Yes",
    },
  };
};

const perCategory = new Map<string, number>();

const tickets = await new Promise<Ticket[]>((resolve, reject) => {
  const collected: Ticket[] = [];

  Papa.parse<CsvRow>(csvStream, {
    header: true,
    skipEmptyLines: true,
    step: (result, parser) => {
      if (collected.length >= SAMPLE_SIZE) {
        parser.abort();

        return;
      }

      const row = result.data;
      const { category } = row;

      const count = perCategory.get(category) ?? 0;
      if (count >= MAX_PER_CATEGORY) {
        return;
      }

      const ticket = mapRowToTicket(row);
      if (!ticket) {
        return;
      }

      perCategory.set(category, count + 1);
      collected.push(ticket);
    },
    complete: () => resolve(collected),
    error: (error: unknown) => reject(error),
  });
});

await promises.mkdir(path.dirname(outPath), { recursive: true });
await promises.writeFile(outPath, `${JSON.stringify(tickets, null, 2)}\n`, "utf8");

console.log(`Wrote ${tickets.length} tickets to ${outPath}`);
console.log(
  `Categories: ${[...perCategory.entries()].map(([key, value]) => `${key}=${value}`).join(", ")}`
);

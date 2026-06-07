import { createReadStream, promises } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import type { TICKET_CHANNELS, Ticket } from "../src/schemas/ticket.schema";

type TicketChannel = (typeof TICKET_CHANNELS)[number];

type CsvRow = {
  "Ticket ID": string;
  "Customer Name": string;
  "Customer Email": string;
  "Product Purchased": string;
  "Ticket Description": string;
  "Ticket Channel": string;
  "Ticket Subject": string;
};

const SAMPLE_SIZE = 500;
const MAX_PER_SUBJECT = Math.ceil(SAMPLE_SIZE / 16); // ~16 distinct ticket subjects in dataset

const csvPath = path.resolve(import.meta.dir, "..", "data", "customer_support_tickets.csv");
const outPath = path.resolve(import.meta.dir, "..", "src", "fixtures", "tickets.json");
const csvStream = createReadStream(csvPath);

const channelByCsv: Record<string, TicketChannel> = {
  Email: "email",
  Chat: "chat",
  Phone: "phone",
  "Social media": "social",
};

const mapRowToTicket = (row: CsvRow): Ticket | null => {
  const channel = channelByCsv[row["Ticket Channel"]];
  if (!channel) {
    return null;
  }

  const product = row["Product Purchased"]?.trim();
  if (!product) {
    return null;
  }

  const body = row["Ticket Description"]?.trim().replace(/\{product_purchased\}/gi, product);
  if (!body) {
    return null;
  }

  return {
    id: row["Ticket ID"],
    channel,
    product,
    body,
    customer: {
      name: row["Customer Name"],
      email: row["Customer Email"],
    },
  };
};

const perSubject = new Map<string, number>();
const uniqueBodyCount = new Map<string, number>();

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
      const subject = row["Ticket Subject"];

      const count = perSubject.get(subject) ?? 0;
      if (count >= MAX_PER_SUBJECT) {
        return;
      }

      const ticket = mapRowToTicket(row);
      if (!ticket) {
        return;
      }

      const bodyCount = uniqueBodyCount.get(ticket.body) ?? 0;
      uniqueBodyCount.set(ticket.body, bodyCount + 1);

      perSubject.set(subject, count + 1);
      collected.push(ticket);
    },
    complete: () => {
      const uniqueBodies = uniqueBodyCount.size;
      const duplicateRows = collected.length - uniqueBodies;
      const bodiesWithDuplicates = [...uniqueBodyCount.values()].filter(
        (count) => count > 1
      ).length;

      console.log({
        totalTickets: collected.length,
        uniqueBodies,
        duplicateRows,
        duplicateRowPct: (duplicateRows / collected.length) * 100,
        bodiesWithDuplicates,
      });

      resolve(collected);
    },
    error: (error: unknown) => reject(error),
  });
});

await promises.mkdir(path.dirname(outPath), { recursive: true });
await promises.writeFile(outPath, `${JSON.stringify(tickets, null, 2)}\n`, "utf8");

console.log(`Wrote ${tickets.length} tickets to ${outPath}`);
console.log(
  `Subjects: ${[...perSubject.entries()].map(([key, value]) => `${key}=${value}`).join(", ")}`
);

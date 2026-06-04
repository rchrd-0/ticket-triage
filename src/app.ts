import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "@/lib/instrumentation";
import { classifierAgent } from "@/agents/classifier.agent";
import type { Ticket } from "@/domain/tickets";
import { flushLangfuseTraces } from "@/lib/instrumentation";

const fixturesPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "tickets.json"
);
const allTickets = JSON.parse(await readFile(fixturesPath, "utf8")) as Ticket[];
const tickets = allTickets.slice(0, 5);

for await (const ticket of tickets) {
  console.log(`Classifying ticket ${ticket.id} (${ticket.product})...`);

  const classification = await classifierAgent(ticket.body);

  // console.dir(JSON.stringify({ id: ticket.id, body: ticket.body, classification }, null, 2));
  console.dir(
    {
      id: ticket.id,
      body: ticket.body,
      classification,
    },
    {
      depth: null,
      colors: true,
    }
  );
}

await flushLangfuseTraces();

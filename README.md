# ticket-triage

AI-powered support ticket triage capstone built with TypeScript, Bun, Mastra, and Cloudflare
Workers.

Current workflow:

```text
ticket -> classify -> route
  -> draft: investigate with read-only tools -> draft grounded reply
  -> human_review: omit automated reply
```

The draft branch uses a bounded local investigator with read-only KB, SOP, and order-status tools.
Tool results are normalized into investigation sources, and drafted replies return
`groundingSourceIds` that must come from the supplied sources. The internal workflow uses local
Mastra tools; the same read-only support context tools are also exposed through a local stdio MCP
server for external AI clients.

## Setup

```bash
bun install
```

Create local environment files from the project notes or deployment docs. Required secrets include
OpenRouter and Langfuse credentials; `TRIAGE_API_KEY` is required for the private Worker endpoint.

## Common Commands

```bash
bun run dev              # Mastra Studio on localhost:4111
bun run check-types      # TypeScript
bun run check            # Ultracite
bun test                 # Unit tests
bun run eval:classifier  # Model-backed classifier eval
bun run eval:drafter     # Model-backed drafter grounding eval
bun run workflow:smoke   # End-to-end workflow smoke
```

Model-backed evals call OpenRouter and may spend provider budget. Generated JSON eval logs are
written under `logs/` and are intentionally ignored by git.

## Worker API

The deployed Worker exposes:

- `GET /health`
- `POST /triage`, protected by `Authorization: Bearer <TRIAGE_API_KEY>`

Local and deployment commands:

```bash
bun run worker:types
bun run dev:worker
bun run deploy:worker:dry-run
bun run deploy:worker
```

The Worker keeps MCP out of the deployed runtime. Local MCP validation uses:

```bash
bun run mcp:stdio
bun run mcp:inspect
```

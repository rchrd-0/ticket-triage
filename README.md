# ticket-triage

AI-powered support ticket triage API for e-commerce-style support requests. It classifies incoming
tickets, routes safe cases to a grounded draft-reply workflow, and sends high-risk cases to human
review without generating customer-facing copy.

## Workflow

```text
ticket
  -> classify
  -> route
    -> draft: investigate read-only support context -> draft grounded reply
    -> human_review: return classification and route only
```

The draft branch investigates local support context through read-only KB, SOP, and order-status
tools. Tool results are normalized into sources, and generated replies return `groundingSourceIds`
that must come from the supplied sources.

## Demo

Live private endpoint:

```text
https://ticket-triage.rchrd.dev
```

`POST /triage` is protected with `Authorization: Bearer <TRIAGE_API_KEY>`.

```bash
export TRIAGE_BASE_URL="https://ticket-triage.rchrd.dev"
export TRIAGE_API_KEY="replace-with-private-demo-key"

curl -sS -w "\nHTTP %{http_code} in %{time_total}s\n" "$TRIAGE_BASE_URL/health"
```

[demo.http](demo.http) includes one draftable delayed-shipping request and one human-review security
request.

Expected response shapes:

| Case | Expected shape |
|---|---|
| Draftable shipping | `route.path: "draft"`, `reply` present, `reply.groundingSourceIds` populated |
| Security human review | `route.path: "human_review"`, `reply` omitted |

## Local setup

```bash
bun install
cp .env.example .env
```

Fill the local `.env` with OpenRouter and Langfuse credentials. `TRIAGE_API_KEY` is required for the
private Worker endpoint.

Commands that start Mastra or call model-backed evals require these secrets. Without them, startup
fails early with explicit environment-variable validation errors.

## Commands

| Command | Purpose |
|---|---|
| `bun run dev` | Mastra Studio on `localhost:4111` |
| `bun run dev:worker` | Local Cloudflare Worker |
| `bun run worker:types` | Generate Worker binding types |
| `bun run check-types` | TypeScript project check |
| `bun run check` | Ultracite static check |
| `bun test` | Unit tests |
| `bun run eval:classifier` | Model-backed classifier golden eval |
| `bun run eval:drafter` | Model-backed drafter grounding eval |
| `bun run workflow:smoke` | End-to-end workflow smoke |
| `bun run deploy:worker:dry-run` | Validate Worker bundle without publishing |
| `bun run deploy:worker` | Deploy the Worker |
| `bun run mcp:stdio` | Start the local stdio MCP server |
| `bun run mcp:inspect` | Inspect the local MCP server |

Model-backed evals call OpenRouter and may spend provider budget. Generated JSON eval logs are
written under `logs/` and are intentionally ignored by git.

## Evaluation snapshot

Latest recorded eval results:

| Check | Result | Notes |
|---|---:|---|
| Local checks | pass | `worker:types`, `check-types`, `check`, and unit tests |
| Classifier golden eval | 19/20 primary | 20 hand-authored cases; one conservative human-review false positive |
| Drafter grounding eval | 7/7 | Controlled-context source-ID checks |
| Drafter v6.2 stability sweep | 15/15 runs | Full drafter eval passed at 7/7 cases each run |
| Workflow smoke | 4/4 | Draft, found-order, unknown-order, and human-review branches |
| Deployed Worker smoke | pass | Last recorded deployed triage smoke covered health, draft shipping, and security human review |

See [docs/evals.md](docs/evals.md) for the eval-layer summary, tuning decisions, and known limits.

## Cost and latency

Current profile from Phase 6 recorded evidence:

| Surface | Measurement | Result | Notes |
|---|---:|---:|---|
| Classifier eval | Average case latency | 1.76 s | 20 cases, bounded worker pool, OpenRouter |
| Classifier eval | Cost per case | ~0.000119 credits | 0.002378 credits total across 20 cases |
| Deployed Worker | Draft shipping request | 8.20 s | Full `/triage` path with classification, investigation, drafting, and observability flush scheduled |
| Deployed Worker | Security human-review request | 1.99 s | Full `/triage` path, no investigation or draft reply |

Latency is provider- and network-sensitive. Classifier timings are per model call inside the eval
runner; Worker timings are end-to-end HTTP durations. Workflow smoke currently validates branch
behavior but does not publish per-step timings, so deeper phase timing is inspected in Langfuse
traces.

## Architecture

| Layer | Current choice |
|---|---|
| Runtime | TypeScript + Bun |
| AI workflow | Mastra agents and workflows |
| Model gateway | OpenRouter |
| API | Cloudflare Workers + Hono |
| Validation | Zod |
| Observability | Mastra observability + Langfuse |
| Support context | Local KB, SOP, and mock order fixtures |
| External tool surface | Local stdio MCP server for read-only support context tools |

Useful entry points:

- [src/workflows/triage.workflow.ts](src/workflows/triage.workflow.ts) - classify, route, draft, and human-review branches
- [src/worker.ts](src/worker.ts) - Worker API, auth, validation, and workflow invocation
- [src/evals](src/evals) - classifier, drafter, and workflow eval runners
- [demo.http](demo.http) - live API demo requests

See [docs/architecture.md](docs/architecture.md) for the request path and runtime boundaries.

## Limitations

- The live API uses a private bearer token; it is not browser-safe public auth.
- There is no persistence, ticket history, user account system, or human-review queue.
- Support context is fixture-backed, not production customer data.
- Eval sets are intentionally small and hand-authored; they are regression checks, not broad
  statistical guarantees.
- Kaggle-derived tickets were used only for early noisy fixtures, not as training data or eval
  ground truth.

# ticket-triage

AI-powered support ticket triage API for e-commerce-style support requests. It classifies incoming
tickets, routes safe cases to a grounded draft-reply workflow, and sends high-risk cases to human
review without generating customer-facing copy.

## Workflow

```text
incoming ticket
  -> classify
  -> route
     -> draft: investigate support context -> draft grounded reply
     -> human_review: return classification and route only
  -> triage API response
  -> optional Slack-shaped dry-run handoff
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
export TRIAGE_API_URL="https://ticket-triage.rchrd.dev"
export TRIAGE_API_KEY="replace-with-private-demo-key"

curl -sS -w "\nHTTP %{http_code} in %{time_total}s\n" "$TRIAGE_API_URL/health"
```

[demo.http](demo.http) includes one draftable delayed-shipping request and one human-review security
request.

For a lightweight handoff demo, `bun run demo:adapter` reads two webhook-shaped support-ticket
fixtures, calls `POST /triage`, and writes Slack-shaped dry-run handoff messages under `logs/`. It
does not call the Slack API or create external state.

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

Fill the local `.env` with OpenRouter and Langfuse credentials. `TRIAGE_API_URL` and
`TRIAGE_API_KEY` are required for private Worker API demos.

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
| `bun run eval:reply-quality` | Model-backed reply-quality scorer eval |
| `bun run workflow:smoke` | End-to-end workflow smoke |
| `bun run demo:adapter` | Dry-run Slack-shaped handoff demo through the Worker API |
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
| Local checks | pass | `check-types`, `check`, and 55 unit tests |
| Classifier golden eval | 20/20 primary | 20 hand-authored cases; urgency 19/20 |
| Drafter grounding eval | 7/7 | Controlled-context source-ID checks |
| Reply-quality scorer eval | 7/7 deterministic | Provenance, reply presence, and unknown-order guardrail |
| Advisory reply-quality judge sweep | 3/3 runs | Judge completed 7/7 cases each run; advisory only |
| Drafter v6.3 prompt | current | Tightened review-step and policy-question wording |
| Workflow smoke | 4/4 | Draft, found-order, unknown-order, and human-review branches |
| Deployed Worker smoke | pass | Last recorded deployed triage smoke covered health, draft shipping, and security human review |

See [docs/evals.md](docs/evals.md) for the eval-layer summary, tuning decisions, and known limits.

## Quality claims

| Claim | Evidence |
|---|---|
| Classifier routes the current golden set correctly on primary fields | `bun run eval:classifier`; summarized in [docs/evals.md](docs/evals.md) |
| Draft replies cite only supplied investigation sources | `bun run eval:drafter`; controlled grounding cases |
| Reply quality has deterministic regression checks plus an advisory judge | `bun run eval:reply-quality`; optional `REPLY_QUALITY_JUDGE=1` |
| Live API supports both draft and human-review branches | `demo.http` and `bun run workflow:smoke` |
| Slack handoff is an adapter demo, not core API coupling | `bun run demo:adapter`; dry-run local artifact only |

## Cost and latency

Current profile from Phase 6 recorded evidence:

| Surface | Measurement | Result | Notes |
|---|---:|---:|---|
| Classifier eval | Average case latency | 1.76 s | 20 cases, bounded worker pool, OpenRouter |
| Classifier eval | Cost per case | ~0.000119 credits | 0.002378 credits total across 20 cases |
| Deployed Worker | Draft shipping request | 8.20 s | Full `/triage` path with classification, investigation, drafting, and observability flush scheduled |
| Deployed Worker | Security human-review request | 1.99 s | Full `/triage` path, no investigation or draft reply |
| Adapter demo | Dry-run handoff | local artifact only | Calls `/triage`, then writes Slack-shaped messages under `logs/` without posting to Slack |

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
- [src/demo](src/demo) - dry-run Slack-shaped handoff adapter demo
- [src/evals](src/evals) - grouped eval runners, scorers, datasets, and shared eval helpers
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

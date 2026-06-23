# Architecture

`ticket-triage` exposes one private HTTP API over the same Mastra workflow used by local evals and
development tools.

## Request path

```text
client
  -> Cloudflare Worker
  -> Mastra triage workflow
    -> classify ticket
    -> route ticket
      -> draft: investigate read-only support context -> draft grounded reply
      -> human_review: return classification and route only
  -> optional local demo adapter writes Slack-shaped handoff artifact
```

The draft path can use KB, SOP, and order-status context. Human-review cases skip investigation and
do not generate a customer reply.

## Runtime boundaries

| Surface | Role |
|---|---|
| Cloudflare Worker | HTTP API, bearer-token auth, validation, workflow invocation |
| Mastra workflow | Classify, route, investigate, and draft orchestration |
| Local support tools | Read-only KB, SOP, and mock order context |
| Local MCP stdio server | External AI-client access to the same read-only support tools |
| Langfuse | Workflow and model-call observability |
| Demo adapter | Local dry-run script that calls `/triage` and writes Slack-shaped handoff logs |

## Important boundaries

- The Worker imports the MCP-free Mastra core and does not bundle the local MCP server.
- MCP is local stdio only; it is not exposed as a deployed HTTP surface.
- `/triage` is protected by a private bearer token and is not browser-safe public auth.
- Support context is fixture-backed, not production customer data.
- Human review is a route result, not a queue, assignment system, or reviewer UI.
- Draft replies include `groundingSourceIds`; those IDs must come from supplied investigation
  sources.
- The Slack-shaped handoff is a local dry-run adapter demo; it does not call Slack, create external
  state, or change the core `/triage` response contract.

## Entry points

- [src/worker.ts](../src/worker.ts) - Worker API, auth, validation, and workflow invocation
- [src/mastra/core.ts](../src/mastra/core.ts) - MCP-free Mastra runtime for Worker and local scripts
- [src/index.ts](../src/index.ts) - local Mastra app registration, including MCP
- [src/workflows/triage.workflow.ts](../src/workflows/triage.workflow.ts) - classify, route, draft, and human-review workflow
- [src/mcp/support-context.stdio.ts](../src/mcp/support-context.stdio.ts) - local stdio MCP server
- [src/demo](../src/demo) - dry-run Slack-shaped handoff adapter demo

# Evals

Current evals are small, hand-authored regression checks for the triage workflow. They are designed
to catch routing, grounding, and branch-behavior regressions before prompt or workflow changes are
treated as improvements.

## Current results

Latest recorded eval snapshot:

| Layer | Check | Result | Notes |
|---|---|---:|---|
| Classifier | Golden eval | 20/20 primary | 20 hand-authored cases; urgency 19/20 |
| Drafter | Grounding eval | 7/7 | 7 controlled-context cases; source IDs must come from supplied sources |
| Drafter | Reply-quality scorer eval | 7/7 deterministic | 7 generated replies checked for provenance, reply presence, and unknown-order guardrail |
| Drafter | Advisory reply-quality judge sweep | 3/3 runs | Deterministic checks passed 7/7 each run; judge completed 7/7 each run |
| Drafter | v6.2 grounding stability sweep | 15/15 runs | Each run passed all 7 grounding cases |
| Workflow | Smoke | 4/4 | Draft, found-order, unknown-order, and human-review branches |
| Worker | Last recorded deployed triage smoke | pass | Health, draft shipping, and security human-review requests |

The Worker is now available at `https://ticket-triage.rchrd.dev`. Health has been verified on the
custom domain; the last recorded deployed `/triage` smoke predates the v6.2 drafter prompt update.

## Limits

- These are regression checks, not statistical guarantees.
- Eval sets are intentionally small and hand-authored.
- Kaggle-derived tickets are not used as training data or eval ground truth.
- Model-backed evals call OpenRouter and may spend provider budget.
- LLM judge output is advisory calibration evidence, not an objective pass/fail gate.
- Phase 6 eval runners use bounded concurrency, so latency should only be compared against runs with
  the same runner shape, model, provider path, and worker count.

## Eval layers

| Layer | Command or check | Validates |
|---|---|---|
| Classification | `bun run eval:classifier` | Route-critical structured output over 20 golden tickets |
| Lexical retrieval | Deterministic tests | Query construction and fixture-backed lexical search mechanics |
| Drafter | `bun run eval:drafter` | Citation discipline with controlled supplied sources |
| Reply quality | `bun run eval:reply-quality` | Prose-level grounding, actionability, policy safety, tone, provenance, and deterministic reply contracts |
| Reply quality judge | `REPLY_QUALITY_JUDGE=1 bun run eval:reply-quality` | Advisory LLM-judge comparison against the manual five-dimension baseline |
| Workflow | `bun run workflow:smoke` | End-to-end branch wiring across the main routes |
| Worker | Deployed smoke and `demo.http` | Live API path behind private bearer-token auth |
| MCP | `bun run mcp:inspect` | Local stdio exposure for read-only support context tools |

## Quality findings

- The latest classifier snapshot has no primary misses; one ordinary shipping case is lower urgency
  than the golden label.
- Drafter v6.2 fixed an unknown-order failure where valid source IDs still accompanied unsupported
  prose about tracking or order lookup status.
- Drafter v6.3 tightened review-step wording and policy/process question handling.
- One watch item remains: the found-order shipping reply can loosely paraphrase tracking and review
  details. If this remains noisy, prefer exact latest tracking-event wording from order-status
  sources.

## Classifier baseline and tuning

Current classifier baseline:

| Item | Current stance |
|---|---|
| Dataset | 20 hand-authored golden tickets |
| Primary metric | Category and `needsHuman` both correct |
| Model | `deepseek/deepseek-v4-flash` via OpenRouter |
| Temperature | `0` |
| Latest recorded result | 20/20 primary |

Prompt and schema path:

| Version | Change | Decision |
|---|---|---|
| v1.0 | Minimal prompt | Baseline; categories mostly right, `needsHuman` and urgency weak |
| v1.1 | System/user split plus urgency rubric | Keep urgency rubric |
| v1.2 | Explicit `needsHuman` criteria | Keep; fewer unnecessary escalations |
| v1.3 | Category taxonomy | Keep as prompt documentation |
| v1.4 | Disambiguation rules | Adopt as prompt baseline; category and urgency reached 12/12 |
| v1.5 | SOP-resolvable refinement | Reject; no net gain and stable urgency regression |
| v1.4 + schema descriptions | Field-level structured-output descriptions | Keep; improved stability across three runs |

Other classifier decisions:

- Keep temperature at `0`; small non-zero temperatures increased variance.
- Keep reasoning off for classifier runs.
- Track confidence, but do not route on it until it is calibrated.
- Prefer conservative human-review false positives over unsafe automated false negatives.
- Switch classifier models only after repeated eval runs on the same dataset and prompt.

## Drafter baseline and tuning

Prompt changes are made against a written failure mode, then checked for regressions before becoming
the new baseline.

The v6 drafter tuning focused first on one failure: unknown-order shipping replies could cite valid
SOP sources while still implying that tracking or order records had been checked. The v6.2 prompt
kept the prose fix and restored SOP citation stability across a 15-run sweep. The v6.3 prompt then
added small judge-guided wording guardrails for review steps, invented timelines, and
policy/process questions.

| Version | Decision |
|---|---|
| v6.0 | Stable source IDs, but unsupported unknown-order prose |
| v6.1 | Better prose, but SOP citation regression |
| v6.2 | Kept the prose fix and restored citation stability |
| v6.3 | Current working prompt; tightened review-step and policy-question wording |

## What this does not cover yet

| Check | Decision | Reason |
|---|---|---|
| Combined RAG eval | Retired after first passing baseline | It duplicated deterministic retrieval tests and let upstream behavior obscure drafter results |
| Strict retrieval ranking eval | Deferred | Current retrieval is intentionally lexical; stricter semantic ranking checks belong after retrieval becomes a bottleneck |
| Investigator eval | Deferred | Workflow smoke and traces are enough until tool selection becomes unclear, costly, or a source of bad grounding |
| Persisted Mastra eval browsing | Deferred | JSON logs remain the source for now; storage or Studio browsing is future eval ergonomics |

## Latency and cost profile

Current profile is based on recorded Phase 6 runs, not a fresh benchmark suite. The relevant evidence
is copied here because raw run artifacts are local/internal.

| Surface | Recorded run | Result | Notes |
|---|---|---:|---|
| Classifier eval | 2026-06-22 `bun run eval:classifier` | 5,168 ms avg case latency | 20 cases through OpenRouter with bounded eval concurrency |
| Classifier eval | 2026-06-22 `bun run eval:classifier` | 0.002287 credits total | About 0.000114 credits per classified ticket |
| Classifier eval | 2026-06-22 `bun run eval:classifier` | 1,070 ms min, 3,195 ms p50, 12,453 ms p95, 13,559 ms max | Per-case elapsed time once a worker starts that case |
| Deployed Worker draft | 2026-06-20 deployed `/triage` smoke | 8.20 s | End-to-end draft path; includes classify, investigate, draft, HTTP overhead, and scheduled observability flush |
| Deployed Worker human review | 2026-06-20 deployed `/triage` smoke | 1.99 s | End-to-end human-review path; skips investigation and drafting |

Recorded classifier run details:

| Field | Value |
|---|---|
| Run timestamp | `2026-06-22T07:32:32.942Z` |
| Dataset | `src/evals/datasets/golden-tickets.json`, 20 cases |
| Model | `deepseek/deepseek-v4-flash` |
| Temperature | `0` |
| Reasoning effort | `none` |
| Eval runner shape | Bounded worker pool, worker count `8` |
| Primary result | 20/20 |
| Category | 20/20 |
| `needsHuman` | 20/20 |
| Urgency | 19/20 |
| Errors | 0 |
| Tickets with recorded cost | 20 |

Recorded deployed smoke details:

| Request | HTTP status | Duration | Result |
|---|---:|---:|---|
| `GET /health` | 200 | 1.24 s | pass |
| `POST /triage` draft shipping | 200 | 8.20 s | `route.path: "draft"`, reply returned, grounding IDs `order-88421`, `sop-shipping-delay-001` |
| `POST /triage` security human review | 200 | 1.99 s | `route.path: "human_review"`, no reply, no grounding IDs |

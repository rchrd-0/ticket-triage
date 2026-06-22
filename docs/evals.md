# Evals

Current evals are small, hand-authored regression checks for the triage workflow. They are designed
to catch routing, grounding, and branch-behavior regressions before prompt or workflow changes are
treated as improvements.

## Current results

Latest recorded eval snapshot:

| Layer | Check | Result | Notes |
|---|---|---:|---|
| Classifier | Golden eval | 19/20 primary | 20 hand-authored cases; one conservative human-review false positive |
| Drafter | Grounding eval | 7/7 | 7 controlled-context cases; source IDs must come from supplied sources |
| Drafter | v6.2 stability sweep | 15/15 runs | Each run passed all 7 grounding cases |
| Workflow | Smoke | 4/4 | Draft, found-order, unknown-order, and human-review branches |
| Worker | Last recorded deployed triage smoke | pass | Health, draft shipping, and security human-review requests |

The Worker is now available at `https://ticket-triage.rchrd.dev`. Health has been verified on the
custom domain; the last recorded deployed `/triage` smoke predates the v6.2 drafter prompt update.

## Limits

- These are regression checks, not statistical guarantees.
- Eval sets are intentionally small and hand-authored.
- Kaggle-derived tickets are not used as training data or eval ground truth.
- Model-backed evals call OpenRouter and may spend provider budget.
- Phase 6 eval runners use bounded concurrency, so latency should only be compared against runs with
  the same runner shape, model, provider path, and worker count.

## Eval layers

| Layer | Command or check | Validates |
|---|---|---|
| Classification | `bun run eval:classifier` | Route-critical structured output over 20 golden tickets |
| Lexical retrieval | Deterministic tests | Query construction and fixture-backed lexical search mechanics |
| Drafter | `bun run eval:drafter` | Citation discipline with controlled supplied sources |
| Reply quality | Manual scoring | Prose-level grounding, actionability, policy safety, tone, and provenance |
| Workflow | `bun run workflow:smoke` | End-to-end branch wiring across the main routes |
| Worker | Deployed smoke and `demo.http` | Live API path behind private bearer-token auth |
| MCP | `bun run mcp:inspect` | Local stdio exposure for read-only support context tools |

## Quality findings

- The classifier miss in the current snapshot is conservative: an ordinary account-access case routes
  to human review instead of automated draft.
- Drafter v6.2 fixed an unknown-order failure where valid source IDs still accompanied unsupported
  prose about tracking or order lookup status.
- One watch item remains: the found-order shipping reply can say a delayed-shipment review is being
  initiated. Keep that wording only if the workflow represents review initiation.

## Classifier baseline and tuning

Current classifier baseline:

| Item | Current stance |
|---|---|
| Dataset | 20 hand-authored golden tickets |
| Primary metric | Category and `needsHuman` both correct |
| Model | `deepseek/deepseek-v4-flash` via OpenRouter |
| Temperature | `0` |
| Latest recorded result | 19/20 primary |

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

The v6 drafter tuning focused on one failure: unknown-order shipping replies could cite valid SOP
sources while still implying that tracking or order records had been checked. The final v6.2 prompt
kept the prose fix and restored SOP citation stability across a 15-run sweep.

| Version | Decision |
|---|---|
| v6.0 | Stable source IDs, but unsupported unknown-order prose |
| v6.1 | Better prose, but SOP citation regression |
| v6.2 | Kept the prose fix and restored citation stability |

## What this does not cover yet

| Check | Decision | Reason |
|---|---|---|
| Combined RAG eval | Retired after first passing baseline | It duplicated deterministic retrieval tests and let upstream behavior obscure drafter results |
| Strict retrieval ranking eval | Deferred | Current retrieval is intentionally lexical; stricter semantic ranking checks belong after retrieval becomes a bottleneck |
| Investigator eval | Deferred | Workflow smoke and traces are enough until tool selection becomes unclear, costly, or a source of bad grounding |
| LLM-as-judge reply scoring | Deferred | Manual scoring is enough for the current small eval set |

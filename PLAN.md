# Implementation plan

The implementation is a code-controlled workflow. Agents produce typed decisions and evidence; application code owns state transitions, concurrency, eligibility, and scoring.

## Checkpoint 1 — purchase-brief conversation

Status: implemented.

Test when: the app starts locally without API keys.

User test:

1. Enter a clothing request with or without a budget.
2. Change warranted depth and observe the number of decisions.
3. Answer using choices and custom text.
4. Confirm that requirements, preferences, review sensitivity, and seller risk appear in the live brief.

Acceptance: no transcript-only state; the brief is explicit and the domain tests pass.

## Checkpoint 2 — OpenAI conversation provider

Test when: structured agent output, session continuation, and a deterministic mock fallback work.

User test: compare an agent-researched question plan with the local clothing fixture, then continue the conversation across page refreshes.

Acceptance: Zod validates all model output; provider failures never corrupt the stored brief; tracing excludes unnecessary sensitive content.

## Checkpoint 3 — offers, reviews, evidence, and ranking

Test when: recorded product fixtures can be loaded and ranked without web access.

User test: change hard constraints and review/risk preferences, then inspect eligibility and score explanations.

Acceptance: product reviews and store/seller reviews are separate evidence streams; missing facts remain unknown; every recommendation claim has provenance.

## Checkpoint 4 — Firecrawl breadth research

Test when: one category and market can discover and normalize live offers, with recorded fixtures for repeatability.

User test: run a request against the live provider and compare the resulting offers with their source pages.

Acceptance: discovery, scraping, normalization, deduplication, caching, and rate limits are observable.

## Checkpoint 5 — Cloudflare parallel deep dives

Test when: shortlisted offers can independently inspect dynamic pages, product reviews, store/seller reviews, and merchant policies.

User test: launch a shortlist and watch parallel tasks finish with confidence, freshness, conflicts, and unknowns.

Acceptance: the browser is an escalation path; no CAPTCHA bypass; cart-level actions are read-only and approval-gated.

## Checkpoint 6 — complete recommendation flow

Test when: request → questions → discovery → shortlist → deep dive → recommendations runs end to end.

User test: complete at least three category scenarios at different depth settings.

Acceptance: recommendations distinguish best match, best value, and lowest risk; failures are recoverable; latency and provider cost are visible.

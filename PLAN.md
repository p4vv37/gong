# Implementation plan

The implementation is a code-controlled workflow. Agents produce typed decisions and evidence; application code owns state transitions, concurrency, eligibility, and scoring.

Research-pipeline implementation belongs to Claude under `COLLABORATION.md`. Codex owns the conversation and all user-facing UI, consuming research only through `src/contract` and the documented HTTP routes.

## Checkpoint 1 — purchase-brief conversation

Status: completed.

Acceptance: natural-language intent becomes an explicit brief with `must`, `prefer`, `avoid`, `indifferent`, and `delegate` semantics. Warranted depth controls question cost.

## Checkpoint 2 — OpenAI category elicitation

Status: completed and user-accepted.

User test:

1. Enter a request in any consumer category.
2. Compare low and high warranted-depth plans.
3. Answer with both choices and custom text.
4. Refresh and confirm the brief persists.

Acceptance: the OpenAI Agents SDK returns Zod-valid, product-specific decision plans; a deterministic keyless provider uses the same contract.

## Checkpoint 3 — research progress

Status: implemented; awaiting user acceptance.

User test:

1. Complete a purchase brief.
2. Start product research in fixture mode.
3. Watch discovery, standardization, ranking, and parallel deep-dive labels arrive live.
4. Confirm recoverable warnings remain visible without failing the run.

Acceptance: the UI starts `POST /api/research`, consumes the SSE route, renders only `ProgressEvent.label`, and transitions on the terminal event.

## Checkpoint 4 — recommendations and checkout consent

Status: implemented; awaiting user acceptance.

User test:

1. Inspect Best overall, Best value, and Lowest risk cards.
2. Verify product reviews and store/seller reviews are separate.
3. Confirm confidence-zero policy facts say Unverified.
4. Prepare a checkout proposal and inspect totals and unknowns.
5. Confirm approval is disabled until the order-placement acknowledgment is checked.
6. Test rejection, then deliberately approve a fixture proposal and inspect the mock order ID and placement timestamp.

Acceptance: offer claims, trade-offs, review evidence, policy depth, confidence, and unknowns remain distinct. Approval resumes the purchase gate and creates a persisted mock order record; the UI renders its ID/time while stating that no real merchant or payment was involved.

## Checkpoint 5 — resilience and end-to-end quality

Status: pending.

User test: complete conversation → fixture research → recommendations → consent on desktop and mobile, including interrupted streams and failed providers.

Acceptance: accessible interactive states, resumable completed results, useful failures, responsive layout, and automated browser coverage.

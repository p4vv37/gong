# User review — first live test (2026-07-11)

Paweł tested the integrated app live (Oakley cycling-glasses query, English).
Numbered items with root cause where investigated, owner, and planned fix.
Evidence: run `run-7bb77064` (24 offers / 16 merchants / 3 recs) + response
cache in `data/cache/`.

## 1. Calls look sequential — owner: Claude

Discovery channels, store drill-downs and merchant deep-dives already run in
`Promise.all`. Sequential today: policy-page reads inside one merchant, and
ladder rungs per URL. Perception is worsened by one-by-one event streaming
and by Firecrawl's free-plan cap of 2 concurrent browsers (server-side queue
no code can beat — Hobby plan lifts to 5).
**Fix:** parallelize per-merchant page reads; batch-emit discovery events.

## 2. Too many failed calls — owner: Claude

Measured breakdown of the Oakley run:
- Biggest bucket: web-search candidates were editorial pages (reddit,
  nytimes, bikeradar, oakley.com brand pages), because the query was English
  and the query builder appends Polish `" sklep"` with no shop-intent
  filtering. These pages then correctly extracted nothing → loud warnings +
  wasted scrapes. Query-synthesis bug, not a scraping problem.
- Real bot blocks are rare: 1 of 17 direct fetches (sportrx.com 403).
- All 4 deep-dived PL merchants fetched 200s and learned policies.
**Fix:** language-aware store-intent query synthesis (LLM), PL-domain bias
for web search, cheap product-page classifier before spending scrapes,
retry/backoff layer.

## 3. API quota protection (250 free SerpAPI searches) — owner: Claude

A live run currently costs up to ~7 SerpAPI calls (1–2 shopping + ≤5
drill-downs) ≈ 35 runs/month.
**Fix:** drill-downs 5→3, all limits env-configurable
(`RESEARCH_MAX_SERPAPI_CALLS` etc.), keep leaning on the replay cache
(identical queries already cost zero).

## 4. Sizes not asked for clothing — owner: Codex (+ small Claude follow-up)

Decision (Paweł): NOT a hardcoded question. Add a user profile in the app
layer — sizes, address, payment preferences, default depth — set once and
injected automatically whenever the determined category calls for it.
Requires a `UserProfile` contract addition (agree via mail before adding).
Claude follow-up: filter/annotate offer variants against profile size.

## 5. Wall of UNVERIFIED merchants — owner: Claude (coverage), Codex (presentation)

Decomposition: of 16 merchants only 4 were deep-dived (`deepDiveCount` cap);
the rest are *never-attempted*, not failures — and 12/16 still got partial
policies (returns) free from Google drill-down hints.
**Fix (Claude):** deepen-on-demand endpoint — opening a product's detail
view triggers that merchant's deep dive right then.
**Fix (Codex):** don't render never-attempted merchants as a failure wall;
distinguish "not yet checked" from "checked, unknown".

## 6. UI rework — owner: Codex

Three simple cards with product images; click into a product artifact page
showing the standardized details (Field provenance, evidence links, policy
facts) instead of one long scroll. All data already in `RecommendationSet`.

## 7. Never invent data — "deferred items" — owner: Claude

Policy-reader prompt already forbids guessing; extend to all agents and add
explicit deferred semantics: unknown + reason + the depth at which it could
resolve ("shipping revealed at cart stage"). Contract's `DepthLevel` exists
for exactly this; UI renders a "deferred" chip (Codex, small).

## 8. Back-step + tool-call log after results — owner: both

Backend keeps full event history and every raw response (cache), but events
die with the server process (Paweł's run 404'd after a dev restart).
**Fix (Claude):** persist events with the run record + per-run audit
endpoint (each external call: source, URL, duration, cache hit/miss).
**Fix (Codex):** "research log" view accessible from the results screen.

## 9. Reviews "failed" — owner: Claude

They never ran: review collection is typed and ranked-against but has no
live collector. Product ratings already sit in SerpAPI responses — persist
them as `ReviewEvidence`. Store reviews need a real source (Google seller
ratings / Opineo) — planned.

## 10. Same-product offer comparison — owner: Claude (+ Codex view)

Within the Google drill-down channel, N stores land under one product — that
comparison works. Missing: fuzzy cross-source identity (same item, different
titles → two products today), so we never say "this exact item is 40 zł
cheaper at X". **Fix:** GTIN/MPN matching when scraped, LLM title matching
otherwise; per-product offer-comparison view (Codex).

## 11. Fixture/live toggle — owner: Codex

`purchase-workbench.tsx` hardcodes `mode: "fixture"`. Add a visible toggle
(or env default) so live mode doesn't require a code edit.

## Priority order (agreed direction, not started)

Claude: 3 (quota) → 2 (query synthesis + classifier) → 8 (persist events/audit)
→ 7 (deferred) → 5 (deepen-on-demand) → 9 (reviews) → 10 (identity).
Codex: 11 (toggle) → 6 (cards + artifact view) → 5 (presentation) → 8 (log
view) → 4 (user profile, after contract mail).

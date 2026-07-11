# gong

An evidence-driven purchasing agent that turns a natural-language request into an explicit purchase brief, researches products and sellers, and recommends offers with provenance.

## What works

- OpenAI Agents SDK category-specific elicitation with Zod-validated output.
- Warranted-depth question budgeting, choices, and custom answers.
- Explicit purchase brief with hard requirements and weighted preferences.
- Fixture and live research through a stable HTTP/SSE contract.
- Live discovery, standardization, ranking, and merchant deep-dive progress.
- Three image-led recommendation cards with drill-in standardized product artifacts.
- Separate product-review and store/seller-review evidence.
- Per-field provenance, evidence links, confidence/depth, and distinct Not checked vs Checked unresolved states.
- Same-product offer comparison and a returnable research-event log.
- Checkout proposal with explicit approve/reject consent; approval creates a persisted mock order confirmation with no real merchant contact or payment transfer.

## Run it

The app uses a deterministic question fixture without an OpenAI key. To exercise the live elicitation provider, export `OPENAI_API_KEY` and optionally `OPENAI_MODEL` before starting.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), or the next available port printed by Next.js.

Verification:

```bash
npm test
npm run lint
npm run build
```

See [PLAN.md](./PLAN.md) for user-test checkpoints and [COLLABORATION.md](./COLLABORATION.md) for workstream ownership.

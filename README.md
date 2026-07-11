# gong

An evidence-driven purchasing agent that turns a natural-language request into an explicit purchase brief, researches products and sellers, and recommends offers with provenance.

## What works

- OpenAI Agents SDK category-specific elicitation with Zod-validated output.
- Warranted-depth question budgeting, choices, and custom answers.
- Explicit purchase brief with hard requirements and weighted preferences.
- Fixture and live research through a stable HTTP/SSE contract.
- Live discovery, standardization, ranking, and merchant deep-dive progress.
- Best overall, best value, and lowest-risk recommendation cards.
- Separate product-review and store/seller-review evidence.
- Confidence, evidence depth, compromises, and unknowns.
- Checkout proposal with explicit approve/reject consent; no ordering or payment.

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

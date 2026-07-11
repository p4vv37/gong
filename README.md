# gong

An evidence-driven purchasing agent that turns a natural-language request into an explicit purchase brief, researches products and sellers, and recommends offers with provenance.

## Current checkpoint

Checkpoint 1 is a keyless, deterministic clothing prototype. It demonstrates:

- free-text purchase intent;
- warranted-depth question budgeting;
- choice answers plus custom text;
- explicit `must`, `prefer`, `indifferent`, and `delegate` semantics;
- product-review and store/seller-risk decisions;
- a live structured purchase brief.

No external research runs yet and nothing can be purchased.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Verification:

```bash
npm test
npm run lint
npm run build
```

## Repository plan

See [PLAN.md](./PLAN.md) for implementation and user-test checkpoints.

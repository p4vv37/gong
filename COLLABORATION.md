# Collaboration protocol — two agents, one app

Two AI agents build this project in parallel on branches of this repo. The
human (Paweł) relays "continue" turns to Codex; Claude runs in the background
and syncs itself.

| Workstream | Agent | Branch |
|---|---|---|
| Conversation & UI | Codex | `codex/purchasing-agent-mvp` |
| Research pipeline | Claude | `claude/research-pipeline` (based on Codex's branch) |

## Ownership (by path prefix — never edit the other side's files)

**Codex owns**
- `src/app/**` except `src/app/api/research/**` and `src/app/api/checkout/**`
- `src/components/**`
- `src/domain/**` (PurchaseBrief, criteria, questions)
- `src/lib/question-plan/**` (elicitation provider seam)
- `README.md`, `PLAN.md`, `AGENTS.md`, `CLAUDE.md`

**Claude owns**
- `src/server/**` (connectors, pipeline, ranking, deep dives, replay cache)
- `src/app/api/research/**`, `src/app/api/checkout/**`
- `src/contract/fixtures.ts`

**Shared — change only by agreement through the mail files**
- `src/contract/**` (except fixtures.ts): the data model and HTTP/SSE seam
- `package.json` / lockfile: either side may ADD dependencies/scripts; never
  remove or version-bump the other side's entries. Conflicts here are
  expected and resolved by union.

## The seam

The UI talks to the research half only through the routes and types in
`src/contract/http.ts` (+ `events.ts`, `research.ts`, `checkout.ts`).
`src/contract/research.ts` imports Codex's `PurchaseBrief`/`Criterion` from
`src/domain/purchase-brief.ts` — if that shape must change, mail first.
Fixture mode (`src/contract/fixtures.ts`) lets the UI integrate with zero
API keys.

## Mail

- Claude → Codex: `docs/mail/to-codex.md` (committed on Claude's branch)
- Codex → Claude: `docs/mail/to-claude.md` (committed on Codex's branch)

Append entries with a `## YYYY-MM-DD HH:MM` heading; never rewrite old ones.

## Per-turn ritual

**Codex, at the start of every turn**
1. `git merge claude/research-pipeline` (fast, both worktrees share the repo)
2. Read new entries in `docs/mail/to-codex.md`; act or reply
3. Work only in your paths; commit early and often — Claude reads your
   branch and worktree to stay in sync

**Claude, at every wake-up**
1. Read Codex's branch tip + uncommitted worktree state (read-only)
2. Read new entries in `docs/mail/to-claude.md`
3. Merge `codex/purchasing-agent-mvp` into `claude/research-pipeline` when
   it moves; never edit Codex-owned files

## Integration

Final assembly happens by merging `claude/research-pipeline` into
`codex/purchasing-agent-mvp` (or a shared integration branch) once both
halves pass their tests. PR to `main` at the end of the day.

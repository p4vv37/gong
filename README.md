# gong

An evidence-driven purchasing agent: a natural-language request becomes an explicit purchase brief, gets researched across real shops with provenance, and — after explicit consent — is executed by a purchase orchestrator.

Two components live in this repo:

The Next.js checkout routes are the server-side integration boundary. They translate a selected Advisor offer into a `PurchaseRequest`, keep approval tokens off the browser, and forward approve/reject decisions to FastAPI.

## Full pipeline (safe dummy purchase)

Use Node.js 22+ for the live research connectors. Fixture mode also builds on Node.js 20.

Create `.env.local` from `.env.example`. Keep `PURCHASE_ORCHESTRATOR_URL=http://127.0.0.1:8000`; API keys are optional in fixture mode.

Terminal 1 â€” Purchase Orchestrator:

```powershell
uv sync --group dev
$env:PURCHASE_ADAPTER="dummy"
uv run uvicorn purchase_orchestrator.main:app --reload --port 8000
```

Terminal 2 â€” Shopping Advisor and ChatUI:

```powershell
npm ci
npm run dev -- --port 3000
```

Open `http://127.0.0.1:3000`, complete the purchase brief, choose **Fixture replay**, open a recommendation, prepare checkout, acknowledge the consent and select **Authorize purchase**. The browser calls only Next.js; its server routes create and approve the FastAPI purchase. With the dummy adapter the final status is `PURCHASED` without merchant contact or payment.

With both services running, verify the complete HTTP seam non-interactively:

```powershell
npm run smoke:full-pipeline
```

For live research, add `OPENAI_API_KEY`, `SERPAPI_API_KEY`, and `FIRECRAWL_API_KEY` to `.env.local`, then choose **Live web**. Keep `PURCHASE_ADAPTER=dummy` until browser execution is explicitly desired.

- **Shopping Advisor** (Next.js, repo root) — elicitation, offer research, standardization, recommendations, consent UI.
- **Purchase Orchestrator** (`purchase_orchestrator/`, Python) — purchase policies, approvals, and purchase adapters.

---

## Shopping Advisor (Next.js)


### What works

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

### Run it

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

---

## Purchase Orchestrator (Python)

Niezalezna usluga API odpowiedzialna za polityki zakupowe, zatwierdzenia klienta i uruchamianie adapterow zakupowych.

### Uruchomienie

```powershell
uv sync --group dev
uv run uvicorn purchase_orchestrator.main:app --reload
```

Serwis nasluchuje domyslnie pod `http://127.0.0.1:8000`.

### Kontrakty API

- `PUT /v1/users/{user_id}/purchase-policy` - polityka autonomii zakupowej.
- `POST /v1/purchase-requests` - wejscie dla Shopping Advisor.
- `GET /v1/purchases/{purchase_id}` - status procesu.
- `POST /v1/purchase-approvals/{approval_id}/approve` - zatwierdzenie przez ChatUI.
- `POST /v1/purchase-approvals/{approval_id}/reject` - odrzucenie przez ChatUI.

Powiadomienia dla ChatUI sa zapisywane w outboxie. Worker dostarczajacy je do aplikacji ChatUI zostanie podlaczony do tego portu w kolejnym kroku.

### Adapter demonstracyjny

Aktualnie `DummyPurchaseAdapter` jest uruchamiany od razu po pre-approval albo zatwierdzeniu przez klienta. Nie laczy sie ze sklepem i nie obciaza platnosci; wypisuje potwierdzenie w konsoli, ustawia status `PURCHASED` i publikuje `purchase.completed`.

### Widoczny adapter AI

Adapter demonstracyjny `AiAssistedBrowserAdapter` uruchamia Playwright w widocznym oknie i korzysta z `OPENAI_API` (lub standardowego `OPENAI_API_KEY`) z pliku `.env`. AI moze wybrac tylko przycisk lub opcje z aktualnej, ograniczonej listy elementow strony. Adapter nie moze kliknac przycisku platnosci ani zlozenia zamowienia.

Shopping Advisor musi przekazac kompletny, niezmienny snapshot: oferte i limit ceny, wybrany wariant/ilosc, opcje produktu, personalizacje, identyfikatory plikow, adres dostawy, preferowana dostawe i metode platnosci oraz jawna zgode na regulamin. AI widzi nazwy zatwierdzonych zrodel danych i nie moze wymyslac wartosci formularza. Przykladowy payload znajduje sie w `examples/cs-studio-purchase-request.mock.json`; zawiera dane fikcyjne i nie jest przeznaczony do zlozenia zamowienia.

Ustaw w `.env`:

```text
PURCHASE_ADAPTER=ai_browser
BROWSER_HEADLESS=false
BROWSER_CHANNEL=chrome
BROWSER_PAGE_SETTLE_TIMEOUT_MS=6000
AI_BROWSER_MODEL=gpt-5.4-mini
```

Pliki sa mapowane przez worker, np. `BROWSER_ASSET_MAP={"asset_mock_portrait_001":"C:\\bezpieczny-katalog\\mock.png"}`. Shopping Advisor przesyla tylko identyfikator `asset_mock_portrait_001`; model nie wybiera sciezki pliku.

Adapter pracuje w petli `OBSERVE -> PLAN -> EXECUTE -> VERIFY`. Planner deklaruje aktualny stan checkoutu i oczekiwany rezultat. Po akcji Playwright sprawdza wartosc pola, wybrana opcje, zaznaczenie, upload albo zmiane URL/tresci i przekazuje wynik `SUCCEEDED`/`FAILED` do kolejnej decyzji modelu. Trzy kolejne niezweryfikowane akcje zatrzymuja wykonanie.

Nastepnie uruchom standardowy przeplyw zatwierdzenia. Wynik adaptera bedzie mial status `USER_ACTION_REQUIRED`, a screenshot koncowego stanu zostanie zapisany w `artifacts/browser/`.

# Purchase Orchestrator

Niezalezna usluga API odpowiedzialna za polityki zakupowe, zatwierdzenia klienta i uruchamianie adapterow zakupowych.

## Uruchomienie

```powershell
uv sync --group dev
uv run uvicorn purchase_orchestrator.main:app --reload
```

Serwis nasluchuje domyslnie pod `http://127.0.0.1:8000`.

## Kontrakty API

- `PUT /v1/users/{user_id}/purchase-policy` - polityka autonomii zakupowej.
- `POST /v1/purchase-requests` - wejscie dla Shopping Advisor.
- `GET /v1/purchases/{purchase_id}` - status procesu.
- `POST /v1/purchase-approvals/{approval_id}/approve` - zatwierdzenie przez ChatUI.
- `POST /v1/purchase-approvals/{approval_id}/reject` - odrzucenie przez ChatUI.

Powiadomienia dla ChatUI sa zapisywane w outboxie. Worker dostarczajacy je do aplikacji ChatUI zostanie podlaczony do tego portu w kolejnym kroku.

## Adapter demonstracyjny

Aktualnie `DummyPurchaseAdapter` jest uruchamiany od razu po pre-approval albo zatwierdzeniu przez klienta. Nie laczy sie ze sklepem i nie obciaza platnosci; wypisuje potwierdzenie w konsoli, ustawia status `PURCHASED` i publikuje `purchase.completed`.

## Widoczny adapter AI

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

Nastepnie uruchom standardowy przeplyw zatwierdzenia. Wynik adaptera bedzie mial status `USER_ACTION_REQUIRED`, a screenshot koncowego stanu zostanie zapisany w `artifacts/browser/`.

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

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterator
from uuid import UUID, uuid4

from .models import (
    ApprovalStatus,
    OutboxEvent,
    PurchaseDetails,
    PurchasePolicyInput,
    PurchaseResponse,
    PurchaseStatus,
)


def _now() -> datetime:
    return datetime.now(UTC)


class Repository:
    def __init__(self, database_path: str) -> None:
        Path(database_path).parent.mkdir(parents=True, exist_ok=True)
        self.database_path = database_path
        self.initialize()

    @contextmanager
    def _connection(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def initialize(self) -> None:
        with self._connection() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS purchase_policies (
                    user_id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS purchases (
                    id TEXT PRIMARY KEY,
                    client_request_id TEXT UNIQUE NOT NULL,
                    user_id TEXT NOT NULL,
                    conversation_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    offer_payload TEXT NOT NULL,
                    rejection_reason TEXT,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS approvals (
                    id TEXT PRIMARY KEY,
                    purchase_id TEXT UNIQUE NOT NULL,
                    token_hash TEXT NOT NULL,
                    status TEXT NOT NULL,
                    expires_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS outbox_events (
                    id TEXT PRIMARY KEY,
                    event_type TEXT NOT NULL,
                    aggregate_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )

    def save_policy(self, user_id: UUID, policy: PurchasePolicyInput) -> None:
        with self._connection() as connection:
            connection.execute(
                """
                INSERT INTO purchase_policies(user_id, payload, updated_at)
                VALUES(?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at
                """,
                (str(user_id), policy.model_dump_json(), _now().isoformat()),
            )

    def get_policy(self, user_id: UUID) -> PurchasePolicyInput | None:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT payload FROM purchase_policies WHERE user_id = ?", (str(user_id),)
            ).fetchone()
        return None if row is None else PurchasePolicyInput.model_validate_json(row["payload"])

    def get_purchase_by_client_request_id(self, client_request_id: UUID) -> PurchaseResponse | None:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT id, status, created_at FROM purchases WHERE client_request_id = ?",
                (str(client_request_id),),
            ).fetchone()
        return None if row is None else PurchaseResponse(
            purchase_id=UUID(row["id"]), status=PurchaseStatus(row["status"]), created_at=datetime.fromisoformat(row["created_at"])
        )

    def create_purchase(self, *, client_request_id: UUID, user_id: UUID, conversation_id: UUID, offer_payload: str, status: PurchaseStatus, rejection_reason: str | None = None) -> PurchaseResponse:
        purchase_id = uuid4()
        created_at = _now()
        with self._connection() as connection:
            connection.execute(
                """INSERT INTO purchases(id, client_request_id, user_id, conversation_id, status, offer_payload, rejection_reason, created_at)
                   VALUES(?, ?, ?, ?, ?, ?, ?, ?)""",
                (str(purchase_id), str(client_request_id), str(user_id), str(conversation_id), status.value, offer_payload, rejection_reason, created_at.isoformat()),
            )
        return PurchaseResponse(purchase_id=purchase_id, status=status, created_at=created_at)

    def get_purchase(self, purchase_id: UUID) -> PurchaseDetails | None:
        with self._connection() as connection:
            row = connection.execute("SELECT * FROM purchases WHERE id = ?", (str(purchase_id),)).fetchone()
        if row is None:
            return None
        payload = json.loads(row["offer_payload"])
        return PurchaseDetails(
            purchase_id=UUID(row["id"]),
            status=PurchaseStatus(row["status"]),
            created_at=datetime.fromisoformat(row["created_at"]),
            user_id=UUID(row["user_id"]),
            conversation_id=UUID(row["conversation_id"]),
            offer=payload["offer"],
            checkout=payload["checkout"],
            rejection_reason=row["rejection_reason"],
        )

    def set_purchase_status(self, purchase_id: UUID, status: PurchaseStatus, rejection_reason: str | None = None) -> None:
        with self._connection() as connection:
            connection.execute(
                "UPDATE purchases SET status = ?, rejection_reason = ? WHERE id = ?",
                (status.value, rejection_reason, str(purchase_id)),
            )

    def create_approval(self, purchase_id: UUID, token_hash: str, expires_at: datetime) -> UUID:
        approval_id = uuid4()
        with self._connection() as connection:
            connection.execute(
                "INSERT INTO approvals(id, purchase_id, token_hash, status, expires_at) VALUES(?, ?, ?, ?, ?)",
                (str(approval_id), str(purchase_id), token_hash, ApprovalStatus.PENDING.value, expires_at.isoformat()),
            )
        return approval_id

    def get_approval(self, approval_id: UUID) -> sqlite3.Row | None:
        with self._connection() as connection:
            return connection.execute("SELECT * FROM approvals WHERE id = ?", (str(approval_id),)).fetchone()

    def set_approval_status(self, approval_id: UUID, status: ApprovalStatus) -> None:
        with self._connection() as connection:
            connection.execute("UPDATE approvals SET status = ? WHERE id = ?", (status.value, str(approval_id)))

    def add_event(self, event_type: str, aggregate_id: UUID, payload: dict) -> None:
        event_id, created_at = uuid4(), _now()
        with self._connection() as connection:
            connection.execute(
                "INSERT INTO outbox_events(id, event_type, aggregate_id, payload, created_at) VALUES(?, ?, ?, ?, ?)",
                (str(event_id), event_type, str(aggregate_id), json.dumps(payload), created_at.isoformat()),
            )

    def list_events(self) -> list[OutboxEvent]:
        with self._connection() as connection:
            rows = connection.execute("SELECT * FROM outbox_events ORDER BY created_at").fetchall()
        return [
            OutboxEvent(
                id=UUID(row["id"]), event_type=row["event_type"], aggregate_id=UUID(row["aggregate_id"]),
                payload=json.loads(row["payload"]), created_at=datetime.fromisoformat(row["created_at"])
            )
            for row in rows
        ]

from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any


class ExperimentStorage:
    def __init__(self, db_path: Path) -> None:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        self._init_schema()

    def _init_schema(self) -> None:
        with self._lock:
            self._conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS rounds (
                    round_id INTEGER PRIMARY KEY,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS client_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    client_id TEXT NOT NULL,
                    round_id INTEGER NOT NULL,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT NOT NULL,
                    message TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )
            self._conn.commit()

    def reset(self) -> None:
        with self._lock:
            self._conn.executescript(
                """
                DELETE FROM rounds;
                DELETE FROM client_history;
                DELETE FROM events;
                """
            )
            self._conn.commit()

    def save_round(self, round_payload: dict[str, Any]) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO rounds(round_id, payload, created_at) VALUES (?, ?, ?)",
                (
                    round_payload["round_id"],
                    json.dumps(round_payload, ensure_ascii=False),
                    round_payload["timestamp"],
                ),
            )
            self._conn.commit()

    def save_client_histories(self, round_id: int, clients: list[dict[str, Any]], timestamp: str) -> None:
        with self._lock:
            self._conn.executemany(
                """
                INSERT INTO client_history(client_id, round_id, payload, created_at)
                VALUES (?, ?, ?, ?)
                """,
                [
                    (
                        client["client_id"],
                        round_id,
                        json.dumps(
                            {
                                "round_id": round_id,
                                "anomaly_score": client["anomaly_score"],
                                "reputation_score": client["reputation_score"],
                                "weight": client["current_weight"],
                                "status": client["status"],
                                "gradient_norm": client["gradient_norm"],
                            },
                            ensure_ascii=False,
                        ),
                        timestamp,
                    )
                    for client in clients
                ],
            )
            self._conn.commit()

    def append_event(self, event_type: str, message: str, created_at: str) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO events(event_type, message, created_at) VALUES (?, ?, ?)",
                (event_type, message, created_at),
            )
            self._conn.commit()

    def recent_events(self, limit: int = 18) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT event_type, message, created_at FROM events ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(row) for row in rows]

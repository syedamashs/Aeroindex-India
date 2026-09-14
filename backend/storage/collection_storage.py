"""
APIx Collection Run / Task Storage

Responsibilities:
- Create collection runs
- Create collection tasks
- Track task lifecycle
- Track attempts
- Store actual lead time
- Store failure diagnostics
- Update run-level counters

This module does NOT:
- scrape websites
- save raw JSON
- normalize fares
- calculate APIx

Those responsibilities belong to their respective layers.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

# Allow direct execution from backend/storage as well as package imports.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database.connection import get_connection


# ============================================================
# CONSTANTS
# ============================================================

VALID_TASK_STATUSES = {
    "PENDING",
    "RUNNING",
    "SUCCESS",
    "FAILED",
    "SKIPPED",
}

VALID_RUN_STATUSES = {
    "RUNNING",
    "SUCCESS",
    "PARTIAL",
    "FAILED",
}


# ============================================================
# HELPERS
# ============================================================

def utc_now() -> str:
    """Return current UTC timestamp in ISO-8601 format."""
    return datetime.now(timezone.utc).isoformat()


def calculate_actual_lead_days(
    departure_date: str,
    collection_date: Optional[str] = None,
) -> int:
    """
    Calculate actual calendar lead time.

    Example:
        collection = 2026-09-13
        departure  = 2026-09-20
        result     = 7
    """

    departure = date.fromisoformat(departure_date)

    if collection_date is None:
        collection = datetime.now(timezone.utc).date()
    else:
        collection = date.fromisoformat(collection_date)

    return (departure - collection).days


def _validate_run_status(status: str) -> None:
    if status not in VALID_RUN_STATUSES:
        raise ValueError(
            f"Invalid run status '{status}'. "
            f"Expected one of {sorted(VALID_RUN_STATUSES)}"
        )


def _validate_task_status(status: str) -> None:
    if status not in VALID_TASK_STATUSES:
        raise ValueError(
            f"Invalid task status '{status}'. "
            f"Expected one of {sorted(VALID_TASK_STATUSES)}"
        )


# ============================================================
# COLLECTION RUNS
# ============================================================

def create_collection_run(
    run_id: str,
    *,
    total_tasks: int = 0,
    status: str = "RUNNING",
    notes: Optional[str] = None,
) -> str:
    """
    Create a new collection run.

    collection_runs schema:

        run_id
        started_at
        completed_at
        status
        total_tasks
        successful_tasks
        failed_tasks
        notes
    """

    _validate_run_status(status)

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO collection_runs (
                run_id,
                started_at,
                completed_at,
                status,
                total_tasks,
                successful_tasks,
                failed_tasks,
                notes
            )
            VALUES (?, ?, NULL, ?, ?, 0, 0, ?)
            """,
            (
                run_id,
                utc_now(),
                status,
                total_tasks,
                notes,
            ),
        )

        conn.commit()

    return run_id


def get_collection_run(run_id: str):
    """Fetch one collection run."""

    with get_connection() as conn:
        return conn.execute(
            """
            SELECT *
            FROM collection_runs
            WHERE run_id = ?
            """,
            (run_id,),
        ).fetchone()


# ============================================================
# COLLECTION TASKS
# ============================================================

REQUIRED_TASK_FIELDS = (
    "task_id",
    "run_id",
    "route_id",
    "source",
    "origin",
    "destination",
    "departure_date",
    "target_lead_days",
)


def validate_task(task: Dict[str, Any]) -> None:
    """Validate the minimum scheduler task contract."""

    missing = [
        field
        for field in REQUIRED_TASK_FIELDS
        if field not in task
    ]

    if missing:
        raise ValueError(
            f"Collection task missing required fields: {missing}"
        )

    if not str(task["origin"]).strip():
        raise ValueError("Task origin cannot be empty.")

    if not str(task["destination"]).strip():
        raise ValueError("Task destination cannot be empty.")

    if int(task["target_lead_days"]) < 0:
        raise ValueError("target_lead_days cannot be negative.")

    # Validate ISO departure date.
    date.fromisoformat(str(task["departure_date"]))


def create_collection_task(
    task: Dict[str, Any],
) -> str:
    """Insert one collection task."""

    validate_task(task)

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO collection_tasks (
                task_id,
                run_id,
                route_id,
                source,
                origin,
                destination,
                departure_date,
                target_lead_days,
                actual_lead_days,
                status,
                started_at,
                completed_at,
                attempts,
                error_type,
                error_message,
                created_at
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?,
                NULL,
                'PENDING',
                NULL,
                NULL,
                0,
                NULL,
                NULL,
                ?
            )
            """,
            (
                task["task_id"],
                task["run_id"],
                task["route_id"],
                task["source"],
                task["origin"],
                task["destination"],
                task["departure_date"],
                int(task["target_lead_days"]),
                utc_now(),
            ),
        )

        conn.commit()

    return task["task_id"]


def create_collection_tasks(
    tasks: Iterable[Dict[str, Any]],
) -> int:
    """
    Insert multiple collection tasks atomically.

    Returns number of inserted tasks.
    """

    tasks = list(tasks)

    if not tasks:
        return 0

    rows = []

    for task in tasks:
        validate_task(task)

        rows.append(
            (
                task["task_id"],
                task["run_id"],
                task["route_id"],
                task["source"],
                task["origin"],
                task["destination"],
                task["departure_date"],
                int(task["target_lead_days"]),
                utc_now(),
            )
        )

    with get_connection() as conn:
        conn.executemany(
            """
            INSERT INTO collection_tasks (
                task_id,
                run_id,
                route_id,
                source,
                origin,
                destination,
                departure_date,
                target_lead_days,
                actual_lead_days,
                status,
                started_at,
                completed_at,
                attempts,
                error_type,
                error_message,
                created_at
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?,
                NULL,
                'PENDING',
                NULL,
                NULL,
                0,
                NULL,
                NULL,
                ?
            )
            """,
            rows,
        )

        conn.commit()

    return len(rows)


def get_collection_task(task_id: str):
    """Fetch one collection task."""

    with get_connection() as conn:
        return conn.execute(
            """
            SELECT *
            FROM collection_tasks
            WHERE task_id = ?
            """,
            (task_id,),
        ).fetchone()


def get_run_tasks(run_id: str):
    """Fetch every task belonging to a run."""

    with get_connection() as conn:
        return conn.execute(
            """
            SELECT *
            FROM collection_tasks
            WHERE run_id = ?
            ORDER BY created_at, task_id
            """,
            (run_id,),
        ).fetchall()


# ============================================================
# TASK LIFECYCLE
# ============================================================

def mark_task_running(
    task_id: str,
) -> None:
    """
    Mark task as RUNNING and increment attempt count.
    """

    with get_connection() as conn:
        conn.execute(
            """
            UPDATE collection_tasks
            SET
                status = 'RUNNING',
                started_at = ?,
                attempts = attempts + 1,
                error_type = NULL,
                error_message = NULL
            WHERE task_id = ?
            """,
            (
                utc_now(),
                task_id,
            ),
        )

        conn.commit()


def mark_task_success(
    task_id: str,
    *,
    observation_count: int = 0,
    actual_lead_days: Optional[int] = None,
) -> None:
    """
    Mark task successful.

    observation_count is intentionally not stored here because
    collection_tasks schema does not contain that column.

    The observation count can be calculated from apix_observations
    using task_id/run_id relationships later.
    """

    with get_connection() as conn:

        if actual_lead_days is None:
            row = conn.execute(
                """
                SELECT departure_date
                FROM collection_tasks
                WHERE task_id = ?
                """,
                (task_id,),
            ).fetchone()

            if row is None:
                raise ValueError(
                    f"Task '{task_id}' does not exist."
                )

            actual_lead_days = calculate_actual_lead_days(
                row["departure_date"]
            )

        conn.execute(
            """
            UPDATE collection_tasks
            SET
                status = 'SUCCESS',
                completed_at = ?,
                actual_lead_days = ?,
                error_type = NULL,
                error_message = NULL
            WHERE task_id = ?
            """,
            (
                utc_now(),
                int(actual_lead_days),
                task_id,
            ),
        )

        conn.commit()


def mark_task_failed(
    task_id: str,
    *,
    error_type: str,
    error_message: str,
) -> None:
    """Mark task failed and preserve diagnostic information."""

    with get_connection() as conn:
        conn.execute(
            """
            UPDATE collection_tasks
            SET
                status = 'FAILED',
                completed_at = ?,
                error_type = ?,
                error_message = ?
            WHERE task_id = ?
            """,
            (
                utc_now(),
                error_type,
                str(error_message),
                task_id,
            ),
        )

        conn.commit()


def mark_task_skipped(
    task_id: str,
    *,
    reason: str = "Task skipped",
) -> None:
    """Mark task as skipped."""

    with get_connection() as conn:
        conn.execute(
            """
            UPDATE collection_tasks
            SET
                status = 'SKIPPED',
                completed_at = ?,
                error_type = 'SKIPPED',
                error_message = ?
            WHERE task_id = ?
            """,
            (
                utc_now(),
                reason,
                task_id,
            ),
        )

        conn.commit()


# ============================================================
# RUN COUNTERS
# ============================================================

def refresh_collection_run_counts(
    run_id: str,
) -> None:
    """
    Recalculate run-level task counters from collection_tasks.
    """

    with get_connection() as conn:
        conn.execute(
            """
            UPDATE collection_runs
            SET
                total_tasks = (
                    SELECT COUNT(*)
                    FROM collection_tasks
                    WHERE run_id = ?
                ),
                successful_tasks = (
                    SELECT COUNT(*)
                    FROM collection_tasks
                    WHERE run_id = ?
                      AND status = 'SUCCESS'
                ),
                failed_tasks = (
                    SELECT COUNT(*)
                    FROM collection_tasks
                    WHERE run_id = ?
                      AND status = 'FAILED'
                )
            WHERE run_id = ?
            """,
            (
                run_id,
                run_id,
                run_id,
                run_id,
            ),
        )

        conn.commit()


# ============================================================
# RUN COMPLETION
# ============================================================

def finalize_collection_run(
    run_id: str,
) -> str:
    """
    Determine and store final run status.

    Rules:

        all success      -> SUCCESS
        success + fail   -> PARTIAL
        all failed       -> FAILED
        no tasks          -> FAILED
        pending/running   -> RUNNING
    """

    refresh_collection_run_counts(run_id)

    with get_connection() as conn:

        rows = conn.execute(
            """
            SELECT status
            FROM collection_tasks
            WHERE run_id = ?
            """,
            (run_id,),
        ).fetchall()

        if not rows:
            final_status = "FAILED"

        else:
            statuses = [row["status"] for row in rows]

            if any(
                status in {"PENDING", "RUNNING"}
                for status in statuses
            ):
                final_status = "RUNNING"

            elif all(
                status == "SUCCESS"
                for status in statuses
            ):
                final_status = "SUCCESS"

            elif all(
                status in {"FAILED", "SKIPPED"}
                for status in statuses
            ):
                final_status = "FAILED"

            else:
                final_status = "PARTIAL"

        _validate_run_status(final_status)

        if final_status != "RUNNING":
            conn.execute(
                """
                UPDATE collection_runs
                SET
                    status = ?,
                    completed_at = ?
                WHERE run_id = ?
                """,
                (
                    final_status,
                    utc_now(),
                    run_id,
                ),
            )
        else:
            conn.execute(
                """
                UPDATE collection_runs
                SET status = ?
                WHERE run_id = ?
                """,
                (
                    final_status,
                    run_id,
                ),
            )

        conn.commit()

    return final_status


# ============================================================
# SUMMARY
# ============================================================

def get_run_summary(
    run_id: str,
) -> Dict[str, Any]:
    """Return task statistics for one run."""

    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT
                COUNT(*) AS total_tasks,

                SUM(
                    CASE
                        WHEN status = 'PENDING'
                        THEN 1 ELSE 0
                    END
                ) AS pending_tasks,

                SUM(
                    CASE
                        WHEN status = 'RUNNING'
                        THEN 1 ELSE 0
                    END
                ) AS running_tasks,

                SUM(
                    CASE
                        WHEN status = 'SUCCESS'
                        THEN 1 ELSE 0
                    END
                ) AS successful_tasks,

                SUM(
                    CASE
                        WHEN status = 'FAILED'
                        THEN 1 ELSE 0
                    END
                ) AS failed_tasks,

                SUM(
                    CASE
                        WHEN status = 'SKIPPED'
                        THEN 1 ELSE 0
                    END
                ) AS skipped_tasks

            FROM collection_tasks
            WHERE run_id = ?
            """,
            (run_id,),
        ).fetchone()

    if row is None:
        return {}

    return dict(row)


# ============================================================
# MODULE CHECK
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("APIx COLLECTION STORAGE")
    print("=" * 60)
    print("✓ collection_storage.py loaded successfully")
    print()
    print("Run lifecycle:")
    print("  RUNNING → SUCCESS")
    print("  RUNNING → PARTIAL")
    print("  RUNNING → FAILED")
    print()
    print("Task lifecycle:")
    print("  PENDING → RUNNING → SUCCESS")
    print("  PENDING → RUNNING → FAILED")
    print("  PENDING → SKIPPED")
    print("=" * 60)
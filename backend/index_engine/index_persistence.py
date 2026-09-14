from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Any, Iterable, Mapping


@dataclass(frozen=True)
class PersistenceResult:
    rows_attempted: int
    rows_inserted: int
    status: str
    errors: tuple[str, ...] = ()


def _batch_result(rows_attempted: int, rows_inserted: int, status: str, errors=()):
    return PersistenceResult(
        rows_attempted=rows_attempted,
        rows_inserted=rows_inserted,
        status=status,
        errors=tuple(errors),
    )


def _validate_rows(
    rows: list[Mapping[str, Any]],
    required_fields: tuple[str, ...],
) -> tuple[str, ...]:
    errors = []
    for position, row in enumerate(rows):
        missing = [
            field
            for field in required_fields
            if row.get(field) is None or row.get(field) == ""
        ]
        if missing:
            errors.append(
                f"row_{position}_missing: {', '.join(missing)}"
            )
    return tuple(errors)


def _persist_batch(
    connection: sqlite3.Connection,
    rows: list[Mapping[str, Any]],
    required_fields: tuple[str, ...],
    columns: tuple[str, ...],
    table_name: str,
) -> PersistenceResult:
    validation_errors = _validate_rows(rows, required_fields)
    if validation_errors:
        return _batch_result(
            len(rows),
            0,
            "VALIDATION_FAILED",
            validation_errors,
        )

    if not rows:
        return _batch_result(0, 0, "NO_ROWS")

    column_sql = ", ".join(columns)
    placeholders = ", ".join("?" for _ in columns)
    sql = f"""
        INSERT OR IGNORE INTO {table_name} ({column_sql})
        VALUES ({placeholders})
    """

    try:
        with connection:
            cursor = connection.executemany(
                sql,
                [tuple(row.get(column) for column in columns) for row in rows],
            )
            return _batch_result(len(rows), cursor.rowcount, "OK")
    except Exception as error:
        connection.rollback()
        return _batch_result(
            len(rows),
            0,
            "FAILED",
            (f"{type(error).__name__}: {error}",),
        )


def persist_route_indices(
    connection: sqlite3.Connection,
    results: Iterable[Mapping[str, Any]],
) -> PersistenceResult:
    """Persist calculated route-level index outputs only."""

    columns = (
        "index_id",
        "route_id",
        "index_date",
        "lead_time_days",
        "index_value",
        "previous_index_value",
        "daily_change_pct",
        "observation_count",
        "flight_count",
        "carrier_count",
        "coverage_pct",
        "methodology",
        "quality_flag",
    )
    required = ("index_id", "route_id", "index_date")
    return _persist_batch(
        connection,
        list(results),
        required,
        columns,
        "route_price_indices",
    )


def persist_lead_time_indices(
    connection: sqlite3.Connection,
    results: Iterable[Mapping[str, Any]],
) -> PersistenceResult:
    """Persist calculated route/lead-time index outputs only."""

    columns = (
        "lead_time_index_id",
        "route_id",
        "index_date",
        "lead_time_days",
        "index_value",
        "median_fare",
        "mean_fare",
        "observation_count",
        "coverage_pct",
        "quality_flag",
    )
    required = (
        "lead_time_index_id",
        "route_id",
        "index_date",
        "lead_time_days",
    )
    return _persist_batch(
        connection,
        list(results),
        required,
        columns,
        "lead_time_indices",
    )


def persist_national_index(
    connection: sqlite3.Connection,
    result: Mapping[str, Any],
) -> PersistenceResult:
    """Persist one calculated national APIx output only."""

    columns = (
        "national_index_id",
        "index_date",
        "index_value",
        "previous_index_value",
        "daily_change_pct",
        "weekly_change_pct",
        "monthly_change_pct",
        "route_count",
        "observation_count",
        "coverage_pct",
        "methodology",
        "quality_flag",
    )
    required = ("national_index_id", "index_date", "index_value")
    return _persist_batch(
        connection,
        [result],
        required,
        columns,
        "national_apix",
    )

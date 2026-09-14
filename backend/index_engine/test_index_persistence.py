from __future__ import annotations

import sqlite3

from index_engine.index_persistence import (
    persist_lead_time_indices,
    persist_national_index,
    persist_route_indices,
)


SCHEMA = """
CREATE TABLE dgca_route_master (
    route_id TEXT PRIMARY KEY
);
CREATE TABLE route_price_indices (
    index_id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL,
    index_date TEXT NOT NULL,
    lead_time_days INTEGER,
    index_value REAL,
    previous_index_value REAL,
    daily_change_pct REAL,
    observation_count INTEGER,
    flight_count INTEGER,
    carrier_count INTEGER,
    coverage_pct REAL,
    methodology TEXT,
    quality_flag TEXT,
    FOREIGN KEY (route_id) REFERENCES dgca_route_master(route_id)
);
CREATE TABLE lead_time_indices (
    lead_time_index_id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL,
    index_date TEXT NOT NULL,
    lead_time_days INTEGER NOT NULL,
    index_value REAL,
    median_fare REAL,
    mean_fare REAL,
    observation_count INTEGER,
    coverage_pct REAL,
    quality_flag TEXT,
    FOREIGN KEY (route_id) REFERENCES dgca_route_master(route_id)
);
CREATE TABLE national_apix (
    national_index_id TEXT PRIMARY KEY,
    index_date TEXT NOT NULL,
    index_value REAL NOT NULL,
    previous_index_value REAL,
    daily_change_pct REAL,
    weekly_change_pct REAL,
    monthly_change_pct REAL,
    route_count INTEGER,
    observation_count INTEGER,
    coverage_pct REAL,
    methodology TEXT,
    quality_flag TEXT
);
"""


def connection_with_schema():
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(SCHEMA)
    connection.executemany(
        "INSERT INTO dgca_route_master VALUES (?)",
        [("R1",), ("R2",)],
    )
    connection.commit()
    return connection


def route_row(index_id="route-1", route_id="R1", index_value=105.0):
    return {
        "index_id": index_id,
        "route_id": route_id,
        "index_date": "2026-09-14",
        "lead_time_days": 1,
        "index_value": index_value,
        "previous_index_value": 100.0,
        "daily_change_pct": 5.0,
        "observation_count": 12,
        "flight_count": 4,
        "carrier_count": 2,
        "coverage_pct": 100.0,
        "methodology": "JEVONS",
        "quality_flag": "OK",
    }


def lead_row(index_id="lead-1", route_id="R1", lead_days=1):
    return {
        "lead_time_index_id": index_id,
        "route_id": route_id,
        "index_date": "2026-09-14",
        "lead_time_days": lead_days,
        "index_value": 105.0,
        "median_fare": None,
        "mean_fare": 5000.0,
        "observation_count": 12,
        "coverage_pct": 100.0,
        "quality_flag": "OK",
    }


def national_row(index_id="national-1"):
    return {
        "national_index_id": index_id,
        "index_date": "2026-09-14",
        "index_value": 103.5,
        "previous_index_value": 100.0,
        "daily_change_pct": 3.5,
        "weekly_change_pct": None,
        "monthly_change_pct": None,
        "route_count": 2,
        "observation_count": 24,
        "coverage_pct": 100.0,
        "methodology": "JEVONS",
        "quality_flag": "OK",
    }


def test_route_index_persistence_and_exact_readback():
    connection = connection_with_schema()
    result = persist_route_indices(connection, [route_row()])

    assert result.status == "OK"
    assert result.rows_attempted == 1
    assert result.rows_inserted == 1
    row = connection.execute(
        "SELECT * FROM route_price_indices WHERE index_id='route-1'"
    ).fetchone()
    assert row["route_id"] == "R1"
    assert row["index_value"] == 105.0
    assert row["methodology"] == "JEVONS"
    assert row["coverage_pct"] == 100.0


def test_multiple_route_rows_and_estimator_metadata():
    connection = connection_with_schema()
    rows = [
        route_row("route-jevons", "R1", 105.0),
        {**route_row("route-laspeyres", "R2", 104.0), "methodology": "LASPEYRES"},
    ]

    result = persist_route_indices(connection, rows)

    assert result.rows_inserted == 2
    assert connection.execute(
        "SELECT COUNT(*) FROM route_price_indices"
    ).fetchone()[0] == 2
    assert connection.execute(
        "SELECT methodology FROM route_price_indices WHERE index_id='route-laspeyres'"
    ).fetchone()[0] == "LASPEYRES"


def test_lead_time_persistence_and_null_optional_value():
    connection = connection_with_schema()
    result = persist_lead_time_indices(
        connection,
        [lead_row("lead-1", "R1", 1), lead_row("lead-7", "R1", 7)],
    )

    assert result.rows_inserted == 2
    row = connection.execute(
        "SELECT * FROM lead_time_indices WHERE lead_time_index_id='lead-1'"
    ).fetchone()
    assert row["lead_time_days"] == 1
    assert row["median_fare"] is None
    assert row["quality_flag"] == "OK"


def test_national_index_persistence():
    connection = connection_with_schema()
    result = persist_national_index(connection, national_row())

    assert result.status == "OK"
    row = connection.execute(
        "SELECT * FROM national_apix WHERE national_index_id='national-1'"
    ).fetchone()
    assert row["index_value"] == 103.5
    assert row["route_count"] == 2
    assert row["coverage_pct"] == 100.0
    assert row["weekly_change_pct"] is None


def test_repeated_persistence_is_idempotent():
    connection = connection_with_schema()
    first = persist_route_indices(connection, [route_row()])
    second = persist_route_indices(connection, [route_row()])

    assert first.rows_inserted == 1
    assert second.rows_inserted == 0
    assert connection.execute(
        "SELECT COUNT(*) FROM route_price_indices"
    ).fetchone()[0] == 1


def test_required_field_validation_prevents_writes():
    connection = connection_with_schema()
    invalid = route_row()
    del invalid["route_id"]

    result = persist_route_indices(connection, [invalid])

    assert result.status == "VALIDATION_FAILED"
    assert result.rows_inserted == 0
    assert connection.execute(
        "SELECT COUNT(*) FROM route_price_indices"
    ).fetchone()[0] == 0


def test_invalid_foreign_key_rolls_back_batch():
    connection = connection_with_schema()
    rows = [route_row("valid", "R1"), route_row("invalid", "UNKNOWN")]

    result = persist_route_indices(connection, rows)

    assert result.status == "FAILED"
    assert result.rows_inserted == 0
    assert connection.execute(
        "SELECT COUNT(*) FROM route_price_indices"
    ).fetchone()[0] == 0


def test_invalid_lead_time_required_field_prevents_write():
    connection = connection_with_schema()
    invalid = lead_row()
    invalid["lead_time_days"] = None

    result = persist_lead_time_indices(connection, [invalid])

    assert result.status == "VALIDATION_FAILED"
    assert connection.execute(
        "SELECT COUNT(*) FROM lead_time_indices"
    ).fetchone()[0] == 0


def test_invalid_national_required_field_prevents_write():
    connection = connection_with_schema()
    invalid = national_row()
    invalid["index_value"] = None

    result = persist_national_index(connection, invalid)

    assert result.status == "VALIDATION_FAILED"
    assert connection.execute(
        "SELECT COUNT(*) FROM national_apix"
    ).fetchone()[0] == 0


def test_empty_batches_are_safe():
    connection = connection_with_schema()

    route_result = persist_route_indices(connection, [])
    lead_result = persist_lead_time_indices(connection, [])

    assert route_result.status == "NO_ROWS"
    assert lead_result.status == "NO_ROWS"
    assert route_result.rows_attempted == 0
    assert lead_result.rows_inserted == 0


def test_connection_remains_usable_after_persistence():
    connection = connection_with_schema()
    persist_national_index(connection, national_row())

    assert connection.execute(
        "SELECT COUNT(*) FROM national_apix"
    ).fetchone()[0] == 1
    connection.close()


def test_all_four_estimator_labels_can_be_persisted():
    connection = connection_with_schema()
    rows = [
        {**route_row(f"route-{methodology}"), "methodology": methodology}
        for methodology in ("JEVONS", "LASPEYRES", "PAASCHE", "FISHER")
    ]

    result = persist_route_indices(connection, rows)

    assert result.rows_inserted == 4
    methods = {
        row[0]
        for row in connection.execute(
            "SELECT methodology FROM route_price_indices"
        ).fetchall()
    }
    assert methods == {"JEVONS", "LASPEYRES", "PAASCHE", "FISHER"}

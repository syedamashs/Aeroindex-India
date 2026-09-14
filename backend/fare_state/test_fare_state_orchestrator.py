from __future__ import annotations

import sqlite3

from fare_state_orchestrator import run_fare_state, run_latest


SCHEMA = """
CREATE TABLE dgca_route_master (route_id TEXT PRIMARY KEY);
CREATE TABLE collection_runs (
    run_id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL,
    total_tasks INTEGER,
    successful_tasks INTEGER,
    failed_tasks INTEGER
);
CREATE TABLE apix_observations (
    observation_id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    search_timestamp TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    departure_datetime TEXT NOT NULL,
    arrival_datetime TEXT,
    flight_number TEXT,
    carrier_code TEXT,
    flight_id TEXT,
    journey_id TEXT,
    fare_product_class TEXT,
    fare_class TEXT,
    fare_family TEXT,
    fare_availability_key TEXT,
    source_offer_id TEXT,
    total_fare REAL,
    is_sold INTEGER,
    passenger_type TEXT,
    run_id TEXT,
    target_lead_days INTEGER,
    route_id TEXT
);
CREATE TABLE fare_state_snapshots (
    snapshot_id TEXT PRIMARY KEY,
    observation_id TEXT NOT NULL,
    snapshot_timestamp TEXT NOT NULL,
    route_id TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    departure_datetime TEXT NOT NULL,
    flight_id TEXT,
    journey_id TEXT,
    flight_number TEXT,
    carrier_code TEXT,
    cabin TEXT,
    fare_family TEXT,
    fare_class TEXT,
    fare_product_class TEXT,
    total_fare REAL,
    fare_rank INTEGER,
    availability_status TEXT,
    state_label TEXT
);
CREATE TABLE fare_state_transitions (
    transition_id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL,
    flight_id TEXT,
    journey_id TEXT,
    flight_number TEXT,
    carrier_code TEXT,
    departure_datetime TEXT NOT NULL,
    from_snapshot_id TEXT NOT NULL,
    to_snapshot_id TEXT NOT NULL,
    from_state TEXT,
    to_state TEXT,
    from_fare REAL,
    to_fare REAL,
    fare_change REAL,
    fare_change_pct REAL,
    state_direction TEXT,
    transition_timestamp TEXT NOT NULL
);
"""


def connection_with_data(lead_days=(1, 7)):
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.executescript(SCHEMA)
    connection.execute("INSERT INTO dgca_route_master VALUES ('R1')")
    connection.executemany(
        "INSERT INTO collection_runs VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            ("run-old", "2026-09-14T10:00:00", "2026-09-14T10:01:00", "SUCCESS", 1, 1, 0),
            ("run-new", "2026-09-14T11:00:00", "2026-09-14T11:01:00", "SUCCESS", 1, 1, 0),
        ],
    )

    rows = []
    for index, lead_day in enumerate(lead_days):
        rows.extend([
            (f"old-{index}", "indigo", "2026-09-14T10:00:00", "DEL", "BOM", "2026-09-21T10:00:00+05:30", "2026-09-21T12:00:00+05:30", "6E1234", "6E", "flight-1", "journey-1", "B", "B", "Saver", "key-1", "offer-1", 100.0, 0, "ADT", "run-old", lead_day, "R1"),
            (f"new-{index}", "indigo", "2026-09-14T11:00:00", "DEL", "BOM", "2026-09-21T10:00:00+05:30", "2026-09-21T12:00:00+05:30", "6E1234", "6E", "flight-1", "journey-1", "B", "B", "Saver", "key-1", "offer-1", 120.0, 0, "ADT", "run-new", lead_day, "R1"),
        ])

    connection.executemany(
        """
        INSERT INTO apix_observations VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    connection.commit()
    return connection


def test_explicit_orchestration_persists_and_is_idempotent():
    connection = connection_with_data()

    first = run_fare_state(connection, "run-old", "run-new")
    second = run_fare_state(connection, "run-old", "run-new")

    assert first["matched_pairs"] == 2
    assert first["snapshots_inserted"] == 4
    assert first["transitions_inserted"] == 2
    assert second["snapshots_inserted"] == 0
    assert second["transitions_inserted"] == 0
    assert first["analytics"]["transition_counts"]["PRICE_INCREASE"] == 2
    assert connection.execute(
        "SELECT COUNT(*) FROM fare_state_snapshots"
    ).fetchone()[0] == 4
    assert connection.execute(
        "SELECT COUNT(*) FROM fare_state_transitions"
    ).fetchone()[0] == 2


def test_latest_run_selection_and_lead_time_rule():
    connection = connection_with_data(lead_days=(1, 7))
    report = run_latest(connection)

    assert report["previous_run_id"] == "run-old"
    assert report["current_run_id"] == "run-new"
    assert report["matched_pairs"] == 2

    connection = connection_with_data(lead_days=(1,))
    connection.execute(
        "UPDATE apix_observations SET target_lead_days = 7 "
        "WHERE observation_id = 'new-0'"
    )
    connection.commit()
    report = run_fare_state(connection, "run-old", "run-new")
    assert report["matched_pairs"] == 0
    assert report["transitions_inserted"] == 0


if __name__ == "__main__":
    test_explicit_orchestration_persists_and_is_idempotent()
    test_latest_run_selection_and_lead_time_rule()
    print("ALL FARE-STATE ORCHESTRATOR TESTS PASSED")
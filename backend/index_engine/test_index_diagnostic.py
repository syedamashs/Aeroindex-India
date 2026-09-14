from __future__ import annotations

import sqlite3

from index_engine.run_index_diagnostic import diagnose_database


SCHEMA = """
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
    source TEXT,
    origin TEXT,
    destination TEXT,
    departure_datetime TEXT,
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
    search_timestamp TEXT,
    target_lead_days INTEGER,
    run_id TEXT,
    route_id TEXT
);
CREATE TABLE fare_state_snapshots (
    snapshot_id TEXT PRIMARY KEY,
    observation_id TEXT
);
CREATE TABLE fare_state_transitions (
    transition_id TEXT PRIMARY KEY,
    state_direction TEXT
);
"""


def connection_with_history(run_count=2):
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.executescript(SCHEMA)
    runs = [
        ("run-1", "2026-09-13T10:00:00+00:00", "2026-09-13T10:05:00+00:00", "SUCCESS", 2, 2, 0),
        ("run-2", "2026-09-14T10:00:00+00:00", "2026-09-14T10:05:00+00:00", "SUCCESS", 2, 2, 0),
    ][:run_count]
    connection.executemany(
        "INSERT INTO collection_runs VALUES (?, ?, ?, ?, ?, ?, ?)",
        runs,
    )

    observations = []
    for run_id, timestamp, suffix in (
        ("run-1", "2026-09-13T10:01:00+00:00", "old"),
        ("run-2", "2026-09-14T10:01:00+00:00", "new"),
    )[:run_count]:
        observations.extend([
            (f"{suffix}-r1", "indigo", "DEL", "BOM", "2026-09-20T10:00:00+00:00", "2026-09-20T12:00:00+00:00", "6E1", "6E", "f1", "j1", "B", "Y", "Saver", "key-r1", "offer-r1", 100.0 if suffix == "old" else 110.0, 0, "ADT", timestamp, 1, run_id, "R1"),
            (f"{suffix}-r2", "indigo", "DEL", "BOM", "2026-09-21T10:00:00+00:00", "2026-09-21T12:00:00+00:00", "6E2", "6E", "f2", "j2", "B", "Y", "Saver", "key-r2", "offer-r2", 200.0, 0, "ADT", timestamp, 7, run_id, "R2"),
        ])
    connection.executemany(
        "INSERT INTO apix_observations VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        observations,
    )
    connection.executemany(
        "INSERT INTO fare_state_snapshots VALUES (?, ?)",
        [("snap-1", "old-r1"), ("snap-2", "new-r1")],
    )
    connection.executemany(
        "INSERT INTO fare_state_transitions VALUES (?, ?)",
        [("transition-1", "UNCHANGED"), ("transition-2", "PRICE_INCREASE")],
    )
    connection.commit()
    return connection


def basket():
    return [
        {"route_id": "R1", "route_weight_pct": "40"},
        {"route_id": "R2", "route_weight_pct": "60"},
    ]


def test_database_inventory_and_temporal_matching():
    connection = connection_with_history()
    report = diagnose_database(connection, basket(), "synthetic://memory")

    history = report["collection_history"]
    temporal = report["temporal_comparability"]

    assert history["successful_run_count"] == 2
    assert history["successful_run_ids"] == ["run-1", "run-2"]
    assert history["total_observations"] == 4
    assert temporal["comparable_pairs"] == 2
    assert temporal["price_observable_pairs"] == 2
    assert temporal["price_increases"] == 1
    assert temporal["unchanged_pairs"] == 1


def test_route_and_lead_time_readiness():
    report = diagnose_database(connection_with_history(), basket())

    routes = {item["route_id"]: item for item in report["route_readiness"]["routes"]}
    assert routes["R1"]["status"] == "CHECKABLE"
    assert routes["R2"]["status"] == "CHECKABLE"
    assert routes["R1"]["usable_pairs"] == 1
    assert routes["R2"]["usable_pairs"] == 1

    leads = {
        item["lead_time_days"]: item
        for item in report["lead_time_readiness"]
    }
    assert leads[1]["comparable_pairs"] == 1
    assert leads[7]["comparable_pairs"] == 1
    assert leads[15]["status"] == "INSUFFICIENT_HISTORY"
    assert leads[30]["status"] == "INSUFFICIENT_HISTORY"
    assert leads[45]["status"] == "INSUFFICIENT_HISTORY"


def test_national_coverage_and_no_fabricated_index():
    report = diagnose_database(connection_with_history(), basket())
    national = report["national_readiness"]

    assert national["expected_route_count"] == 2
    assert national["usable_route_count"] == 2
    assert national["represented_weight_pct"] == 100.0
    assert national["coverage_pct"] == 100.0
    assert national["status"] == "CHECKABLE"
    assert national["index"] is None


def test_insufficient_history_is_not_checkable():
    report = diagnose_database(
        connection_with_history(run_count=1),
        basket(),
    )

    assert report["status"] == "NOT_CHECKABLE"
    assert report["temporal_comparability"]["comparable_pairs"] == 0
    assert report["national_readiness"]["status"] == "INSUFFICIENT_COVERAGE"
    assert report["national_readiness"]["index"] is None
    assert all(
        item["status"] == "NOT_CHECKABLE"
        for item in report["route_readiness"]["routes"]
    )


def test_fare_state_context_is_reported():
    report = diagnose_database(connection_with_history(), basket())
    fare_state = report["fare_state"]

    assert fare_state["snapshot_count"] == 2
    assert fare_state["transition_count"] == 2
    assert fare_state["transition_types"] == {
        "UNCHANGED": 1,
        "PRICE_INCREASE": 1,
    }
    assert fare_state["fep"] == 0.5


def test_read_only_behavior_and_determinism():
    connection = connection_with_history()
    before = {
        table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in (
            "collection_runs",
            "apix_observations",
            "fare_state_snapshots",
            "fare_state_transitions",
        )
    }

    first = diagnose_database(connection, basket())
    second = diagnose_database(connection, basket())
    after = {
        table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in before
    }

    assert first == second
    assert before == after


def test_missing_route_is_insufficient_coverage_not_zero():
    report = diagnose_database(
        connection_with_history(),
        [
            {"route_id": "R1", "route_weight_pct": "40"},
            {"route_id": "R2", "route_weight_pct": "60"},
            {"route_id": "R3", "route_weight_pct": "10"},
        ],
    )

    assert report["national_readiness"]["usable_route_count"] == 2
    assert report["national_readiness"]["coverage_pct"] == 90.9090909090909
    assert report["national_readiness"]["index"] is None

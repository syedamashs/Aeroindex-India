from __future__ import annotations

import sqlite3

from transition_analytics import analyze_transitions


SCHEMA = """
CREATE TABLE apix_observations (
    observation_id TEXT PRIMARY KEY,
    source TEXT,
    target_lead_days INTEGER
);
CREATE TABLE fare_state_snapshots (
    snapshot_id TEXT PRIMARY KEY,
    observation_id TEXT NOT NULL
);
CREATE TABLE fare_state_transitions (
    transition_id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL,
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


def connection_with_rows():
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.executescript(SCHEMA)
    observations = [
        ("old-1", "indigo", 1), ("new-1", "indigo", 1),
        ("old-2", "indigo", 7), ("new-2", "indigo", 7),
        ("old-3", "airindia", 1), ("new-3", "airindia", 1),
        ("old-4", "airindia", 1), ("new-4", "airindia", 1),
        ("old-5", "spicejet", 30), ("new-5", "spicejet", 30),
        ("old-6", "spicejet", 30), ("new-6", "spicejet", 30),
    ]
    connection.executemany(
        "INSERT INTO apix_observations VALUES (?, ?, ?)",
        observations,
    )
    connection.executemany(
        "INSERT INTO fare_state_snapshots VALUES (?, ?)",
        [(f"s-{observation_id}", observation_id) for observation_id, _, _ in observations],
    )
    transitions = [
        ("t-1", "R1", "s-old-1", "s-new-1", "AVAILABLE", "AVAILABLE", 100, 120, 20, 20, "PRICE_INCREASE"),
        ("t-2", "R1", "s-old-2", "s-new-2", "AVAILABLE", "AVAILABLE", 200, 180, -20, -10, "PRICE_DECREASE"),
        ("t-3", "R2", "s-old-3", "s-new-3", "AVAILABLE", "AVAILABLE", 100, 100, 0, 0, "UNCHANGED"),
        ("t-4", "R2", "s-old-4", "s-new-4", "UNKNOWN", "UNKNOWN", None, 100, None, "bad", "AVAILABILITY_UNKNOWN"),
        ("t-5", "R3", "s-old-5", "s-new-5", "AVAILABLE", "SOLD_OUT", 100, 100, 0, 0, "BECAME_UNAVAILABLE"),
        ("t-6", "R3", "s-old-6", "s-new-6", "SOLD_OUT", "AVAILABLE", 100, 100, 0, 0, "BECAME_AVAILABLE"),
    ]
    connection.executemany(
        """
        INSERT INTO fare_state_transitions VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [row + ("2026-09-14T12:00:00+00:00",) for row in transitions],
    )
    connection.commit()
    return connection


def test_analytics_counts_fep_and_breakdowns():
    report = analyze_transitions(connection_with_rows())

    assert report["overall"]["total_transitions"] == 6
    assert report["transition_counts"]["PRICE_INCREASE"] == 1
    assert report["transition_counts"]["PRICE_DECREASE"] == 1
    assert report["transition_counts"]["UNCHANGED"] == 1
    assert report["transition_counts"]["BECAME_UNAVAILABLE"] == 1
    assert report["transition_counts"]["BECAME_AVAILABLE"] == 1
    assert report["transition_counts"]["AVAILABILITY_UNKNOWN"] == 1
    assert report["fep"]["decimal"] == 1 / 3
    assert abs(report["fep"]["percentage"] - 100 / 3) < 1e-9
    assert {item["source"] for item in report["by_source"]} == {
        "airindia", "indigo", "spicejet"
    }
    assert {item["route_id"] for item in report["by_route"]} == {
        "R1", "R2", "R3"
    }
    assert {item["target_lead_days"] for item in report["by_lead_time"]} == {
        1, 7, 30
    }
    assert report["by_source_lead_time"]


def test_analytics_statistics_and_integrity_diagnostics():
    report = analyze_transitions(connection_with_rows())
    movement = report["fare_movement"]

    assert abs(movement["price_observable"]["mean_absolute_fare_change"] - 40 / 3) < 1e-9
    assert movement["price_observable"]["median_absolute_fare_change"] == 20
    assert movement["price_increase"]["mean_fare_change"] == 20
    assert movement["price_decrease"]["mean_fare_change"] == -20
    assert report["data_quality"]["transitions_with_missing_fares"] == 1
    assert report["data_quality"]["transitions_with_invalid_percentage"] == 1
    assert report["data_quality"]["unknown_availability_transitions"] == 1


def test_zero_price_denominator_returns_none():
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.executescript(SCHEMA)
    report = analyze_transitions(connection)
    assert report["fep"]["decimal"] is None
    assert report["fep"]["percentage"] is None


if __name__ == "__main__":
    for test in (
        test_analytics_counts_fep_and_breakdowns,
        test_analytics_statistics_and_integrity_diagnostics,
        test_zero_price_denominator_returns_none,
    ):
        test()
    print("ALL TRANSITION ANALYTICS TESTS PASSED")
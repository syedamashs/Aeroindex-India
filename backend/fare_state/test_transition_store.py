from __future__ import annotations

import sqlite3

from transition_readiness import Observation
from transition_store import persist_snapshots, persist_transitions


SNAPSHOT_SCHEMA = """
CREATE TABLE apix_observations (
    observation_id TEXT PRIMARY KEY
);

CREATE TABLE dgca_route_master (
    route_id TEXT PRIMARY KEY
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
    state_label TEXT,
    FOREIGN KEY (observation_id) REFERENCES apix_observations(observation_id),
    FOREIGN KEY (route_id) REFERENCES dgca_route_master(route_id)
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
    transition_timestamp TEXT NOT NULL,
    FOREIGN KEY (route_id) REFERENCES dgca_route_master(route_id),
    FOREIGN KEY (from_snapshot_id) REFERENCES fare_state_snapshots(snapshot_id),
    FOREIGN KEY (to_snapshot_id) REFERENCES fare_state_snapshots(snapshot_id)
);
"""


def make_observation(observation_id="obs-1", route_id="DELHI_MUMBAI"):
    return {
        "observation_id": observation_id,
        "run_id": "run-1",
        "task_id": "task-1",
        "route_id": route_id,
        "source": "indigo",
        "search_timestamp": "2026-09-14T12:00:00+00:00",
        "target_lead_days": 7,
        "origin": "DEL",
        "destination": "BOM",
        "departure_datetime": "2026-09-21T10:00:00+05:30",
        "flight_id": "flight-1",
        "journey_id": "journey-1",
        "flight_number": "6E1234",
        "carrier_code": "6E",
        "fare_product_class": "B",
        "fare_class": "B",
        "fare_family": "Saver",
        "source_offer_id": "offer-1",
        "fare_availability_key": "key-1",
        "base_fare": 3000.0,
        "taxes": 500.0,
        "total_fees": 100.0,
        "total_fare": 3600.0,
        "is_sold": False,
        "filling_fast": True,
    }


def connection_with_schema():
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(SNAPSHOT_SCHEMA)
    connection.execute(
        "INSERT INTO apix_observations VALUES (?)", ("obs-1",)
    )
    connection.execute(
        "INSERT INTO dgca_route_master VALUES (?)", ("DELHI_MUMBAI",)
    )
    connection.commit()
    return connection


def as_observation(values):
    return Observation(
        observation_id=values["observation_id"],
        run_id=values["run_id"],
        source=values["source"],
        origin=values["origin"],
        destination=values["destination"],
        departure_datetime=values["departure_datetime"],
        arrival_datetime="2026-09-21T12:00:00+05:30",
        flight_number=values["flight_number"],
        carrier_code=values["carrier_code"],
        flight_id=values["flight_id"],
        journey_id=values["journey_id"],
        fare_product_class=values["fare_product_class"],
        fare_class=values["fare_class"],
        fare_family=values["fare_family"],
        fare_availability_key=values["fare_availability_key"],
        source_offer_id=values["source_offer_id"],
        total_fare=values["total_fare"],
        is_sold=values["is_sold"],
        passenger_type="ADT",
        search_timestamp=values["search_timestamp"],
        target_lead_days=values["target_lead_days"],
        route_id=values["route_id"],
    )


def prepare_pair(previous_fare, current_fare, current_is_sold=False):
    connection = connection_with_schema()
    previous_values = make_observation("obs-previous")
    current_values = make_observation("obs-current")
    previous_values["total_fare"] = previous_fare
    current_values["total_fare"] = current_fare
    current_values["is_sold"] = current_is_sold

    for values in (previous_values, current_values):
        connection.execute(
            "INSERT INTO apix_observations VALUES (?)",
            (values["observation_id"],),
        )

    connection.commit()
    persist_snapshots(connection, [previous_values, current_values])

    return connection, as_observation(previous_values), as_observation(current_values)


def test_one_observation_preserves_supported_fields():
    connection = connection_with_schema()
    observation = make_observation()

    assert persist_snapshots(connection, [observation]) == 1

    row = connection.execute(
        "SELECT * FROM fare_state_snapshots"
    ).fetchone()

    assert row[0] == "obs-1"
    assert row[1] == "obs-1"
    assert row[2] == observation["search_timestamp"]
    assert row[3] == observation["route_id"]
    assert row[4] == observation["origin"]
    assert row[5] == observation["destination"]
    assert row[6] == observation["departure_datetime"]
    assert row[7:11] == (
        observation["flight_id"],
        observation["journey_id"],
        observation["flight_number"],
        observation["carrier_code"],
    )
    assert row[12:16] == (
        observation["fare_family"],
        observation["fare_class"],
        observation["fare_product_class"],
        observation["total_fare"],
    )
    assert row[17] == "AVAILABLE"
    assert row[18] == "AVAILABLE"


def test_same_observation_is_idempotent():
    connection = connection_with_schema()
    observation = make_observation()

    assert persist_snapshots(connection, [observation]) == 1
    assert persist_snapshots(connection, [observation]) == 0
    assert connection.execute(
        "SELECT COUNT(*) FROM fare_state_snapshots"
    ).fetchone()[0] == 1


def test_multiple_observations_create_multiple_snapshots():
    connection = connection_with_schema()
    second = make_observation("obs-2")
    connection.execute(
        "INSERT INTO apix_observations VALUES (?)", ("obs-2",)
    )
    connection.commit()

    assert persist_snapshots(
        connection,
        [make_observation(), second],
    ) == 2
    assert connection.execute(
        "SELECT COUNT(*) FROM fare_state_snapshots"
    ).fetchone()[0] == 2


def test_incomplete_observation_is_rejected_without_writing():
    connection = connection_with_schema()
    observation = make_observation()
    del observation["route_id"]

    try:
        persist_snapshots(connection, [observation])
    except ValueError as error:
        assert "route_id" in str(error)
    else:
        raise AssertionError("Expected incomplete observation to be rejected")

    assert connection.execute(
        "SELECT COUNT(*) FROM fare_state_snapshots"
    ).fetchone()[0] == 0


def test_price_increase_persists_delta_and_percentage():
    connection, previous, current = prepare_pair(100.0, 125.0)

    assert persist_transitions(connection, [(previous, current)]) == 1
    row = connection.execute(
        "SELECT * FROM fare_state_transitions"
    ).fetchone()

    assert row["from_snapshot_id"] == "obs-previous"
    assert row["to_snapshot_id"] == "obs-current"
    assert row["from_fare"] == 100.0
    assert row["to_fare"] == 125.0
    assert row["fare_change"] == 25.0
    assert row["fare_change_pct"] == 25.0
    assert row["state_direction"] == "PRICE_INCREASE"


def test_price_decrease_and_unchanged_are_persisted():
    connection, previous, current = prepare_pair(125.0, 100.0)
    assert persist_transitions(connection, [(previous, current)]) == 1
    assert connection.execute(
        "SELECT state_direction FROM fare_state_transitions"
    ).fetchone()[0] == "PRICE_DECREASE"

    connection, previous, current = prepare_pair(100.0, 100.0)
    assert persist_transitions(connection, [(previous, current)]) == 1
    assert connection.execute(
        "SELECT state_direction FROM fare_state_transitions"
    ).fetchone()[0] == "UNCHANGED"


def test_became_unavailable_preserves_states():
    connection, previous, current = prepare_pair(
        100.0,
        100.0,
        current_is_sold=True,
    )

    assert persist_transitions(connection, [(previous, current)]) == 1
    row = connection.execute(
        "SELECT from_state, to_state, state_direction "
        "FROM fare_state_transitions"
    ).fetchone()

    assert row["from_state"] == "AVAILABLE"
    assert row["to_state"] == "SOLD_OUT"
    assert row["state_direction"] == "BECAME_UNAVAILABLE"


def test_transition_insert_is_idempotent_and_supports_multiple_pairs():
    connection = connection_with_schema()
    pairs = []

    for index, (previous_fare, current_fare) in enumerate(
        ((100.0, 110.0), (200.0, 180.0)),
        start=1,
    ):
        previous_values = make_observation(f"previous-{index}")
        current_values = make_observation(f"current-{index}")
        previous_values["total_fare"] = previous_fare
        current_values["total_fare"] = current_fare

        for values in (previous_values, current_values):
            connection.execute(
                "INSERT INTO apix_observations VALUES (?)",
                (values["observation_id"],),
            )
        pairs.append((previous_values, current_values))

    connection.commit()
    persist_snapshots(
        connection,
        [observation for pair in pairs for observation in pair],
    )
    observation_pairs = [
        (as_observation(previous), as_observation(current))
        for previous, current in pairs
    ]

    assert persist_transitions(connection, observation_pairs) == 2
    assert persist_transitions(connection, observation_pairs) == 0
    assert connection.execute(
        "SELECT COUNT(*) FROM fare_state_transitions"
    ).fetchone()[0] == 2


if __name__ == "__main__":
    tests = [
        test_one_observation_preserves_supported_fields,
        test_same_observation_is_idempotent,
        test_multiple_observations_create_multiple_snapshots,
        test_incomplete_observation_is_rejected_without_writing,
        test_price_increase_persists_delta_and_percentage,
        test_price_decrease_and_unchanged_are_persisted,
        test_became_unavailable_preserves_states,
        test_transition_insert_is_idempotent_and_supports_multiple_pairs,
    ]

    for test in tests:
        test()

    print("ALL TRANSITION STORE TESTS PASSED")
    print(f"Tests passed: {len(tests)}")
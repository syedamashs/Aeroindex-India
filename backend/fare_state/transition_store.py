from __future__ import annotations

import sqlite3
from hashlib import sha256
from typing import Any, Iterable, Mapping

from transition_engine import Observation, build_transition


REQUIRED_FIELDS = (
    "observation_id",
    "search_timestamp",
    "route_id",
    "origin",
    "destination",
    "departure_datetime",
)


def _validate_observation(observation: Mapping[str, Any]) -> None:
    missing = [
        field
        for field in REQUIRED_FIELDS
        if observation.get(field) in (None, "")
    ]

    if missing:
        raise ValueError(
            "Observation is missing snapshot fields: "
            + ", ".join(missing)
        )


def _availability_status(is_sold: Any) -> str | None:
    if is_sold is None or is_sold == "":
        return None

    return "SOLD_OUT" if bool(is_sold) else "AVAILABLE"


def _snapshot_values(observation: Mapping[str, Any]) -> tuple[Any, ...]:
    _validate_observation(observation)

    # observation_id is the deterministic snapshot identity: one canonical
    # observation produces at most one historical snapshot.
    snapshot_id = str(observation["observation_id"])

    availability_status = _availability_status(
        observation.get("is_sold")
    )

    return (
        snapshot_id,
        observation["observation_id"],
        observation["search_timestamp"],
        observation["route_id"],
        observation["origin"],
        observation["destination"],
        observation["departure_datetime"],
        observation.get("flight_id"),
        observation.get("journey_id"),
        observation.get("flight_number"),
        observation.get("carrier_code"),
        None,
        observation.get("fare_family"),
        observation.get("fare_class"),
        observation.get("fare_product_class"),
        observation.get("total_fare"),
        None,
        availability_status,
        availability_status,
    )


def persist_snapshots(
    connection: sqlite3.Connection,
    observations: Iterable[Mapping[str, Any]],
) -> int:
    """Persist canonical observations as idempotent fare-state snapshots."""

    observations = list(observations)

    if not observations:
        return 0

    sql = """
        INSERT OR IGNORE INTO fare_state_snapshots (
            snapshot_id,
            observation_id,
            snapshot_timestamp,
            route_id,
            origin,
            destination,
            departure_datetime,
            flight_id,
            journey_id,
            flight_number,
            carrier_code,
            cabin,
            fare_family,
            fare_class,
            fare_product_class,
            total_fare,
            fare_rank,
            availability_status,
            state_label
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    values = [_snapshot_values(observation) for observation in observations]

    try:
        cursor = connection.cursor()
        cursor.executemany(sql, values)
        connection.commit()
        return cursor.rowcount
    except Exception:
        connection.rollback()
        raise


def _transition_values(
    previous: Observation,
    current: Observation,
) -> tuple[Any, ...]:
    transition = build_transition(previous, current)
    previous_id = str(previous.observation_id)
    current_id = str(current.observation_id)
    transition_id = sha256(
        f"{previous_id}|{current_id}".encode("utf-8")
    ).hexdigest()[:32]

    previous_fare = transition.previous_total_fare
    current_fare = transition.current_total_fare
    fare_change = None
    fare_change_pct = None

    if previous_fare is not None and current_fare is not None:
        fare_change = current_fare - previous_fare
        if previous_fare > 0:
            fare_change_pct = fare_change / previous_fare * 100.0

    return (
        transition_id,
        previous.route_id,
        previous.flight_id or current.flight_id,
        previous.journey_id or current.journey_id,
        transition.flight_number,
        previous.carrier_code or current.carrier_code,
        previous.departure_datetime,
        previous_id,
        current_id,
        _availability_status(previous.is_sold),
        _availability_status(current.is_sold),
        previous_fare,
        current_fare,
        fare_change,
        fare_change_pct,
        transition.transition_type,
        current.search_timestamp,
    )


def persist_transitions(
    connection: sqlite3.Connection,
    matched_pairs: Iterable[tuple[Observation, Observation]],
) -> int:
    """Persist classified matched observation pairs idempotently."""

    pairs = list(matched_pairs)

    if not pairs:
        return 0

    sql = """
        INSERT OR IGNORE INTO fare_state_transitions (
            transition_id,
            route_id,
            flight_id,
            journey_id,
            flight_number,
            carrier_code,
            departure_datetime,
            from_snapshot_id,
            to_snapshot_id,
            from_state,
            to_state,
            from_fare,
            to_fare,
            fare_change,
            fare_change_pct,
            state_direction,
            transition_timestamp
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    values = [
        _transition_values(previous, current)
        for previous, current in pairs
    ]

    try:
        cursor = connection.cursor()
        cursor.executemany(sql, values)
        connection.commit()
        return cursor.rowcount
    except Exception:
        connection.rollback()
        raise
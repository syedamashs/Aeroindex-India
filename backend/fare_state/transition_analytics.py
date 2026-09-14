from __future__ import annotations

import math
import sqlite3
from collections import Counter
from statistics import mean, median
from typing import Any, Iterable


TRANSITION_TYPES = (
    "UNCHANGED",
    "PRICE_INCREASE",
    "PRICE_DECREASE",
    "BECAME_UNAVAILABLE",
    "BECAME_AVAILABLE",
    "AVAILABILITY_UNKNOWN",
)

PRICE_TYPES = {
    "UNCHANGED",
    "PRICE_INCREASE",
    "PRICE_DECREASE",
}


def _number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _stats(rows: Iterable[sqlite3.Row]) -> dict[str, Any]:
    rows = list(rows)
    signed_changes = [
        float(row["fare_change"])
        for row in rows
        if _number(row["fare_change"]) is not None
    ]
    fare_changes = [
        abs(float(row["fare_change"]))
        for row in rows
        if _number(row["fare_change"]) is not None
    ]
    percentage_changes = [
        float(row["fare_change_pct"])
        for row in rows
        if _number(row["fare_change_pct"]) is not None
    ]

    return {
        "count": len(rows),
        "mean_fare_change": (
            mean(signed_changes) if signed_changes else None
        ),
        "median_fare_change": (
            median(signed_changes) if signed_changes else None
        ),
        "mean_absolute_fare_change": (
            mean(fare_changes) if fare_changes else None
        ),
        "median_absolute_fare_change": (
            median(fare_changes) if fare_changes else None
        ),
        "mean_percentage_change": (
            mean(percentage_changes) if percentage_changes else None
        ),
        "median_percentage_change": (
            median(percentage_changes) if percentage_changes else None
        ),
    }


def _directional_stats(
    rows: Iterable[sqlite3.Row],
    direction: str,
) -> dict[str, Any]:
    result = _stats(rows)
    result[f"mean_fare_{direction}"] = result[
        "mean_absolute_fare_change"
    ]
    result[f"median_fare_{direction}"] = result[
        "median_absolute_fare_change"
    ]
    result[f"mean_percentage_{direction}"] = result[
        "mean_percentage_change"
    ]
    result[f"median_percentage_{direction}"] = result[
        "median_percentage_change"
    ]
    return result


def _group_breakdown(rows: list[sqlite3.Row], keys: tuple[str, ...]) -> list[dict[str, Any]]:
    groups: dict[tuple[Any, ...], list[sqlite3.Row]] = {}
    for row in rows:
        key = tuple(row[key_name] for key_name in keys)
        groups.setdefault(key, []).append(row)

    result = []
    for key in sorted(groups, key=lambda item: tuple("" if value is None else str(value) for value in item)):
        group_rows = groups[key]
        price_rows = [row for row in group_rows if row["state_direction"] in PRICE_TYPES]
        increase_rows = [row for row in group_rows if row["state_direction"] == "PRICE_INCREASE"]
        decrease_rows = [row for row in group_rows if row["state_direction"] == "PRICE_DECREASE"]
        denominator = len(price_rows)
        item = {name: value for name, value in zip(keys, key)}
        item.update({
            "total_transitions": len(group_rows),
            "transition_counts": dict(Counter(row["state_direction"] for row in group_rows)),
            "fep": (
                sum(row["state_direction"] == "PRICE_INCREASE" for row in price_rows) / denominator
                if denominator else None
            ),
            "fep_percentage": (
                sum(row["state_direction"] == "PRICE_INCREASE" for row in price_rows) / denominator * 100.0
                if denominator else None
            ),
            "price_observable": _stats(price_rows),
            "price_increase": _directional_stats(increase_rows, "increase"),
            "price_decrease": _directional_stats(decrease_rows, "decrease"),
        })
        result.append(item)
    return result


def _load_rows(connection: sqlite3.Connection) -> list[sqlite3.Row]:
    query = """
        SELECT
            t.transition_id,
            t.route_id,
            t.from_snapshot_id,
            t.to_snapshot_id,
            t.from_state,
            t.to_state,
            t.from_fare,
            t.to_fare,
            t.fare_change,
            t.fare_change_pct,
            t.state_direction,
            t.transition_timestamp,
            previous_observation.observation_id AS previous_observation_id,
            current_observation.observation_id AS current_observation_id,
            previous_observation.source AS source,
            previous_observation.target_lead_days AS target_lead_days,
            current_observation.target_lead_days AS current_target_lead_days
        FROM fare_state_transitions AS t
        JOIN fare_state_snapshots AS previous_snapshot
          ON previous_snapshot.snapshot_id = t.from_snapshot_id
        JOIN fare_state_snapshots AS current_snapshot
          ON current_snapshot.snapshot_id = t.to_snapshot_id
        JOIN apix_observations AS previous_observation
          ON previous_observation.observation_id = previous_snapshot.observation_id
        JOIN apix_observations AS current_observation
          ON current_observation.observation_id = current_snapshot.observation_id
        ORDER BY t.transition_id
    """
    return connection.execute(query).fetchall()


def analyze_transitions(connection: sqlite3.Connection) -> dict[str, Any]:
    """Return a read-only, structured report over persisted transitions."""
    rows = _load_rows(connection)
    counts = Counter(row["state_direction"] for row in rows)
    transition_counts = {name: counts.get(name, 0) for name in TRANSITION_TYPES}
    transition_counts.update({
        name: count
        for name, count in counts.items()
        if name not in transition_counts
    })

    price_rows = [row for row in rows if row["state_direction"] in PRICE_TYPES]
    increase_rows = [row for row in rows if row["state_direction"] == "PRICE_INCREASE"]
    decrease_rows = [row for row in rows if row["state_direction"] == "PRICE_DECREASE"]
    denominator = len(price_rows)
    fep = len(increase_rows) / denominator if denominator else None

    duplicate_groups = connection.execute(
        """
        SELECT from_snapshot_id, to_snapshot_id, COUNT(*) AS duplicate_count
        FROM fare_state_transitions
        GROUP BY from_snapshot_id, to_snapshot_id
        HAVING COUNT(*) > 1
        """
    ).fetchall()

    different_lead = [
        row for row in rows
        if row["target_lead_days"] is not None
        and row["current_target_lead_days"] is not None
        and row["target_lead_days"] != row["current_target_lead_days"]
    ]
    missing_fares = [
        row for row in rows
        if _number(row["from_fare"]) is None or _number(row["to_fare"]) is None
    ]
    invalid_percentages = [
        row for row in rows
        if row["fare_change_pct"] is not None
        and _number(row["fare_change_pct"]) is None
    ]
    missing_percentages = [
        row for row in rows
        if row["state_direction"] in PRICE_TYPES
        and _number(row["from_fare"]) is not None
        and _number(row["to_fare"]) is not None
        and _number(row["from_fare"]) > 0
        and row["fare_change_pct"] is None
    ]
    unknown_availability = [
        row for row in rows
        if row["state_direction"] in {"AVAILABILITY_UNKNOWN", "BECAME_UNAVAILABLE", "BECAME_AVAILABLE"}
        and (row["from_state"] not in {"AVAILABLE", "SOLD_OUT"}
             or row["to_state"] not in {"AVAILABLE", "SOLD_OUT"})
    ]

    return {
        "overall": {
            "total_transitions": len(rows),
            "price_observable_transitions": denominator,
        },
        "transition_counts": transition_counts,
        "fare_movement": {
            "price_observable": _stats(price_rows),
            "price_increase": _directional_stats(increase_rows, "increase"),
            "price_decrease": _directional_stats(decrease_rows, "decrease"),
        },
        "fep": {
            "decimal": fep,
            "percentage": fep * 100.0 if fep is not None else None,
        },
        "by_source": _group_breakdown(rows, ("source",)),
        "by_route": _group_breakdown(rows, ("route_id",)),
        "by_lead_time": _group_breakdown(rows, ("target_lead_days",)),
        "by_source_lead_time": _group_breakdown(rows, ("source", "target_lead_days")),
        "data_quality": {
            "duplicate_transition_identities": len(duplicate_groups),
            "transitions_with_different_target_lead_days": len(different_lead),
            "transitions_with_missing_fares": len(missing_fares),
            "transitions_with_invalid_percentage": len(invalid_percentages),
            "transitions_with_missing_percentage": len(missing_percentages),
            "unknown_availability_transitions": len(unknown_availability),
        },
    }
from __future__ import annotations

import csv
import sqlite3
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fare_state.transition_engine import build_transition
from fare_state.transition_readiness import (
    Observation,
    match_repeated_snapshots,
)

DB_PATH = BACKEND_DIR / "data" / "apix.db"
ROUTES_PATH = BACKEND_DIR / "config" / "routes.csv"
LEAD_TIMES = (1, 7, 15, 30, 45)
PRICE_TYPES = {"UNCHANGED", "PRICE_INCREASE", "PRICE_DECREASE"}


def load_route_basket(path: Path = ROUTES_PATH) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def _table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    return connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    ).fetchone() is not None


def _parse_timestamp(value: Any) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except (TypeError, ValueError):
        return None


def _observation(row: Mapping[str, Any]) -> Observation:
    return Observation(
        observation_id=row["observation_id"],
        run_id=row["run_id"],
        source=row["source"],
        origin=row["origin"],
        destination=row["destination"],
        departure_datetime=row["departure_datetime"],
        arrival_datetime=row["arrival_datetime"],
        flight_number=row["flight_number"],
        carrier_code=row["carrier_code"],
        flight_id=row["flight_id"],
        journey_id=row["journey_id"],
        fare_product_class=row["fare_product_class"],
        fare_class=row["fare_class"],
        fare_family=row["fare_family"],
        fare_availability_key=row["fare_availability_key"],
        source_offer_id=row["source_offer_id"],
        total_fare=row["total_fare"],
        is_sold=row["is_sold"],
        passenger_type=row["passenger_type"],
        search_timestamp=row["search_timestamp"],
        target_lead_days=row["target_lead_days"],
        route_id=row["route_id"],
    )


def _load_runs(connection: sqlite3.Connection) -> list[sqlite3.Row]:
    return connection.execute(
        """
        SELECT run_id, started_at, completed_at, status,
               total_tasks, successful_tasks, failed_tasks
        FROM collection_runs
        WHERE status='SUCCESS'
        ORDER BY COALESCE(completed_at, started_at), run_id
        """
    ).fetchall()


def _load_observations(connection: sqlite3.Connection, run_id: str) -> list[Observation]:
    rows = connection.execute(
        """
        SELECT observation_id, run_id, source, origin, destination,
               departure_datetime, arrival_datetime, flight_number,
               carrier_code, flight_id, journey_id, fare_product_class,
               fare_class, fare_family, fare_availability_key,
               source_offer_id, total_fare, is_sold, passenger_type,
               search_timestamp, target_lead_days, route_id
        FROM apix_observations
        WHERE run_id=?
        ORDER BY source, target_lead_days, departure_datetime,
                 flight_number, fare_family, observation_id
        """,
        (run_id,),
    ).fetchall()
    return [_observation(row) for row in rows]


def _pair_observations(previous: list[Observation], current: list[Observation]):
    matching = match_repeated_snapshots(previous, current)
    previous_by_id = {item.observation_id: item for item in previous}
    current_by_id = {item.observation_id: item for item in current}
    pairs = []
    for comparison in matching["comparisons"]:
        pairs.append(
            (
                previous_by_id[comparison["old_observation_id"]],
                current_by_id[comparison["new_observation_id"]],
            )
        )
    return matching, pairs


def _transition_summary(pairs):
    counts = Counter()
    price_pairs = 0
    for previous, current in pairs:
        transition = build_transition(previous, current)
        counts[transition.transition_type] += 1
        if transition.transition_type in PRICE_TYPES:
            price_pairs += 1
    increases = counts["PRICE_INCREASE"]
    return {
        "comparable_pairs": len(pairs),
        "price_observable_pairs": price_pairs,
        "unchanged_pairs": counts["UNCHANGED"],
        "price_increases": increases,
        "price_decreases": counts["PRICE_DECREASE"],
        "availability_transitions": (
            counts["BECAME_AVAILABLE"] + counts["BECAME_UNAVAILABLE"]
        ),
        "unknown_not_checkable_transitions": counts["AVAILABILITY_UNKNOWN"],
        "transition_counts": dict(counts),
        "fep": (
            increases / price_pairs
            if price_pairs else None
        ),
    }


def _inventory(connection, run_ids):
    observations = connection.execute(
        "SELECT COUNT(*) FROM apix_observations"
    ).fetchone()[0]
    by_source = connection.execute(
        "SELECT source, COUNT(*) count FROM apix_observations GROUP BY source ORDER BY source"
    ).fetchall()
    by_route = connection.execute(
        "SELECT route_id, COUNT(*) count FROM apix_observations GROUP BY route_id ORDER BY route_id"
    ).fetchall()
    by_lead = connection.execute(
        "SELECT target_lead_days, COUNT(*) count FROM apix_observations GROUP BY target_lead_days ORDER BY target_lead_days"
    ).fetchall()
    return {
        "total_observations": observations,
        "observations_by_source": [dict(row) for row in by_source],
        "observations_by_route": [dict(row) for row in by_route],
        "observations_by_lead_time": [dict(row) for row in by_lead],
    }


def diagnose_database(
    connection: sqlite3.Connection,
    route_basket: Iterable[Mapping[str, Any]],
    database_path: str = ":memory:",
) -> dict[str, Any]:
    """Produce a read-only diagnostic from an already-open connection."""

    route_basket = list(route_basket)
    runs = _load_runs(connection)
    run_observations = {
        row["run_id"]: _load_observations(connection, row["run_id"])
        for row in runs
    }
    all_pairs = []
    consecutive_reports = []

    for previous_run, current_run in zip(runs, runs[1:]):
        matching, pairs = _pair_observations(
            run_observations[previous_run["run_id"]],
            run_observations[current_run["run_id"]],
        )
        summary = _transition_summary(pairs)
        all_pairs.extend(pairs)
        consecutive_reports.append({
            "previous_run_id": previous_run["run_id"],
            "current_run_id": current_run["run_id"],
            "previous_observations": matching["old_count"],
            "current_observations": matching["new_count"],
            "previous_unmatched": matching["old_unmatched_count"],
            "current_unmatched": matching["new_unmatched_count"],
            **summary,
        })

    latest_pair = consecutive_reports[-1] if consecutive_reports else None
    historical = run_observations[runs[-2]["run_id"]] if len(runs) >= 2 else []
    current = run_observations[runs[-1]["run_id"]] if runs else []
    latest_pairs = []
    if len(runs) >= 2:
        _, latest_pairs = _pair_observations(historical, current)

    route_pair_counts = Counter(
        previous.route_id
        for previous, _ in all_pairs
        if previous.route_id is not None
    )
    route_readiness = []
    for route in route_basket:
        route_id = route.get("route_id")
        pair_count = route_pair_counts.get(route_id, 0)
        status = "CHECKABLE" if pair_count else (
            "NOT_CHECKABLE" if len(runs) < 2 else "INSUFFICIENT_HISTORY"
        )
        route_readiness.append({
            "route_id": route_id,
            "usable_pairs": pair_count,
            "status": status,
        })

    lead_readiness = []
    for lead_time in LEAD_TIMES:
        historical_count = sum(
            item.target_lead_days == lead_time for item in historical
        )
        current_count = sum(item.target_lead_days == lead_time for item in current)
        pairs = [
            (previous, now)
            for previous, now in latest_pairs
            if previous.target_lead_days == lead_time
        ]
        usable = sum(
            previous.total_fare is not None
            and now.total_fare is not None
            and previous.total_fare > 0
            and now.total_fare > 0
            for previous, now in pairs
        )
        lead_readiness.append({
            "lead_time_days": lead_time,
            "historical_observations": historical_count,
            "current_observations": current_count,
            "comparable_pairs": len(pairs),
            "usable_price_relatives": usable,
            "status": "CHECKABLE" if usable else "INSUFFICIENT_HISTORY",
        })

    total_weight = sum(
        float(route.get("route_weight_pct", 0) or 0)
        for route in route_basket
    )
    usable_route_ids = {
        previous.route_id
        for previous, current_item in all_pairs
        if previous.route_id is not None
        and current_item.route_id == previous.route_id
    }
    represented_weight = sum(
        float(route.get("route_weight_pct", 0) or 0)
        for route in route_basket
        if route.get("route_id") in usable_route_ids
    )
    coverage_pct = represented_weight / total_weight * 100 if total_weight else 0
    national_status = (
        "CHECKABLE"
        if usable_route_ids and coverage_pct >= 50
        else "INSUFFICIENT_COVERAGE"
    )

    history_times = [
        _parse_timestamp(row["completed_at"] or row["started_at"])
        for row in runs
    ]
    history_times = [time for time in history_times if time is not None]
    elapsed_history_hours = (
        (max(history_times) - min(history_times)).total_seconds() / 3600
        if len(history_times) >= 2 else None
    )

    fare_state = {
        "snapshot_count": (
            connection.execute("SELECT COUNT(*) FROM fare_state_snapshots").fetchone()[0]
            if _table_exists(connection, "fare_state_snapshots") else 0
        ),
        "transition_count": (
            connection.execute("SELECT COUNT(*) FROM fare_state_transitions").fetchone()[0]
            if _table_exists(connection, "fare_state_transitions") else 0
        ),
        "transition_types": {},
        "fep": None,
    }
    if _table_exists(connection, "fare_state_transitions"):
        transition_types = connection.execute(
            "SELECT state_direction, COUNT(*) count FROM fare_state_transitions GROUP BY state_direction"
        ).fetchall()
        fare_state["transition_types"] = {
            row["state_direction"]: row["count"] for row in transition_types
        }
        price_total = sum(
            fare_state["transition_types"].get(name, 0)
            for name in PRICE_TYPES
        )
        if price_total:
            fare_state["fep"] = (
                fare_state["transition_types"].get("PRICE_INCREASE", 0)
                / price_total
            )

    status = "CHECKABLE" if national_status == "CHECKABLE" else "NOT_CHECKABLE"
    return {
        "database": {
            "path": database_path,
            "mode": "READ_ONLY_DIAGNOSTIC",
        },
        "collection_history": {
            "successful_run_count": len(runs),
            "successful_run_ids": [row["run_id"] for row in runs],
            "oldest_successful_timestamp": (
                runs[0]["completed_at"] if runs else None
            ),
            "newest_successful_timestamp": (
                runs[-1]["completed_at"] if runs else None
            ),
            "elapsed_history_hours": elapsed_history_hours,
            **_inventory(connection, [row["run_id"] for row in runs]),
        },
        "temporal_comparability": {
            "consecutive_runs": consecutive_reports,
            "comparable_pairs": sum(item["comparable_pairs"] for item in consecutive_reports),
            "price_observable_pairs": sum(item["price_observable_pairs"] for item in consecutive_reports),
            "unchanged_pairs": sum(item["unchanged_pairs"] for item in consecutive_reports),
            "price_increases": sum(item["price_increases"] for item in consecutive_reports),
            "price_decreases": sum(item["price_decreases"] for item in consecutive_reports),
            "availability_transitions": sum(item["availability_transitions"] for item in consecutive_reports),
            "unknown_not_checkable_transitions": sum(item["unknown_not_checkable_transitions"] for item in consecutive_reports),
        },
        "route_readiness": {
            "expected_route_count": len(route_basket),
            "routes": route_readiness,
        },
        "lead_time_readiness": lead_readiness,
        "national_readiness": {
            "expected_route_count": len(route_basket),
            "usable_route_count": len(usable_route_ids),
            "represented_weight_pct": represented_weight,
            "total_basket_weight_pct": total_weight,
            "coverage_pct": coverage_pct,
            "status": national_status,
            "index": None,
        },
        "fare_state": fare_state,
        "status": status,
    }


def print_report(report: Mapping[str, Any]) -> None:
    print("APIx REAL DATABASE INDEX DIAGNOSTIC")
    print("Mode:", report["database"]["mode"])
    print("Database:", report["database"]["path"])
    print("Status:", report["status"])
    print("Collection history:", report["collection_history"])
    print("Temporal comparability:", report["temporal_comparability"])
    print("Route readiness:", report["route_readiness"])
    print("Lead-time readiness:", report["lead_time_readiness"])
    print("National readiness:", report["national_readiness"])
    print("Fare-State context:", report["fare_state"])
    print("No index values were persisted or fabricated.")


def main() -> None:
    connection = sqlite3.connect(
        f"file:{DB_PATH.as_posix()}?mode=ro",
        uri=True,
    )
    connection.row_factory = sqlite3.Row
    try:
        print_report(
            diagnose_database(
                connection,
                load_route_basket(),
                str(DB_PATH),
            )
        )
    finally:
        connection.close()


if __name__ == "__main__":
    main()

from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path
from typing import Any

from run_transition_readiness import (
    get_latest_two_successful_runs,
    load_observations,
)
from transition_analytics import analyze_transitions
from transition_readiness import match_repeated_snapshots
from transition_store import persist_snapshots, persist_transitions


BACKEND_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BACKEND_DIR / "data" / "apix.db"


def _observation_mapping(observation) -> dict[str, Any]:
    return {
        "observation_id": observation.observation_id,
        "run_id": observation.run_id,
        "route_id": observation.route_id,
        "source": observation.source,
        "search_timestamp": observation.search_timestamp,
        "target_lead_days": observation.target_lead_days,
        "origin": observation.origin,
        "destination": observation.destination,
        "departure_datetime": observation.departure_datetime,
        "flight_id": observation.flight_id,
        "journey_id": observation.journey_id,
        "flight_number": observation.flight_number,
        "carrier_code": observation.carrier_code,
        "fare_product_class": observation.fare_product_class,
        "fare_class": observation.fare_class,
        "fare_family": observation.fare_family,
        "total_fare": observation.total_fare,
        "is_sold": observation.is_sold,
    }


def _matched_pairs(previous, current):
    result = match_repeated_snapshots(previous, current)
    previous_by_id = {
        observation.observation_id: observation
        for observation in previous
    }
    current_by_id = {
        observation.observation_id: observation
        for observation in current
    }
    return [
        (
            previous_by_id[item["old_observation_id"]],
            current_by_id[item["new_observation_id"]],
        )
        for item in result["comparisons"]
    ]


def run_fare_state(
    connection: sqlite3.Connection,
    previous_run_id: str,
    current_run_id: str,
) -> dict[str, Any]:
    """Run snapshot, transition, and analytics stages for two runs."""
    if previous_run_id == current_run_id:
        raise ValueError("Previous and current run IDs must differ.")

    previous_observations = load_observations(connection, previous_run_id)
    current_observations = load_observations(connection, current_run_id)

    snapshots_inserted = persist_snapshots(
        connection,
        [
            _observation_mapping(observation)
            for observation in previous_observations + current_observations
        ],
    )

    pairs = _matched_pairs(previous_observations, current_observations)
    transitions_inserted = persist_transitions(connection, pairs)
    analytics = analyze_transitions(connection)

    return {
        "previous_run_id": previous_run_id,
        "current_run_id": current_run_id,
        "snapshots_inserted": snapshots_inserted,
        "transitions_inserted": transitions_inserted,
        "matched_pairs": len(pairs),
        "analytics": analytics,
    }


def run_latest(connection: sqlite3.Connection) -> dict[str, Any]:
    previous, current = get_latest_two_successful_runs(connection)
    return run_fare_state(
        connection,
        previous["run_id"],
        current["run_id"],
    )


def _print_report(report: dict[str, Any]) -> None:
    analytics = report["analytics"]
    counts = analytics["transition_counts"]
    print("FARE-STATE ORCHESTRATION REPORT")
    print(f"Previous run       : {report['previous_run_id']}")
    print(f"Current run        : {report['current_run_id']}")
    print(f"Snapshots inserted : {report['snapshots_inserted']}")
    print(f"Transitions inserted: {report['transitions_inserted']}")
    print(f"Total transitions  : {analytics['overall']['total_transitions']}")
    print(f"Unchanged           : {counts.get('UNCHANGED', 0)}")
    print(f"Price increases     : {counts.get('PRICE_INCREASE', 0)}")
    print(f"Price decreases     : {counts.get('PRICE_DECREASE', 0)}")
    print(
        "Availability changes: "
        f"{counts.get('BECAME_UNAVAILABLE', 0) + counts.get('BECAME_AVAILABLE', 0)}"
    )
    print(f"FEP                 : {analytics['fep']['percentage']}")
    for name, key in (
        ("FEP by source", "by_source"),
        ("FEP by route", "by_route"),
        ("FEP by lead time", "by_lead_time"),
    ):
        print(name + ":")
        for item in analytics[key]:
            print(f"  {item} ")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--previous-run")
    parser.add_argument("--current-run")
    args = parser.parse_args()

    if bool(args.previous_run) != bool(args.current_run):
        parser.error("--previous-run and --current-run must be provided together")

    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    try:
        if args.previous_run:
            report = run_fare_state(
                connection,
                args.previous_run,
                args.current_run,
            )
        else:
            report = run_latest(connection)
        _print_report(report)
    finally:
        connection.close()


if __name__ == "__main__":
    main()
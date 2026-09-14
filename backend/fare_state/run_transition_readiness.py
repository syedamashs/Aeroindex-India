from __future__ import annotations

import sqlite3
from pathlib import Path
import sys

from transition_readiness import (
    Observation,
    match_repeated_snapshots,
    summarize_comparisons,
)


BACKEND_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BACKEND_DIR / "data" / "apix.db"


def get_connection():
    connection = sqlite3.connect(
        DB_PATH,
        uri=False,
    )
    connection.row_factory = sqlite3.Row
    return connection


def get_latest_two_successful_runs(connection):
    query = """
        SELECT
            run_id,
            started_at,
            completed_at,
            status,
            total_tasks,
            successful_tasks,
            failed_tasks
        FROM collection_runs
        WHERE status = 'SUCCESS'
        ORDER BY COALESCE(completed_at, started_at) DESC
        LIMIT 2
    """

    rows = connection.execute(query).fetchall()

    if len(rows) < 2:
        raise RuntimeError(
            "Need at least two successful collection runs."
        )

    # Newest first from SQL.
    newest = rows[0]
    previous = rows[1]

    return previous, newest


def load_observations(connection, run_id):
    query = """
        SELECT
            observation_id,
            run_id,
            source,
            origin,
            destination,
            departure_datetime,
            arrival_datetime,
            flight_number,
            carrier_code,
            flight_id,
            journey_id,
            fare_product_class,
            fare_class,
            fare_family,
            fare_availability_key,
            source_offer_id,
            total_fare,
            is_sold,
            passenger_type,
            search_timestamp,
            target_lead_days,
            route_id
        FROM apix_observations
        WHERE run_id = ?
        ORDER BY
            source,
            target_lead_days,
            departure_datetime,
            flight_number,
            fare_family,
            observation_id
    """

    rows = connection.execute(
        query,
        (run_id,),
    ).fetchall()

    observations = []

    for row in rows:
        observations.append(
            Observation(
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
                fare_availability_key=row[
                    "fare_availability_key"
                ],
                source_offer_id=row["source_offer_id"],
                total_fare=row["total_fare"],
                is_sold=row["is_sold"],
                passenger_type=row["passenger_type"],
                search_timestamp=row["search_timestamp"],
                target_lead_days=row["target_lead_days"],
                route_id=row["route_id"],
            )
        )

    return observations


def print_run(label, run):
    print(
        f"{label}: {run['run_id']} | "
        f"status={run['status']} | "
        f"tasks={run['successful_tasks']}/"
        f"{run['total_tasks']} | "
        f"completed={run['completed_at']}"
    )


def main():
    print("=" * 68)
    print("FARE-STATE TRANSITION READINESS DIAGNOSTIC")
    print("=" * 68)

    print(f"Database: {DB_PATH}")
    print("Mode    : READ ONLY")
    print()

    if not DB_PATH.exists():
        raise FileNotFoundError(
            f"Database not found: {DB_PATH}"
        )

    connection = get_connection()

    try:
        previous_run, newest_run = (
            get_latest_two_successful_runs(connection)
        )

        print_run("Previous run", previous_run)
        print_run("Newest run  ", newest_run)
        print()

        old_observations = load_observations(
            connection,
            previous_run["run_id"],
        )

        new_observations = load_observations(
            connection,
            newest_run["run_id"],
        )

        print(
            f"Previous observations : "
            f"{len(old_observations)}"
        )

        print(
            f"Newest observations   : "
            f"{len(new_observations)}"
        )

        print()

        result = match_repeated_snapshots(
            old_observations,
            new_observations,
        )

        summary = summarize_comparisons(
            result["comparisons"]
        )

        print("-" * 68)
        print("MATCHING RESULT")
        print("-" * 68)

        print(
            f"Comparable matched pairs : "
            f"{result['matched_count']}"
        )

        print(
            f"Previous unmatched       : "
            f"{result['old_unmatched_count']}"
        )

        print(
            f"Newest unmatched         : "
            f"{result['new_unmatched_count']}"
        )

        print()
        print("-" * 68)
        print("PRICE MOVEMENT AMONG MATCHED PAIRS")
        print("-" * 68)

        print(
            f"Unchanged                : "
            f"{summary['unchanged']}"
        )

        print(
            f"Price increases          : "
            f"{summary['price_increase']}"
        )

        print(
            f"Price decreases          : "
            f"{summary['price_decrease']}"
        )

        print(
            f"Price not checkable      : "
            f"{summary['price_not_checkable']}"
        )

        print()

        # Lead-time breakdown.
        by_lead = {}

        for comparison in result["comparisons"]:
            # The comparison itself is based on the same fare identity.
            # Lead time is read from the source observations in a
            # separate query below, so we don't infer it here.
            pass

        lead_query = """
            SELECT
                target_lead_days,
                COUNT(*) AS observation_count
            FROM apix_observations
            WHERE run_id IN (?, ?)
            GROUP BY target_lead_days
            ORDER BY target_lead_days
        """

        lead_rows = connection.execute(
            lead_query,
            (
                previous_run["run_id"],
                newest_run["run_id"],
            ),
        ).fetchall()

        print("-" * 68)
        print("LEAD-TIME COVERAGE IN THE TWO RUNS")
        print("-" * 68)

        for row in lead_rows:
            print(
                f"T+{row['target_lead_days']}: "
                f"{row['observation_count']} observations"
            )

        print()

        print("-" * 68)
        print("INTERPRETATION")
        print("-" * 68)

        if result["matched_count"] == 0:
            print(
                "NO COMPARABLE REPEATED SNAPSHOTS FOUND."
            )
            print(
                "The transition engine should not yet "
                "calculate real transitions."
            )

        else:
            print(
                "Comparable repeated snapshots exist."
            )
            print(
                "The data is now sufficient to begin "
                "transition analysis."
            )

        print()
        print(
            "DATABASE WAS READ ONLY — "
            "NO RECORDS WERE MODIFIED"
        )

    finally:
        connection.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print()
        print("DIAGNOSTIC FAILED")
        print(f"Reason: {exc}")
        sys.exit(1)
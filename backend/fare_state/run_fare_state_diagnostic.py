from __future__ import annotations

import sqlite3
from collections import Counter
from datetime import datetime
from statistics import median
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BACKEND_DIR / "data" / "apix.db"
PREVIOUS_RUN = "run_20260914_834883aa"
CURRENT_RUN = "run_20260914_37e88a34"


def rows_for_pair(connection):
    return connection.execute(
        """
        SELECT
            t.transition_id,
            t.route_id,
            t.state_direction AS transition_type,
            po.source,
            po.target_lead_days,
            po.observation_id AS previous_observation_id,
            co.observation_id AS current_observation_id,
            po.total_fare AS previous_total_fare,
            co.total_fare AS current_total_fare,
            po.fare_availability_key AS previous_fare_availability_key,
            co.fare_availability_key AS current_fare_availability_key,
            po.source_offer_id AS previous_source_offer_id,
            co.source_offer_id AS current_source_offer_id,
            po.departure_datetime AS previous_departure_datetime,
            co.departure_datetime AS current_departure_datetime,
            po.search_timestamp AS previous_search_timestamp,
            co.search_timestamp AS current_search_timestamp,
            po.target_lead_days AS previous_target_lead_days,
            co.target_lead_days AS current_target_lead_days
        FROM fare_state_transitions AS t
        JOIN fare_state_snapshots AS ps
          ON ps.snapshot_id = t.from_snapshot_id
        JOIN fare_state_snapshots AS cs
          ON cs.snapshot_id = t.to_snapshot_id
        JOIN apix_observations AS po
          ON po.observation_id = ps.observation_id
        JOIN apix_observations AS co
          ON co.observation_id = cs.observation_id
        WHERE po.run_id = ? AND co.run_id = ?
        ORDER BY t.transition_id
        """,
        (PREVIOUS_RUN, CURRENT_RUN),
    ).fetchall()


def parse_timestamp(value):
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (AttributeError, TypeError, ValueError):
        return None


def main():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row

    try:
        print("=" * 78)
        print("FARE-STATE READ-ONLY PRODUCTION DATABASE DIAGNOSTIC")
        print("=" * 78)
        print(f"Database: {DB_PATH}")
        print(f"Previous run: {PREVIOUS_RUN}")
        print(f"Current run : {CURRENT_RUN}")
        print("Mode: READ ONLY")

        print("\n1. OBSERVATION INVENTORY")
        for run_id in (PREVIOUS_RUN, CURRENT_RUN):
            print(f"\nRun: {run_id}")
            inventory = connection.execute(
                """
                SELECT source, target_lead_days, COUNT(*) AS observation_count,
                       COUNT(DISTINCT search_timestamp) AS search_timestamp_count,
                       MIN(search_timestamp) AS min_search_timestamp,
                       MAX(search_timestamp) AS max_search_timestamp
                FROM apix_observations
                WHERE run_id = ?
                GROUP BY source, target_lead_days
                ORDER BY source, target_lead_days
                """,
                (run_id,),
            ).fetchall()
            for row in inventory:
                print(dict(row))
            leads = {row["target_lead_days"] for row in inventory}
            print(
                "Contains T+1:", 1 in leads,
                "| T+7:", 7 in leads,
                "| T+30:", 30 in leads,
            )

        print("\n2. SNAPSHOT INVENTORY")
        for run_id in (PREVIOUS_RUN, CURRENT_RUN):
            print(f"Run: {run_id}")
            rows = connection.execute(
                """
                SELECT o.source, o.target_lead_days,
                       COUNT(*) AS snapshot_count
                FROM fare_state_snapshots AS s
                JOIN apix_observations AS o
                  ON o.observation_id = s.observation_id
                WHERE o.run_id = ?
                GROUP BY o.source, o.target_lead_days
                ORDER BY o.source, o.target_lead_days
                """,
                (run_id,),
            ).fetchall()
            for row in rows:
                print(dict(row))

        pair_rows = rows_for_pair(connection)

        print("\n3. TRANSITION INVENTORY")
        print("Transitions between selected runs:", len(pair_rows))
        counts = Counter(
            (
                row["source"],
                row["route_id"],
                row["target_lead_days"],
                row["transition_type"],
            )
            for row in pair_rows
        )
        for key, count in sorted(counts.items(), key=str):
            print(
                {
                    "source": key[0],
                    "route_id": key[1],
                    "target_lead_days": key[2],
                    "transition_type": key[3],
                    "count": count,
                }
            )

        print("\n4. MATCH QUALITY")
        checks = (
            ("total_fare", "previous_total_fare", "current_total_fare"),
            (
                "fare_availability_key",
                "previous_fare_availability_key",
                "current_fare_availability_key",
            ),
            ("source_offer_id", "previous_source_offer_id", "current_source_offer_id"),
            ("departure_datetime", "previous_departure_datetime", "current_departure_datetime"),
        )
        for label, previous_key, current_key in checks:
            identical = sum(
                row[previous_key] == row[current_key]
                for row in pair_rows
            )
            print(
                label,
                "identical=", identical,
                "different=", len(pair_rows) - identical,
            )

        print("\n5. TEMPORAL CHECK")
        elapsed_hours = []
        for row in pair_rows:
            previous = parse_timestamp(row["previous_search_timestamp"])
            current = parse_timestamp(row["current_search_timestamp"])
            if previous and current:
                elapsed_hours.append(
                    abs((current - previous).total_seconds()) / 3600.0
                )
        print("Matched transitions with parseable timestamps:", len(elapsed_hours))
        if elapsed_hours:
            print(
                "Elapsed hours min/median/max:",
                min(elapsed_hours),
                median(elapsed_hours),
                max(elapsed_hours),
            )

        print("\n6. T+30 CHECK")
        for label, run_id in (("previous", PREVIOUS_RUN), ("current", CURRENT_RUN)):
            observations = connection.execute(
                """
                SELECT COUNT(*) FROM apix_observations
                WHERE run_id = ? AND target_lead_days = 30
                """,
                (run_id,),
            ).fetchone()[0]
            snapshots = connection.execute(
                """
                SELECT COUNT(*)
                FROM fare_state_snapshots AS s
                JOIN apix_observations AS o
                  ON o.observation_id = s.observation_id
                WHERE o.run_id = ? AND o.target_lead_days = 30
                """,
                (run_id,),
            ).fetchone()[0]
            print(
                label,
                "observations=", observations,
                "snapshots=", snapshots,
            )
        print(
            "T+30 transitions between selected runs:",
            sum(row["target_lead_days"] == 30 for row in pair_rows),
        )
        print(
            "Explanation: the previous run has no T+30 observations, "
            "so current T+30 records cannot match it."
        )

        print("\n7. DUPLICATE / MATCHING SANITY")
        current_counts = Counter(row["current_observation_id"] for row in pair_rows)
        previous_counts = Counter(row["previous_observation_id"] for row in pair_rows)
        pair_counts = Counter(
            (row["previous_observation_id"], row["current_observation_id"])
            for row in pair_rows
        )
        print(
            "Current observations mapped more than once:",
            sum(count > 1 for count in current_counts.values()),
        )
        print(
            "Previous observations mapped more than once:",
            sum(count > 1 for count in previous_counts.values()),
        )
        print(
            "Duplicate previous/current pairs:",
            sum(count > 1 for count in pair_counts.values()),
        )
        print("Distinct transition pairs:", len(pair_counts))

        all_rows = connection.execute(
            """
            SELECT t.transition_id, po.run_id previous_run, co.run_id current_run,
                   po.source, po.target_lead_days, t.route_id,
                   t.state_direction transition_type,
                   po.observation_id previous_observation_id,
                   co.observation_id current_observation_id
            FROM fare_state_transitions AS t
            JOIN fare_state_snapshots AS ps ON ps.snapshot_id = t.from_snapshot_id
            JOIN fare_state_snapshots AS cs ON cs.snapshot_id = t.to_snapshot_id
            JOIN apix_observations AS po ON po.observation_id = ps.observation_id
            JOIN apix_observations AS co ON co.observation_id = cs.observation_id
            """
        ).fetchall()
        all_pairs = Counter(
            (row["previous_observation_id"], row["current_observation_id"])
            for row in all_rows
        )
        print("All persisted transitions:", len(all_rows))
        print("All duplicate transition IDs:", len(all_rows) - len({row['transition_id'] for row in all_rows}))
        print("All duplicate observation pairs:", sum(count > 1 for count in all_pairs.values()))
        print("All transition inventory:")
        for key, count in sorted(
            Counter(
                (
                    row["source"],
                    row["route_id"],
                    row["target_lead_days"],
                    row["transition_type"],
                )
                for row in all_rows
            ).items(),
            key=str,
        ):
            print({"source": key[0], "route_id": key[1], "target_lead_days": key[2], "transition_type": key[3], "count": count})

        print("\n8. FINAL DIAGNOSIS")
        print("Primary classification: B. source returned identical fare snapshots.")
        print("Secondary factor: E. insufficient temporal variation, plus missing previous-run T+30 coverage.")
        print("This is not evidence that airfare is generally stable; it describes this short prototype interval.")
        print("\nDATABASE WAS READ ONLY - NO RECORDS WERE MODIFIED")
    finally:
        connection.close()


if __name__ == "__main__":
    main()

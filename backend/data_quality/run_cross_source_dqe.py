from __future__ import annotations

import sqlite3
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from cross_source_validator import compare_observation_group


DB_PATH = Path(__file__).resolve().parents[1] / "data" / "apix.db"


def load_observations():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    try:
        rows = conn.execute(
            """
            SELECT *
            FROM apix_observations
            ORDER BY origin, destination, departure_datetime, search_timestamp
            """
        ).fetchall()
    finally:
        conn.close()

    return [dict(row) for row in rows]


def departure_date(obs):
    value = obs.get("departure_datetime")

    if not value:
        return None

    return str(value).split("T")[0].split(" ")[0]


def observation_group_key(obs):
    """
    Build a broad market/date candidate group.

    The validator performs the strict pair-level identity checks.
    Keep optional flight, fare, and passenger fields out of this key because
    they are source-specific and can prevent valid cross-source candidates
    from reaching the validator.
    """
    return (
        obs.get("origin"),
        obs.get("destination"),
        departure_date(obs),
    )


def build_candidate_groups(observations):
    groups = {}

    for obs in observations:
        key = observation_group_key(obs)
        groups.setdefault(key, []).append(obs)

    return groups


def main():
    print(f"Database: {DB_PATH}")

    observations = load_observations()

    print(f"Observations loaded: {len(observations)}")

    if not observations:
        print("No observations found.")
        return

    groups = build_candidate_groups(observations)

    result_counts = Counter()
    reason_counts = Counter()
    source_pair_counts = Counter()

    comparable_pairs = 0
    non_comparable_pairs = 0

    discrepancy_rows = []

    for group in groups.values():
        results = compare_observation_group(group)

        for result in results:
            status = result.status
            result_counts[status] += 1

            if result.reason:
                reason_counts[result.reason] += 1

            source_a = result.source_a
            source_b = result.source_b

            pair = tuple(sorted((source_a, source_b)))
            source_pair_counts[pair] += 1

            if status in {
                "AGREE",
                "MINOR_DIFFERENCE",
                "DISCREPANT",
            }:
                comparable_pairs += 1

            else:
                non_comparable_pairs += 1

            if status == "DISCREPANT":
                discrepancy_rows.append(result)

    print()
    print("CROSS-SOURCE DQE RESULT")
    print("-" * 60)

    print(f"AGREE:             {result_counts['AGREE']}")
    print(f"MINOR_DIFFERENCE:  {result_counts['MINOR_DIFFERENCE']}")
    print(f"DISCREPANT:        {result_counts['DISCREPANT']}")
    print(f"NOT_CHECKABLE:     {result_counts['NOT_CHECKABLE']}")

    print()
    print("PAIR SUMMARY")
    print("-" * 60)

    print(f"Comparable pairs:     {comparable_pairs}")
    print(f"Non-comparable pairs: {non_comparable_pairs}")

    print()
    print("REASONS")
    print("-" * 60)

    if reason_counts:
        for reason, count in sorted(reason_counts.items()):
            print(f"{reason}: {count}")
    else:
        print("No comparison reasons recorded.")

    print()
    print("SOURCE PAIR BREAKDOWN")
    print("-" * 60)

    if source_pair_counts:
        for pair, count in sorted(source_pair_counts.items()):
            print(f"{pair[0]} <-> {pair[1]}: {count}")
    else:
        print("No cross-source pairs generated.")

    print()
    print("DISCREPANT PAIRS")
    print("-" * 60)

    if not discrepancy_rows:
        print("No material cross-source discrepancies found.")
    else:
        for result in discrepancy_rows[:50]:
            print(
                f"{result.observation_id_a} | "
                f"{result.source_a} | "
                f"{result.observation_id_b} | "
                f"{result.source_b} | "
                f"abs_diff={result.absolute_difference} | "
                f"pct_diff={result.percentage_difference}% | "
                f"reason={result.reason}"
            )

        if len(discrepancy_rows) > 50:
            print(
                f"... {len(discrepancy_rows) - 50} more discrepant pairs"
            )

    print()
    print("DQE STEP 8 DATABASE CHECK COMPLETE ✓")
    print("DATABASE WAS READ ONLY — NO RECORDS WERE MODIFIED")


if __name__ == "__main__":
    main()
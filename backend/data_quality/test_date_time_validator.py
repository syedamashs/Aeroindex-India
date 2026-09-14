from __future__ import annotations

import sqlite3
from pathlib import Path
from collections import Counter

from date_time_validator import validate_observations


DB_PATH = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "apix.db"
)


def load_observations():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row

    try:
        cursor = connection.execute(
            "SELECT * FROM apix_observations"
        )

        return [
            dict(row)
            for row in cursor.fetchall()
        ]

    finally:
        connection.close()


def main():
    observations = load_observations()

    print("=" * 60)
    print("APIx DATE/TIME VALIDATION")
    print("=" * 60)

    print(f"Observations loaded: {len(observations)}")
    print()

    results = validate_observations(observations)

    counts = Counter(
        result["status"]
        for result in results
    )

    valid = counts.get("VALID", 0)
    warnings = counts.get("VALID_WITH_WARNINGS", 0)
    invalid = counts.get("INVALID", 0)

    print(f"Valid:                 {valid}")
    print(f"Valid with warnings:   {warnings}")
    print(f"Invalid:               {invalid}")
    print()

    # ---------------------------------------------------------
    # Show invalid observations
    # ---------------------------------------------------------

    if invalid:

        print("=" * 60)
        print("INVALID DATE/TIME OBSERVATIONS")
        print("=" * 60)

        shown = 0

        for result in results:

            if result["status"] != "INVALID":
                continue

            print()
            print(
                f"Observation #{result['observation_id']}"
            )

            print(
                f"Errors: {result['errors']}"
            )

            shown += 1

            if shown >= 20:
                print()
                print("Showing first 20 invalid observations.")
                break

    # ---------------------------------------------------------
    # Show warnings summary
    # ---------------------------------------------------------

    warning_types = Counter()

    for result in results:
        for warning in result["warnings"]:
            warning_types[warning] += 1

    if warning_types:

        print()
        print("=" * 60)
        print("DATE/TIME WARNING SUMMARY")
        print("=" * 60)

        for warning, count in warning_types.most_common():
            print(f"{warning}: {count}")

    # ---------------------------------------------------------
    # Final result
    # ---------------------------------------------------------

    print()
    print("=" * 60)

    if invalid == 0:
        print("DATE/TIME VALIDATION PASSED ✓")
    else:
        print("DATE/TIME VALIDATION FOUND ISSUES ⚠")

    print("=" * 60)


if __name__ == "__main__":
    main()
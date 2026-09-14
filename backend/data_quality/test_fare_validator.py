from __future__ import annotations

import sqlite3
from pathlib import Path
from collections import Counter

from fare_validator import validate_observations


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
    print("APIx FARE ARITHMETIC VALIDATION")
    print("=" * 60)

    print(f"Observations loaded: {len(observations)}")
    print()

    results = validate_observations(observations)

    counts = Counter(
        result["status"]
        for result in results
    )

    valid = counts.get("VALID", 0)
    valid_tolerance = counts.get("VALID_WITH_TOLERANCE", 0)
    not_checkable = counts.get("NOT_CHECKABLE", 0)
    invalid = counts.get("INVALID_ARITHMETIC", 0)

    print(f"Valid:                 {valid}")
    print(f"Valid with tolerance:  {valid_tolerance}")
    print(f"Not checkable:         {not_checkable}")
    print(f"Invalid arithmetic:    {invalid}")
    print()

    if invalid:
        print("=" * 60)
        print("INVALID ARITHMETIC OBSERVATIONS")
        print("=" * 60)

        shown = 0

        for result in results:
            if result["status"] != "INVALID_ARITHMETIC":
                continue

            print()
            print(
                f"Observation #{result['observation_id']}"
            )
            print(
                f"Expected total: {result['expected_total']}"
            )
            print(
                f"Actual total:   {result['actual_total']}"
            )
            print(
                f"Difference:     {result['difference']}"
            )
            print(
                f"Errors:         {result['errors']}"
            )

            shown += 1

            if shown >= 20:
                print()
                print("Showing first 20 invalid observations.")
                break

    print()
    print("=" * 60)

    if invalid == 0:
        print("FARE ARITHMETIC VALIDATION PASSED ✓")
    else:
        print("FARE ARITHMETIC VALIDATION FOUND ISSUES ⚠")

    print("=" * 60)


if __name__ == "__main__":
    main()
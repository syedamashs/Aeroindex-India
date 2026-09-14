"""
Test the APIx stored observation schema validator.
"""

import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from database.connection import get_connection
from data_quality.schema_validator import validate_observations


def load_observations():
    conn = get_connection()

    try:
        cursor = conn.execute(
            "SELECT * FROM apix_observations"
        )

        columns = [column[0] for column in cursor.description]
        rows = cursor.fetchall()

        return [
            dict(zip(columns, row))
            for row in rows
        ]

    finally:
        conn.close()


def main():
    observations = load_observations()

    print("=" * 60)
    print("APIx DATA QUALITY — SCHEMA VALIDATION")
    print("=" * 60)

    print(f"Observations loaded: {len(observations)}")

    results = validate_observations(observations)

    valid = sum(
        result["validation_status"] == "VALID"
        for result in results
    )

    warnings = sum(
        result["validation_status"] == "VALID_WITH_WARNINGS"
        for result in results
    )

    invalid = sum(
        result["validation_status"] == "INVALID"
        for result in results
    )

    print(f"Fully valid:          {valid}")
    print(f"Valid with warnings:  {warnings}")
    print(f"Invalid:              {invalid}")

    if warnings or invalid:
        print("\nValidation problems:")

        for index, result in enumerate(results):
            if result["validation_status"] != "VALID":
                print(f"\nObservation #{index + 1}")

                print(
                    f"  Status: {result['validation_status']}\n"
                    f"  Errors: {result['errors']}\n"
                    f"  Warnings: {result['warnings']}"
                )

    print("\n" + "=" * 60)

    if invalid == 0:
        print("SCHEMA VALIDATION PASSED ✓")
    else:
        print("SCHEMA VALIDATION FOUND ISSUES ⚠")

    print("=" * 60)


if __name__ == "__main__":
    main()
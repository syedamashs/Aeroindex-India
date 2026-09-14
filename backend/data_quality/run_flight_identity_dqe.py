from __future__ import annotations

import sqlite3
from pathlib import Path
from collections import Counter

from flight_identity_validator import validate_observation


# ---------------------------------------------------------
# Database location
# ---------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "data" / "apix.db"


# ---------------------------------------------------------
# Load observations
# ---------------------------------------------------------
def load_observations() -> list[dict]:
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Database not found: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    try:
        cursor = conn.execute(
            "SELECT * FROM apix_observations"
        )

        rows = cursor.fetchall()

        return [dict(row) for row in rows]

    finally:
        conn.close()


# ---------------------------------------------------------
# Main DQE analysis
# ---------------------------------------------------------
def main():
    print("=" * 70)
    print("DQE STEP 4 — FLIGHT / JOURNEY IDENTITY VALIDATION")
    print("=" * 70)
    print()

    print(f"Database: {DB_PATH}")
    print()

    observations = load_observations()

    print(f"Observations loaded: {len(observations)}")
    print()

    results = []

    error_counts = Counter()
    warning_counts = Counter()

    for observation in observations:
        result = validate_observation(observation)

        results.append(result)

        for error in result.errors:
            error_counts[error] += 1

        for warning in result.warnings:
            warning_counts[warning] += 1

    # -----------------------------------------------------
    # Status summary
    # -----------------------------------------------------
    valid = sum(
        1 for result in results
        if result.status == "VALID"
    )

    valid_with_warnings = sum(
        1 for result in results
        if result.status == "VALID_WITH_WARNINGS"
    )

    invalid = sum(
        1 for result in results
        if result.status == "INVALID"
    )

    print("-" * 70)
    print("OVERALL STATUS")
    print("-" * 70)

    print(f"VALID:                {valid}")
    print(f"VALID_WITH_WARNINGS:  {valid_with_warnings}")
    print(f"INVALID:              {invalid}")

    print()

    # -----------------------------------------------------
    # Errors
    # -----------------------------------------------------
    print("-" * 70)
    print("IDENTITY ERRORS")
    print("-" * 70)

    if error_counts:
        for name, count in error_counts.most_common():
            print(f"{name}: {count}")
    else:
        print("No identity errors found.")

    print()

    # -----------------------------------------------------
    # Warnings
    # -----------------------------------------------------
    print("-" * 70)
    print("IDENTITY WARNINGS")
    print("-" * 70)

    if warning_counts:
        for name, count in warning_counts.most_common():
            print(f"{name}: {count}")
    else:
        print("No identity warnings found.")

    print()

    # -----------------------------------------------------
    # Source-level breakdown
    # -----------------------------------------------------
    print("-" * 70)
    print("SOURCE BREAKDOWN")
    print("-" * 70)

    source_stats = {}

    for observation, result in zip(observations, results):
        source = observation.get("source") or "UNKNOWN"

        if source not in source_stats:
            source_stats[source] = Counter()

        source_stats[source][result.status] += 1

    for source, stats in sorted(source_stats.items()):
        print(f"\n{source}")
        print(f"  VALID:               {stats['VALID']}")
        print(
            f"  VALID_WITH_WARNINGS: "
            f"{stats['VALID_WITH_WARNINGS']}"
        )
        print(f"  INVALID:             {stats['INVALID']}")

    print()

    # -----------------------------------------------------
    # Route-level breakdown
    # -----------------------------------------------------
    print("-" * 70)
    print("ROUTE BREAKDOWN")
    print("-" * 70)

    route_stats = {}

    for observation, result in zip(observations, results):
        origin = observation.get("origin") or "?"
        destination = observation.get("destination") or "?"

        route = f"{origin} -> {destination}"

        if route not in route_stats:
            route_stats[route] = Counter()

        route_stats[route][result.status] += 1

    for route, stats in sorted(route_stats.items()):
        print(
            f"{route}: "
            f"valid={stats['VALID']}, "
            f"warnings={stats['VALID_WITH_WARNINGS']}, "
            f"invalid={stats['INVALID']}"
        )

    print()

    print("=" * 70)
    print("DQE STEP 4 DATABASE CHECK COMPLETE ✓")
    print("DATABASE WAS READ ONLY — NO RECORDS WERE MODIFIED")
    print("=" * 70)


if __name__ == "__main__":
    main()
from __future__ import annotations

import sqlite3
from pathlib import Path
from collections import Counter

from soldout_validator import validate_sold_out_status


# ---------------------------------------------------------
# Database location
# ---------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "data" / "apix.db"


# ---------------------------------------------------------
# Load real observations
# ---------------------------------------------------------
def load_observations() -> list[dict]:
    if not DB_PATH.exists():
        raise FileNotFoundError(
            f"Database not found: {DB_PATH}"
        )

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    try:
        rows = conn.execute(
            "SELECT * FROM apix_observations"
        ).fetchall()

        return [dict(row) for row in rows]

    finally:
        conn.close()


# ---------------------------------------------------------
# Main DQE analysis
# ---------------------------------------------------------
def main():
    print("=" * 70)
    print("DQE STEP 6 — SOLD-OUT / UNAVAILABLE FARE HANDLING")
    print("=" * 70)
    print()

    print(f"Database: {DB_PATH}")
    print()

    observations = load_observations()

    print(
        f"Observations loaded: "
        f"{len(observations)}"
    )
    print()

    # -----------------------------------------------------
    # Validate every observation
    # -----------------------------------------------------
    results = [
        validate_sold_out_status(obs)
        for obs in observations
    ]

    status_counts = Counter(
        result.status
        for result in results
    )

    reason_counts = Counter(
        result.reason
        for result in results
        if result.reason
    )

    warning_counts = Counter(
        warning
        for result in results
        for warning in result.warnings
    )

    # -----------------------------------------------------
    # Overall status
    # -----------------------------------------------------
    print("-" * 70)
    print("OVERALL SOLD-OUT / AVAILABILITY STATUS")
    print("-" * 70)

    print(
        f"AVAILABLE:       "
        f"{status_counts['AVAILABLE']}"
    )

    print(
        f"SOLD_OUT:        "
        f"{status_counts['SOLD_OUT']}"
    )

    print(
        f"NOT_CHECKABLE:   "
        f"{status_counts['NOT_CHECKABLE']}"
    )

    print(
        f"INVALID:         "
        f"{status_counts['INVALID']}"
    )

    print()

    # -----------------------------------------------------
    # Reasons
    # -----------------------------------------------------
    print("-" * 70)
    print("CLASSIFICATION REASONS")
    print("-" * 70)

    if reason_counts:
        for reason, count in reason_counts.most_common():
            print(f"{reason}: {count}")
    else:
        print("No classification reasons found.")

    print()

    # -----------------------------------------------------
    # Warnings
    # -----------------------------------------------------
    print("-" * 70)
    print("WARNINGS")
    print("-" * 70)

    if warning_counts:
        for warning, count in warning_counts.most_common():
            print(f"{warning}: {count}")
    else:
        print("No sold-out/availability warnings found.")

    print()

    # -----------------------------------------------------
    # Source breakdown
    # -----------------------------------------------------
    print("-" * 70)
    print("SOURCE BREAKDOWN")
    print("-" * 70)

    source_stats = {}

    for observation, result in zip(
        observations,
        results,
    ):
        source = (
            str(observation.get("source") or "UNKNOWN")
            .strip()
            .casefold()
        )

        if source not in source_stats:
            source_stats[source] = Counter()

        source_stats[source][result.status] += 1

    for source, stats in sorted(source_stats.items()):
        print()
        print(source)

        print(
            f"  AVAILABLE:     "
            f"{stats['AVAILABLE']}"
        )

        print(
            f"  SOLD_OUT:      "
            f"{stats['SOLD_OUT']}"
        )

        print(
            f"  NOT_CHECKABLE: "
            f"{stats['NOT_CHECKABLE']}"
        )

        print(
            f"  INVALID:       "
            f"{stats['INVALID']}"
        )

    print()

    # -----------------------------------------------------
    # Actual invalid observations
    # -----------------------------------------------------
    invalid_results = [
        (obs, result)
        for obs, result in zip(
            observations,
            results,
        )
        if result.status == "INVALID"
    ]

    print("-" * 70)
    print("INVALID OBSERVATIONS")
    print("-" * 70)

    if not invalid_results:
        print("No invalid sold-out/availability observations found.")
    else:
        for observation, result in invalid_results[:50]:
            print(
                f"observation_id="
                f"{observation.get('observation_id')} | "
                f"source="
                f"{observation.get('source')} | "
                f"reason="
                f"{result.reason}"
            )

        if len(invalid_results) > 50:
            print()
            print(
                f"...and "
                f"{len(invalid_results) - 50} "
                f"more invalid observations."
            )

    print()

    # -----------------------------------------------------
    # Final status
    # -----------------------------------------------------
    print("=" * 70)
    print("DQE STEP 6 DATABASE CHECK COMPLETE ✓")
    print("DATABASE WAS READ ONLY — NO RECORDS WERE MODIFIED")
    print("=" * 70)


if __name__ == "__main__":
    main()
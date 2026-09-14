from __future__ import annotations

import sqlite3
from pathlib import Path

from duplicate_validator import (
    find_duplicates,
    summarize_by_source,
)


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
# Main
# ---------------------------------------------------------
def main():
    print("=" * 70)
    print("DQE STEP 5 — DUPLICATE DETECTION")
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
    # Run duplicate detection
    # -----------------------------------------------------
    result = find_duplicates(observations)

    print("-" * 70)
    print("OVERALL DUPLICATE RESULTS")
    print("-" * 70)

    print(
        f"Total observations: "
        f"{result['total_observations']}"
    )

    print(
        f"Unique observation keys: "
        f"{result['unique_keys']}"
    )

    print(
        f"Duplicate groups: "
        f"{result['duplicate_group_count']}"
    )

    print(
        f"Rows belonging to duplicate groups: "
        f"{result['duplicate_rows']}"
    )

    print(
        f"Extra duplicate rows: "
        f"{result['extra_duplicate_rows']}"
    )

    print()

    # -----------------------------------------------------
    # Duplicate groups
    # -----------------------------------------------------
    print("-" * 70)
    print("DUPLICATE GROUPS")
    print("-" * 70)

    groups = result["duplicate_groups"]

    if not groups:
        print("No exact duplicate groups found.")
    else:
        for number, group in enumerate(groups, start=1):
            print()
            print(f"Group {number}")
            print(f"Count: {group['count']}")
            print(
                "Observation IDs: "
                f"{group['observation_ids']}"
            )

    print()

    # -----------------------------------------------------
    # Source-level breakdown
    # -----------------------------------------------------
    print("-" * 70)
    print("SOURCE BREAKDOWN")
    print("-" * 70)

    source_summary = summarize_by_source(
        observations
    )

    for source, stats in sorted(
        source_summary.items()
    ):
        print()
        print(source)

        print(
            f"  Observations:       "
            f"{stats['observations']}"
        )

        print(
            f"  Unique keys:        "
            f"{stats['unique_keys']}"
        )

        print(
            f"  Duplicate groups:   "
            f"{stats['duplicate_groups']}"
        )

        print(
            f"  Duplicate rows:     "
            f"{stats['duplicate_rows']}"
        )

        print(
            f"  Extra duplicate rows:"
            f" {stats['extra_duplicate_rows']}"
        )

    print()

    # -----------------------------------------------------
    # Final status
    # -----------------------------------------------------
    print("=" * 70)
    print("DQE STEP 5 DATABASE CHECK COMPLETE ✓")
    print("DATABASE WAS READ ONLY — NO RECORDS WERE MODIFIED")
    print("=" * 70)


if __name__ == "__main__":
    main()
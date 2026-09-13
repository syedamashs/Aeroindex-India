from __future__ import annotations

import sqlite3
import sys
from pathlib import Path


# ============================================================
# PROJECT PATH
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


from database.connection import initialize_database, get_connection
from storage.observation_storage import (
    insert_observations,
)


# ============================================================
# TEST DATA
# ============================================================

def make_test_observation(
    source: str,
    observation_id: str,
) -> dict:

    return {
        "observation_id": observation_id,
        "source": source,
        "source_url": "https://example.com",
        "search_timestamp": "2026-09-13T18:00:00+05:30",
        "extraction_status": "success",
        "currency": "INR",

        "origin": "DEL",
        "destination": "BOM",

        "origin_city": "Delhi",
        "destination_city": "Mumbai",

        "departure_datetime": "2026-09-20T10:00:00+05:30",
        "arrival_datetime": "2026-09-20T12:15:00+05:30",

        "departure_utc": "2026-09-20T04:30:00+00:00",
        "arrival_utc": "2026-09-20T06:45:00+00:00",

        "duration_minutes": 135,

        "flight_number": "TEST123",
        "carrier_code": "TEST",

        "marketing_airline": source,
        "operating_airline": source,

        "flight_id": f"TEST-FLIGHT-{observation_id}",
        "journey_id": f"TEST-JOURNEY-{observation_id}",

        "aircraft_code": "320",

        "stops": 0,
        "flight_type": "NonStop",

        "departure_terminal": None,
        "arrival_terminal": None,

        "code_share_indicator": None,
        "schedule_service_type": None,

        "fare_product_class": "TEST",
        "fare_class": "Y",
        "fare_family": "TEST",

        "source_offer_id": f"TEST-OFFER-{observation_id}",
        "fare_availability_key": f"TEST-KEY-{observation_id}",

        "base_fare": 3000.0,
        "taxes": 500.0,
        "total_fees": 100.0,
        "total_fare": 3600.0,

        "is_cheapest_offer": 1,
        "is_sold": 0,
        "filling_fast": 0,

        "service_charges": None,

        "original_fare_amount": 3600.0,
        "original_published_amount": 3600.0,
        "original_total_discount": 0.0,

        "passenger_type": "ADT",

        "run_id": "TEST-RUN-001",
        "task_id": "TEST-TASK-001",
        "route_id": "DELHI_MUMBAI",

        "target_lead_days": 7,
        "actual_lead_days": 7,
    }


# ============================================================
# DATABASE SETUP
# ============================================================

def setup_test_database() -> None:

    initialize_database()

    with get_connection() as conn:

        # Required parent records
        conn.execute(
            """
            INSERT OR IGNORE INTO dgca_route_master (
                route_id,
                rank,
                city1,
                city2,
                route_traffic,
                route_weight_pct,
                cumulative_coverage_pct,
                source_document,
                source_year
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "DELHI_MUMBAI",
                1,
                "DELHI",
                "MUMBAI",
                6850869,
                4.1385,
                4.1385,
                "DGCA 2024-25",
                "2024-25",
            ),
        )

        conn.execute(
            """
            INSERT OR IGNORE INTO collection_runs (
                run_id,
                started_at,
                status,
                total_tasks
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                "TEST-RUN-001",
                "2026-09-13T18:00:00+05:30",
                "running",
                3,
            ),
        )

        for source in ("airindia", "indigo", "spicejet"):

            task_id = f"TEST-TASK-{source}"

            conn.execute(
                """
                INSERT OR IGNORE INTO collection_tasks (
                    task_id,
                    run_id,
                    route_id,
                    source,
                    origin,
                    destination,
                    departure_date,
                    target_lead_days,
                    actual_lead_days,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    task_id,
                    "TEST-RUN-001",
                    "DELHI_MUMBAI",
                    source,
                    "DEL",
                    "BOM",
                    "2026-09-20",
                    7,
                    7,
                    "success",
                ),
            )

        conn.commit()


# ============================================================
# TEST INSERTION
# ============================================================

def test_insert_airindia():

    observation = make_test_observation(
        "airindia",
        "TEST-AI-001",
    )

    observation["task_id"] = "TEST-TASK-airindia"

    inserted = insert_observations(
        [observation]
    )

    assert inserted == 1

    with get_connection() as conn:

        row = conn.execute(
            """
            SELECT *
            FROM apix_observations
            WHERE observation_id = ?
            """,
            ("TEST-AI-001",),
        ).fetchone()

        assert row is not None
        assert row["source"] == "airindia"
        assert row["origin"] == "DEL"
        assert row["destination"] == "BOM"
        assert row["total_fare"] == 3600.0


def test_insert_indigo():

    observation = make_test_observation(
        "indigo",
        "TEST-6E-001",
    )

    observation["task_id"] = "TEST-TASK-indigo"

    inserted = insert_observations(
        [observation]
    )

    assert inserted == 1

    with get_connection() as conn:

        row = conn.execute(
            """
            SELECT *
            FROM apix_observations
            WHERE observation_id = ?
            """,
            ("TEST-6E-001",),
        ).fetchone()

        assert row is not None
        assert row["source"] == "indigo"


def test_insert_spicejet():

    observation = make_test_observation(
        "spicejet",
        "TEST-SG-001",
    )

    observation["task_id"] = "TEST-TASK-spicejet"

    inserted = insert_observations(
        [observation]
    )

    assert inserted == 1

    with get_connection() as conn:

        row = conn.execute(
            """
            SELECT *
            FROM apix_observations
            WHERE observation_id = ?
            """,
            ("TEST-SG-001",),
        ).fetchone()

        assert row is not None
        assert row["source"] == "spicejet"


# ============================================================
# DUPLICATE TEST
# ============================================================

def test_duplicate_is_not_inserted():

    observation = make_test_observation(
        "airindia",
        "TEST-DUPLICATE-001",
    )

    observation["task_id"] = "TEST-TASK-airindia"

    first = insert_observations(
        [observation]
    )

    second = insert_observations(
        [observation]
    )

    assert first == 1
    assert second == 0

    with get_connection() as conn:

        count = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM apix_observations
            WHERE observation_id = ?
            """,
            ("TEST-DUPLICATE-001",),
        ).fetchone()["count"]

        assert count == 1


# ============================================================
# FINAL DATABASE CHECK
# ============================================================

def show_database_summary():

    with get_connection() as conn:

        observations = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM apix_observations
            """
        ).fetchone()["count"]

        print()
        print("=" * 60)
        print("APIx STORAGE TEST SUMMARY")
        print("=" * 60)
        print(f"Canonical observations: {observations}")

        rows = conn.execute(
            """
            SELECT
                source,
                COUNT(*) AS count
            FROM apix_observations
            GROUP BY source
            ORDER BY source
            """
        ).fetchall()

        for row in rows:
            print(
                f"{row['source']}: {row['count']}"
            )

        print("=" * 60)


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    print("=" * 60)
    print("APIx OBSERVATION STORAGE TEST")
    print("=" * 60)

    try:

        setup_test_database()

        test_insert_airindia()
        print("✓ Air India insertion")

        test_insert_indigo()
        print("✓ IndiGo insertion")

        test_insert_spicejet()
        print("✓ SpiceJet insertion")

        test_duplicate_is_not_inserted()
        print("✓ Duplicate protection")

        show_database_summary()

        print()
        print("ALL STORAGE TESTS PASSED ✓")

    except Exception as exc:

        print()
        print("STORAGE TEST FAILED")
        print("-" * 60)
        print(type(exc).__name__)
        print(str(exc))
        raise
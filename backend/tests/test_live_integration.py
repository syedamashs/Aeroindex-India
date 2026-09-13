from __future__ import annotations

import sys
from pathlib import Path
from uuid import uuid4

# ============================================================
# PROJECT ROOT
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


# ============================================================
# IMPORTS
# ============================================================

from database.connection import (
    initialize_database,
    get_connection,
)

from storage.collection_storage import (
    create_collection_run,
    create_collection_task,
    mark_task_running,
    mark_task_success,
    mark_task_failed,
    refresh_collection_run_counts,
    finalize_collection_run,
    get_collection_task,
    get_collection_run,
)

from storage.observation_storage import (
    insert_observations,
    count_observations,
)

from scrapers.indigo_scraper import run as run_indigo
from normalizers.indigo_normalizer import normalize_indigo


# ============================================================
# TEST CONFIG
# ============================================================

RUN_ID = f"LIVE_TEST_{uuid4().hex[:8].upper()}"

TASK_ID = f"TASK_INDIGO_{uuid4().hex[:8].upper()}"

ROUTE_ID = "DELHI_MUMBAI"

ORIGIN = "DEL"
DESTINATION = "BOM"

DEPARTURE_DATE = "2026-09-20"

TARGET_LEAD_DAYS = 7


# ============================================================
# FIND ROUTE
# ============================================================

def verify_route_exists():

    with get_connection() as conn:

        row = conn.execute(
            """
            SELECT *
            FROM apix_route_basket
            WHERE route_id = ?
            """,
            (ROUTE_ID,),
        ).fetchone()

    if row is None:
        raise RuntimeError(
            f"Route '{ROUTE_ID}' was not found in "
            "apix_route_basket."
        )

    return row


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 70)
    print("APIx LIVE END-TO-END INTEGRATION TEST")
    print("=" * 70)

    initialize_database()

    # --------------------------------------------------------
    # 1. VERIFY ROUTE
    # --------------------------------------------------------

    route = verify_route_exists()

    print(
        f"✓ Route found: "
        f"{route['route_id']}"
    )

    # --------------------------------------------------------
    # 2. CREATE COLLECTION RUN
    # --------------------------------------------------------

    create_collection_run(
        RUN_ID,
        total_tasks=1,
        status="RUNNING",
        notes="Live IndiGo scraper → normalizer → DB test",
    )

    print(f"✓ Collection run created: {RUN_ID}")

    # --------------------------------------------------------
    # 3. CREATE TASK
    # --------------------------------------------------------

    task = {
        "task_id": TASK_ID,
        "run_id": RUN_ID,
        "route_id": ROUTE_ID,
        "source": "indigo",
        "origin": ORIGIN,
        "destination": DESTINATION,
        "departure_date": DEPARTURE_DATE,
        "target_lead_days": TARGET_LEAD_DAYS,
    }

    create_collection_task(task)

    print(f"✓ Collection task created: {TASK_ID}")

    # --------------------------------------------------------
    # 4. START TASK
    # --------------------------------------------------------

    mark_task_running(TASK_ID)

    print("✓ Task marked RUNNING")

    # --------------------------------------------------------
    # 5. RUN REAL INDIGO SCRAPER
    # --------------------------------------------------------

    print()
    print("Starting REAL IndiGo collection...")
    print("-" * 70)

    try:

        raw_result = run_indigo(task)

        print("-" * 70)
        print("✓ IndiGo scraper completed")

        # ----------------------------------------------------
        # LOAD ACTUAL RAW JSON
        # ----------------------------------------------------

        import json

        raw_file = raw_result.get("raw_file")

        if not raw_file:
            raise RuntimeError(
                "IndiGo scraper did not return a raw_file path."
            )

        raw_path = Path(raw_file)

        if not raw_path.exists():
            raise RuntimeError(
                f"Raw JSON file does not exist: {raw_path}"
            )

        print(f"✓ Raw JSON verified: {raw_path}")

        with raw_path.open(
            "r",
            encoding="utf-8"
        ) as f:
            raw_json = json.load(f)

        print("✓ Raw JSON loaded")

        # ----------------------------------------------------
        # 6. NORMALIZE
        # ----------------------------------------------------

        print()
        print("Normalizing IndiGo raw JSON...")

        observations = normalize_indigo(
            raw_json,
            task,
        )

        if not observations:
            raise RuntimeError(
                "IndiGo scraper returned no normalized observations."
            )

        print(
            f"✓ Normalization completed: "
            f"{len(observations)} observations"
        )

        # ----------------------------------------------------
        # 7. VERIFY 45-COLUMN CONTRACT
        # ----------------------------------------------------

        expected_columns = {
            "observation_id",
            "source",
            "source_url",
            "search_timestamp",
            "extraction_status",
            "currency",
            "origin",
            "destination",
            "origin_city",
            "destination_city",
            "departure_datetime",
            "arrival_datetime",
            "departure_utc",
            "arrival_utc",
            "duration_minutes",
            "flight_number",
            "carrier_code",
            "marketing_airline",
            "operating_airline",
            "flight_id",
            "journey_id",
            "aircraft_code",
            "stops",
            "flight_type",
            "departure_terminal",
            "arrival_terminal",
            "code_share_indicator",
            "schedule_service_type",
            "fare_product_class",
            "fare_class",
            "fare_family",
            "source_offer_id",
            "fare_availability_key",
            "base_fare",
            "taxes",
            "total_fees",
            "total_fare",
            "is_cheapest_offer",
            "is_sold",
            "filling_fast",
            "service_charges",
            "original_fare_amount",
            "original_published_amount",
            "original_total_discount",
            "passenger_type",
        }

        actual_columns = set(observations[0].keys())

        if actual_columns != expected_columns:

            missing = expected_columns - actual_columns
            extra = actual_columns - expected_columns

            raise RuntimeError(
                "45-column contract mismatch.\n"
                f"Missing: {sorted(missing)}\n"
                f"Extra: {sorted(extra)}"
            )

        print("✓ 45-column contract verified")

        # ----------------------------------------------------
        # 8. WRITE TO SQLITE
        # ----------------------------------------------------

        print()
        print("Writing observations to SQLite...")

        inserted = insert_observations(
            observations
        )

        print(
            f"✓ SQLite insertion completed: "
            f"{inserted} new observations"
        )

        # ----------------------------------------------------
        # 9. VERIFY DATABASE COUNT
        # ----------------------------------------------------

        db_count = count_observations(
            source="indigo"
        )

        print(
            f"✓ Database observation count: "
            f"{db_count}"
        )

        if db_count <= 0:
            raise RuntimeError(
                "Observations were not found in the database."
            )

        # ----------------------------------------------------
        # 10. MARK TASK SUCCESS
        # ----------------------------------------------------

        mark_task_success(
            TASK_ID,
            actual_lead_days=7,
        )

        print("✓ Task marked SUCCESS")

    except Exception as exc:

        print()
        print("❌ LIVE COLLECTION FAILED")
        print(f"Error type: {type(exc).__name__}")
        print(f"Error: {exc}")

        mark_task_failed(
            TASK_ID,
            error_type=type(exc).__name__,
            error_message=str(exc),
        )

        raise

    finally:

        # ----------------------------------------------------
        # 11. UPDATE RUN
        # ----------------------------------------------------

        refresh_collection_run_counts(
            RUN_ID
        )

        final_status = finalize_collection_run(
            RUN_ID
        )

        print()
        print(
            f"✓ Collection run finalized: "
            f"{final_status}"
        )

    # --------------------------------------------------------
    # 12. FINAL VERIFICATION
    # --------------------------------------------------------

    final_task = get_collection_task(
        TASK_ID
    )

    final_run = get_collection_run(
        RUN_ID
    )

    print()
    print("=" * 70)
    print("FINAL VERIFICATION")
    print("=" * 70)

    print(
        f"Task status : {final_task['status']}"
    )

    print(
        f"Attempts    : {final_task['attempts']}"
    )

    print(
        f"Lead days   : {final_task['actual_lead_days']}"
    )

    print(
        f"Run status  : {final_run['status']}"
    )

    print(
        f"Successful  : {final_run['successful_tasks']}"
    )

    print(
        f"Failed      : {final_run['failed_tasks']}"
    )

    print()

    assert final_task["status"] == "SUCCESS"
    assert final_run["status"] == "SUCCESS"
    assert final_run["successful_tasks"] == 1
    assert final_run["failed_tasks"] == 0

    print("=" * 70)
    print("🎉 LIVE END-TO-END TEST PASSED")
    print("=" * 70)


if __name__ == "__main__":
    main()
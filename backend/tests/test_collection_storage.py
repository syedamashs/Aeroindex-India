from __future__ import annotations

import sys
from pathlib import Path
from uuid import uuid4

# ------------------------------------------------------------
# Project root
# ------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


from database.connection import (
    initialize_database,
    get_connection,
)

from storage.collection_storage import (
    create_collection_run,
    create_collection_tasks,
    get_collection_run,
    get_collection_task,
    mark_task_running,
    mark_task_success,
    mark_task_failed,
    refresh_collection_run_counts,
    finalize_collection_run,
    get_run_summary,
)


# ============================================================
# TEST DATA
# ============================================================

RUN_ID = f"TEST_RUN_{uuid4().hex[:8].upper()}"

TASK_SUCCESS = f"TEST_TASK_SUCCESS_{uuid4().hex[:8].upper()}"
TASK_FAILED = f"TEST_TASK_FAILED_{uuid4().hex[:8].upper()}"


# ============================================================
# HELPERS
# ============================================================

def get_test_route_id():
    """
    Use an existing DGCA route from the database.
    """

    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT route_id
            FROM apix_route_basket
            LIMIT 1
            """
        ).fetchone()

    if row is None:
        raise RuntimeError(
            "No route found in apix_route_basket. "
            "Load the DGCA route basket before running this test."
        )

    return row["route_id"]


# ============================================================
# TEST
# ============================================================

def main():

    print("=" * 60)
    print("APIx COLLECTION STORAGE TEST")
    print("=" * 60)

    initialize_database()

    route_id = get_test_route_id()

    # --------------------------------------------------------
    # 1. CREATE RUN
    # --------------------------------------------------------

    create_collection_run(
        RUN_ID,
        total_tasks=2,
        status="RUNNING",
        notes="Collection storage lifecycle test",
    )

    run = get_collection_run(RUN_ID)

    assert run is not None
    assert run["run_id"] == RUN_ID
    assert run["status"] == "RUNNING"

    print("✓ Collection run creation")

    # --------------------------------------------------------
    # 2. CREATE TASKS
    # --------------------------------------------------------

    tasks = [
        {
            "task_id": TASK_SUCCESS,
            "run_id": RUN_ID,
            "route_id": route_id,
            "source": "indigo",
            "origin": "DEL",
            "destination": "BOM",
            "departure_date": "2026-09-20",
            "target_lead_days": 7,
        },
        {
            "task_id": TASK_FAILED,
            "run_id": RUN_ID,
            "route_id": route_id,
            "source": "spicejet",
            "origin": "DEL",
            "destination": "BOM",
            "departure_date": "2026-09-20",
            "target_lead_days": 7,
        },
    ]

    inserted = create_collection_tasks(tasks)

    assert inserted == 2

    print("✓ Collection task creation")

    # --------------------------------------------------------
    # 3. CHECK INITIAL TASK STATE
    # --------------------------------------------------------

    task = get_collection_task(TASK_SUCCESS)

    assert task is not None
    assert task["status"] == "PENDING"
    assert task["attempts"] == 0

    print("✓ Initial task state = PENDING")

    # --------------------------------------------------------
    # 4. START SUCCESS TASK
    # --------------------------------------------------------

    mark_task_running(TASK_SUCCESS)

    task = get_collection_task(TASK_SUCCESS)

    assert task["status"] == "RUNNING"
    assert task["attempts"] == 1
    assert task["started_at"] is not None

    print("✓ Task transition PENDING → RUNNING")

    # --------------------------------------------------------
    # 5. COMPLETE SUCCESS TASK
    # --------------------------------------------------------

    mark_task_success(
        TASK_SUCCESS,
        actual_lead_days=7,
    )

    task = get_collection_task(TASK_SUCCESS)

    assert task["status"] == "SUCCESS"
    assert task["actual_lead_days"] == 7
    assert task["completed_at"] is not None
    assert task["error_type"] is None
    assert task["error_message"] is None

    print("✓ Task transition RUNNING → SUCCESS")

    # --------------------------------------------------------
    # 6. START FAILED TASK
    # --------------------------------------------------------

    mark_task_running(TASK_FAILED)

    task = get_collection_task(TASK_FAILED)

    assert task["status"] == "RUNNING"
    assert task["attempts"] == 1

    print("✓ Failed task transition PENDING → RUNNING")

    # --------------------------------------------------------
    # 7. FAIL TASK
    # --------------------------------------------------------

    mark_task_failed(
        TASK_FAILED,
        error_type="SCRAPER_TIMEOUT",
        error_message="Simulated scraper timeout",
    )

    task = get_collection_task(TASK_FAILED)

    assert task["status"] == "FAILED"
    assert task["error_type"] == "SCRAPER_TIMEOUT"
    assert task["error_message"] == "Simulated scraper timeout"
    assert task["completed_at"] is not None

    print("✓ Task transition RUNNING → FAILED")

    # --------------------------------------------------------
    # 8. REFRESH RUN COUNTS
    # --------------------------------------------------------

    refresh_collection_run_counts(RUN_ID)

    run = get_collection_run(RUN_ID)

    assert run["total_tasks"] == 2
    assert run["successful_tasks"] == 1
    assert run["failed_tasks"] == 1

    print("✓ Run counters updated")

    # --------------------------------------------------------
    # 9. FINALIZE RUN
    # --------------------------------------------------------

    final_status = finalize_collection_run(RUN_ID)

    assert final_status == "PARTIAL"

    run = get_collection_run(RUN_ID)

    assert run["status"] == "PARTIAL"
    assert run["completed_at"] is not None

    print("✓ Run finalized as PARTIAL")

    # --------------------------------------------------------
    # 10. SUMMARY
    # --------------------------------------------------------

    summary = get_run_summary(RUN_ID)

    print()
    print("Run summary:")
    print(f"  Total     : {summary['total_tasks']}")
    print(f"  Pending   : {summary['pending_tasks']}")
    print(f"  Running   : {summary['running_tasks']}")
    print(f"  Success   : {summary['successful_tasks']}")
    print(f"  Failed    : {summary['failed_tasks']}")
    print(f"  Skipped   : {summary['skipped_tasks']}")

    assert summary["total_tasks"] == 2
    assert summary["successful_tasks"] == 1
    assert summary["failed_tasks"] == 1

    print()
    print("=" * 60)
    print("ALL COLLECTION STORAGE TESTS PASSED ✓")
    print("=" * 60)


if __name__ == "__main__":
    main()
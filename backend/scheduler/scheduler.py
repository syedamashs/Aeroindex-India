"""
APIx Stage-A Scheduler

Stage A scope:
    - One DGCA route
    - Two lead-time windows
    - All configured airlines
    - One collection run
    - Sequential execution
    - Scrape -> Raw JSON -> Normalize -> SQLite
"""

import json
import sys
from pathlib import Path
from importlib import import_module


# ============================================================
# PROJECT PATH
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


# ============================================================
# APIx MODULES
# ============================================================

from scheduler.task_builder import (
    load_routes,
    build_tasks,
)

from scrapers.dispatcher import run_task

from storage.collection_storage import (
    create_collection_run,
    create_collection_task,
    mark_task_running,
    mark_task_success,
    mark_task_failed,
    finalize_collection_run,
)

from storage.observation_storage import (
    insert_observations,
)


# ============================================================
# STAGE-A CONFIGURATION
# ============================================================

STAGE_A_ROUTE_ID = "DELHI_MUMBAI"

STAGE_A_AIRLINES = (
    "airindia",
    "indigo",
    "spicejet",
)

STAGE_A_LEAD_TIMES = (
    1,
    7,
)


# ============================================================
# NORMALIZER LOADER
# ============================================================

NORMALIZER_FUNCTIONS = {
    "airindia": "normalize_airindia",
    "indigo": "normalize_indigo",
    "spicejet": "normalize_spicejet",
}


def load_normalizer(source):
    """
    Dynamically load the normalizer belonging to an airline.
    """

    source = str(source).strip().lower()

    function_name = NORMALIZER_FUNCTIONS.get(source)

    if not function_name:
        raise ValueError(
            f"No normalizer configured for source: {source}"
        )

    module = import_module(
        f"normalizers.{source}_normalizer"
    )

    normalizer = getattr(module, function_name, None)

    if normalizer is None:
        raise AttributeError(
            f"{function_name} not found in "
            f"normalizers.{source}_normalizer"
        )

    return normalizer


# ============================================================
# RAW JSON LOADER
# ============================================================

def load_raw_response(scraper_result):
    """
    Scrapers return a wrapper containing the path to the
    raw JSON file.

    Example:

        {
            "raw_file": ".../data/raw/...",
            "records": [...]
        }

    The normalizers operate on the actual raw JSON payload,
    so this function loads that file.
    """

    if not isinstance(scraper_result, dict):
        raise TypeError(
            "Scraper result must be a dictionary."
        )

    raw_file = scraper_result.get("raw_file")

    if not raw_file:
        raise ValueError(
            "Scraper did not return a raw_file path."
        )

    raw_path = Path(raw_file)

    if not raw_path.exists():
        raise FileNotFoundError(
            f"Raw JSON file not found: {raw_path}"
        )

    with raw_path.open(
        "r",
        encoding="utf-8",
    ) as file:

        raw_json = json.load(file)

    return raw_json, raw_path


# ============================================================
# SINGLE TASK EXECUTION
# ============================================================

def execute_task(task):
    """
    Execute one collection task:

        PENDING
          ↓
        RUNNING
          ↓
        SCRAPE
          ↓
        RAW JSON
          ↓
        NORMALIZE
          ↓
        SQLITE
          ↓
        SUCCESS

    Returns:
        inserted_observation_count
    """

    task_id = task["task_id"]
    source = task["source"]

    print()
    print("-" * 60)
    print(
        f"Task      : {task_id}"
    )
    print(
        f"Source    : {source.upper()}"
    )
    print(
        f"Route     : "
        f"{task['origin']} -> {task['destination']}"
    )
    print(
        f"Departure : {task['departure_date']}"
    )
    print(
        f"Target    : T+{task['target_lead_days']}"
    )
    print("-" * 60)

    # --------------------------------------------------------
    # PENDING -> RUNNING
    # --------------------------------------------------------

    mark_task_running(task_id)

    try:

        # ----------------------------------------------------
        # SCRAPE
        # ----------------------------------------------------

        print("  [1/4] Scraping...")

        scraper_result = run_task(
            source,
            task,
        )

        # ----------------------------------------------------
        # LOAD RAW JSON
        # ----------------------------------------------------

        print("  [2/4] Loading raw JSON...")

        raw_json, raw_path = load_raw_response(
            scraper_result
        )

        print(
            f"        Raw file: {raw_path}"
        )

        # ----------------------------------------------------
        # NORMALIZE
        # ----------------------------------------------------

        print("  [3/4] Normalizing...")

        normalizer = load_normalizer(source)

        observations = normalizer(
            raw_json,
            task,
        )

        if observations is None:
            observations = []

        if not isinstance(observations, list):
            raise TypeError(
                "Normalizer must return a list of observations."
            )

        print(
            f"        Normalized observations: "
            f"{len(observations)}"
        )

        # ----------------------------------------------------
        # SQLITE
        # ----------------------------------------------------

        print("  [4/4] Writing SQLite...")

        inserted = insert_observations(
            observations
        )

        # ----------------------------------------------------
        # SUCCESS
        # ----------------------------------------------------

        actual_lead_days = None

        if observations:
            actual_lead_days = (
                observations[0].get(
                    "advance_purchase_days"
                )
            )

        # The frozen canonical schema does not currently
        # require advance_purchase_days, so fall back to the
        # requested target when it is not present.
        if actual_lead_days is None:
            actual_lead_days = task[
                "target_lead_days"
            ]

        mark_task_success(
            task_id,
            observation_count=inserted,
            actual_lead_days=actual_lead_days,
        )

        print(
            f"  ✓ SUCCESS — {inserted} observations inserted"
        )

        return inserted

    except Exception as exc:

        error_type = type(exc).__name__
        error_message = str(exc)

        mark_task_failed(
            task_id,
            error_type=error_type,
            error_message=error_message,
        )

        print(
            f"  ✗ FAILED — {error_type}: "
            f"{error_message}"
        )

        return 0


# ============================================================
# STAGE-A COLLECTION
# ============================================================

def run_stage_a():
    """
    Run the complete Stage-A collection.

    Stage A:

        DELHI_MUMBAI
        × 3 airlines
        × T+1 and T+7
        × one run
    """

    print()
    print("=" * 60)
    print("APIx — STAGE A COLLECTION SCHEDULER")
    print("=" * 60)

    # --------------------------------------------------------
    # LOAD THE DGCA ROUTE MASTER
    # --------------------------------------------------------

    routes = load_routes()

    selected_routes = [
        route
        for route in routes
        if str(route["route_id"]).strip()
        == STAGE_A_ROUTE_ID
    ]

    if not selected_routes:
        raise ValueError(
            f"Route {STAGE_A_ROUTE_ID} "
            f"not found in routes.csv"
        )

    if len(selected_routes) != 1:
        raise ValueError(
            f"Expected exactly one route for "
            f"{STAGE_A_ROUTE_ID}, found "
            f"{len(selected_routes)}"
        )

    route = selected_routes[0]

    print()
    print(
        f"Route : {route['city1']} -> {route['city2']}"
    )
    print(
        f"Route ID : {route['route_id']}"
    )
    print(
        f"Airlines: {', '.join(STAGE_A_AIRLINES)}"
    )
    print(
        "Lead times: "
        + ", ".join(
            f"T+{days}"
            for days in STAGE_A_LEAD_TIMES
        )
    )

    # --------------------------------------------------------
    # BUILD STAGE-A TASKS
    # --------------------------------------------------------

    tasks = build_tasks(
        routes=selected_routes,
        airlines=STAGE_A_AIRLINES,
        lead_times=STAGE_A_LEAD_TIMES,
    )

    if not tasks:
        raise ValueError(
            "Stage-A task builder returned no tasks."
        )

    run_id = tasks[0]["run_id"]

    print()
    print(
        f"Run ID: {run_id}"
    )
    print(
        f"Tasks : {len(tasks)}"
    )

    # --------------------------------------------------------
    # CREATE COLLECTION RUN
    # --------------------------------------------------------

    create_collection_run(
        run_id,
        total_tasks=len(tasks),
    )

    # --------------------------------------------------------
    # CREATE COLLECTION TASKS
    # --------------------------------------------------------

    for task in tasks:
        create_collection_task(task)

    # --------------------------------------------------------
    # EXECUTE TASKS SEQUENTIALLY
    # --------------------------------------------------------

    total_inserted = 0
    successful = 0
    failed = 0

    for index, task in enumerate(
        tasks,
        start=1,
    ):

        print()
        print(
            f"[{index}/{len(tasks)}]"
        )

        before = total_inserted

        inserted = execute_task(task)

        total_inserted += inserted

        if inserted > 0:
            successful += 1
        else:
            failed += 1

    # --------------------------------------------------------
    # FINALIZE RUN
    # --------------------------------------------------------

    run_summary = finalize_collection_run(
        run_id
    )

    # --------------------------------------------------------
    # FINAL REPORT
    # --------------------------------------------------------

    print()
    print("=" * 60)
    print("STAGE A FINAL REPORT")
    print("=" * 60)

    print(
        f"Run ID              : {run_id}"
    )

    print(
        f"Route               : "
        f"{route['city1']} -> {route['city2']}"
    )

    print(
        "Lead times          : "
        + ", ".join(
            f"T+{days}"
            for days in STAGE_A_LEAD_TIMES
        )
    )

    print(
        f"Tasks                : {len(tasks)}"
    )

    print(
        f"Successful tasks     : {successful}"
    )

    print(
        f"Failed tasks         : {failed}"
    )

    print(
        f"Observations inserted: {total_inserted}"
    )

    if isinstance(run_summary, dict):
        print(
            f"Run status           : "
            f"{run_summary.get('status', 'UNKNOWN')}"
        )

    print("=" * 60)

    if failed == 0:
        print(
            "🎉 STAGE A SCHEDULER COMPLETED SUCCESSFULLY"
        )
    else:
        print(
            "⚠ STAGE A COMPLETED WITH FAILURES"
        )

    print("=" * 60)

    return run_id


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    run_stage_a()
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
import os
import sys
from pathlib import Path
from importlib import import_module


def safe_print(*args, sep=' ', end='\n', file=None):
    """Write text safely to stdout/stderr on Windows terminals that cannot encode Unicode."""
    stream = file if file is not None else sys.stdout
    encoding = getattr(stream, 'encoding', None) or 'utf-8'
    text = sep.join(str(arg) for arg in args)

    try:
        stream.write(text)
        if end is not None:
            stream.write(end)
        stream.flush()
        return
    except UnicodeEncodeError:
        safe_text = text.encode(encoding, errors='replace').decode(encoding, errors='replace')
        stream.write(safe_text)
        if end is not None:
            stream.write(end)
        stream.flush()


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
from database.connection import sync_scheduler_run_to_backup
from upload_db import upload_database


# ============================================================
# STAGE-A CONFIGURATION
# ============================================================

STAGE_A_ROUTE_IDS = (
    "DELHI_MUMBAI",
    "CHENNAI_DELHI",
    "CHENNAI_MUMBAI",
)

STAGE_A_AIRLINES = (
    "airindia",
    "indigo",
    "spicejet",
)

# Smoke-test only for DB verification before expanding back to the
# full production lead-time matrix.
STAGE_A_LEAD_TIMES = (
    7,
)


def configured_scheduler_values():
    airlines = tuple(dict.fromkeys(
        value.strip().lower()
        for value in os.getenv("APIX_SCHEDULER_AIRLINES", "airindia").split(",")
        if value.strip() in STAGE_A_AIRLINES
    ))
    supported_lead_times = {1, 7, 15, 30}
    lead_times = tuple(
        days
        for days in dict.fromkeys(
            int(value.strip())
            for value in os.getenv("APIX_SCHEDULER_LEAD_TIMES", "7").split(",")
            if value.strip().isdigit() and int(value.strip()) in supported_lead_times
        )
    )
    routes = tuple(dict.fromkeys(
        value.strip().upper()
        for value in os.getenv("APIX_SCHEDULER_ROUTES", ",".join(STAGE_A_ROUTE_IDS)).split(",")
        if value.strip().upper() in STAGE_A_ROUTE_IDS
    ))
    return airlines, lead_times, routes


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
        scraper_error = scraper_result.get("error")
        if scraper_error:
            raise RuntimeError(
                f"Scraper failed before producing raw output: {scraper_error}"
            )
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

    safe_print()
    safe_print("-" * 60)
    safe_print(
        f"Task      : {task_id}"
    )
    safe_print(
        f"Source    : {source.upper()}"
    )
    safe_print(
        f"Route     : "
        f"{task['origin']} -> {task['destination']}"
    )
    safe_print(
        f"Departure : {task['departure_date']}"
    )
    safe_print(
        f"Target    : T+{task['target_lead_days']}"
    )
    safe_print("-" * 60)

    # --------------------------------------------------------
    # PENDING -> RUNNING
    # --------------------------------------------------------

    mark_task_running(task_id)

    try:

        # ----------------------------------------------------
        # SCRAPE
        # ----------------------------------------------------

        safe_print("  [1/4] Scraping...")

        scraper_result = run_task(
            source,
            task,
        )

        # ----------------------------------------------------
        # LOAD RAW JSON
        # ----------------------------------------------------

        safe_print("  [2/4] Loading raw JSON...")

        raw_json, raw_path = load_raw_response(
            scraper_result
        )

        safe_print(
            f"        Raw file: {raw_path}"
        )

        # ----------------------------------------------------
        # NORMALIZE
        # ----------------------------------------------------

        safe_print("  [3/4] Normalizing...")

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

        for observation in observations:
            observation.update(
                run_id=task["run_id"],
                task_id=task["task_id"],
                route_id=task["route_id"],
                target_lead_days=task["target_lead_days"],
                actual_lead_days=task["target_lead_days"],
            )

        safe_print(
            f"        Normalized observations: "
            f"{len(observations)}"
        )

        # ----------------------------------------------------
        # SQLITE
        # ----------------------------------------------------

        safe_print("  [4/4] Writing SQLite...")

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

        safe_print(
            f"  SUCCESS — {inserted} observations inserted"
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

        safe_print(
            f"  FAILED — {error_type}: "
            f"{error_message}"
        )

        return None


# ============================================================
# STAGE-A COLLECTION
# ============================================================

def run_stage_a():
    """
    Run the complete Stage-A collection.

    Stage A:

        DELHI_MUMBAI
        × 3 airlines
        × T+1, T+7, T+15, T+30, and T+45
        × one run
    """

    selected_airlines, selected_lead_times, selected_route_ids = configured_scheduler_values()

    if not selected_airlines or not selected_lead_times or not selected_route_ids:
        raise ValueError("No scheduler selections were provided. Select at least one airline, route, and booking window.")

    safe_print()
    safe_print("=" * 60)
    safe_print("APIx — STAGE A COLLECTION SCHEDULER")
    safe_print("=" * 60)

    # --------------------------------------------------------
    # LOAD THE DGCA ROUTE MASTER
    # --------------------------------------------------------

    routes = load_routes()

    selected_routes = [
        route
        for route in routes
        if str(route["route_id"]).strip().upper() in selected_route_ids
    ]

    selected_route_ids = tuple(
        route_id
        for route_id in selected_route_ids
        if any(str(route["route_id"]).strip().upper() == route_id for route in selected_routes)
    )

    safe_print()
    safe_print(
        "Routes: "
        + ", ".join(f"{route['city1']} -> {route['city2']}" for route in selected_routes)
    )
    safe_print(
        f"Route IDs: {', '.join(selected_route_ids)}"
    )
    safe_print(
        f"Airlines: {', '.join(selected_airlines)}"
    )
    safe_print(
        "Lead times: "
        + ", ".join(
            f"T+{days}"
            for days in selected_lead_times
        )
    )

    # --------------------------------------------------------
    # BUILD STAGE-A TASKS
    # --------------------------------------------------------

    tasks = build_tasks(
        routes=selected_routes,
        airlines=selected_airlines,
        lead_times=selected_lead_times,
    )

    if not tasks:
        raise ValueError(
            "Stage-A task builder returned no tasks."
        )

    run_id = tasks[0]["run_id"]

    safe_print()
    safe_print(
        f"Run ID: {run_id}"
    )
    safe_print(
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

    # Copy only this scheduler run; synthetic live-only rows are excluded.
    sync_scheduler_run_to_backup(run_id)

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

        safe_print()
        safe_print(
            f"[{index}/{len(tasks)}]"
        )

        before = total_inserted

        inserted = execute_task(task)

        # Copy only this scheduler run after every task, so an interrupted
        # run leaves both databases aligned without copying synthetic rows.
        sync_scheduler_run_to_backup(run_id)

        if inserted is None:
            failed += 1
            continue

        total_inserted += inserted
        successful += 1

    # --------------------------------------------------------
    # FINALIZE RUN
    # --------------------------------------------------------

    run_summary = finalize_collection_run(
        run_id
    )

    # --------------------------------------------------------
    # FINAL REPORT
    # --------------------------------------------------------

    safe_print()
    safe_print("=" * 60)
    safe_print("STAGE A FINAL REPORT")
    safe_print("=" * 60)

    safe_print(
        f"Run ID              : {run_id}"
    )

    safe_print(
        f"Route               : "
        ", ".join(f"{item['city1']} -> {item['city2']}" for item in selected_routes)
    )

    safe_print(
        "Lead times          : "
        + ", ".join(
            f"T+{days}"
            for days in selected_lead_times
        )
    )

    safe_print(
        f"Tasks                : {len(tasks)}"
    )

    safe_print(
        f"Successful tasks     : {successful}"
    )

    safe_print(
        f"Failed tasks         : {failed}"
    )

    safe_print(
        f"Observations inserted: {total_inserted}"
    )

    if isinstance(run_summary, dict):
        safe_print(
            f"Run status           : "
            f"{run_summary.get('status', 'UNKNOWN')}"
        )

    safe_print("=" * 60)

    if failed == 0 and total_inserted == 0:
        safe_print("NO OBSERVATIONS FOUND FOR THE SELECTED FILTERS")
    elif failed == 0:
        safe_print(
            "STAGE A SCHEDULER COMPLETED SUCCESSFULLY"
        )
        try:
            upload_url = upload_database()
            safe_print(f"Updated database uploaded to Hugging Face: {upload_url}")
        except Exception as exc:
            safe_print(f"Hugging Face database upload failed: {type(exc).__name__}: {exc}")
    else:
        safe_print(
            "STAGE A COMPLETED WITH FAILURES"
        )

    safe_print("=" * 60)

    return run_id


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    run_stage_a()
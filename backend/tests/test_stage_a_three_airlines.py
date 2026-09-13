from pathlib import Path
import json
import sys
import uuid


# ============================================================
# PROJECT ROOT
# ============================================================

ROOT = Path(__file__).resolve().parents[1]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# ============================================================
# IMPORTS
# ============================================================

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
    count_observations,
)

from normalizers.airindia_normalizer import normalize_airindia
from normalizers.indigo_normalizer import normalize_indigo
from normalizers.spicejet_normalizer import normalize_spicejet


# ============================================================
# STAGE A CONFIGURATION
# ============================================================

ROUTE_ID = "DELHI_MUMBAI"

ORIGIN = "DEL"
DESTINATION = "BOM"

DEPARTURE_DATE = "2026-09-20"

TARGET_LEAD_DAYS = 7

SOURCES = (
    "airindia",
    "indigo",
    "spicejet",
)

NORMALIZERS = {
    "airindia": normalize_airindia,
    "indigo": normalize_indigo,
    "spicejet": normalize_spicejet,
}


# ============================================================
# HELPERS
# ============================================================

def load_raw_json(raw_file):
    path = Path(raw_file)

    if not path.exists():
        raise FileNotFoundError(
            f"Raw JSON file does not exist: {path}"
        )

    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def make_run_id():
    return f"STAGE_A_{uuid.uuid4().hex[:8].upper()}"


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 70)
    print("APIx STAGE A")
    print("3 AIRLINES × 1 ROUTE × 1 LEAD TIME")
    print("=" * 70)

    print()
    print(f"Route          : {ORIGIN} → {DESTINATION}")
    print(f"Route ID       : {ROUTE_ID}")
    print(f"Departure date : {DEPARTURE_DATE}")
    print(f"Target lead    : T+{TARGET_LEAD_DAYS}")
    print(f"Airlines       : {', '.join(SOURCES)}")

    # ========================================================
    # CREATE COLLECTION RUN
    # ========================================================

    run_id = make_run_id()

    create_collection_run(
        run_id,
        total_tasks=len(SOURCES),
    )

    print()
    print(f"✓ Collection run created: {run_id}")

    results = []

    # ========================================================
    # ONE TASK PER AIRLINE
    # ========================================================

    for source in SOURCES:

        task = {
            "run_id": run_id,
            "task_id": f"{run_id}_{source.upper()}",
            "route_id": ROUTE_ID,
            "source": source,
            "origin": ORIGIN,
            "destination": DESTINATION,
            "departure_date": DEPARTURE_DATE,
            "target_lead_days": TARGET_LEAD_DAYS,
        }

        # ----------------------------------------------------
        # CREATE TASK
        # ----------------------------------------------------

        task_id = create_collection_task(task)

        task["task_id"] = task_id

        print()
        print("=" * 70)
        print(f"{source.upper()} COLLECTION")
        print("=" * 70)

        try:

            # ------------------------------------------------
            # RUNNING
            # ------------------------------------------------

            mark_task_running(task_id)

            print("✓ Task marked RUNNING")

            # ------------------------------------------------
            # SCRAPE
            # ------------------------------------------------

            print()
            print("Starting REAL collection...")

            result = run_task(
                source,
                task,
            )

            print("✓ Scraper completed")

            # ------------------------------------------------
            # RAW JSON
            # ------------------------------------------------

            raw_file = result.get("raw_file")

            if not raw_file:
                raise RuntimeError(
                    f"{source} scraper returned no raw_file"
                )

            raw_path = Path(raw_file)

            print(
                f"✓ Raw JSON: {raw_path}"
            )

            raw_json = load_raw_json(raw_path)

            print("✓ Raw JSON loaded")

            # ------------------------------------------------
            # NORMALIZATION
            # ------------------------------------------------

            print()
            print("Normalizing...")

            normalizer = NORMALIZERS[source]

            observations = normalizer(
                raw_json,
                task,
            )

            print(
                f"✓ Normalized: {len(observations)} observations"
            )

            if not observations:
                raise RuntimeError(
                    f"{source} produced zero observations"
                )

            # ------------------------------------------------
            # 45-COLUMN CONTRACT
            # ------------------------------------------------

            bad_rows = [
                i
                for i, row in enumerate(observations)
                if len(row) != 45
            ]

            if bad_rows:
                raise RuntimeError(
                    f"{source}: rows without 45 columns: "
                    f"{bad_rows[:10]}"
                )

            print("✓ 45-column contract verified")

            # ------------------------------------------------
            # STORAGE
            # ------------------------------------------------

            print()
            print("Writing to SQLite...")

            inserted = insert_observations(
                observations
            )

            print(
                f"✓ SQLite inserted: {inserted}"
            )

            # ------------------------------------------------
            # TASK SUCCESS
            # ------------------------------------------------

            mark_task_success(
                task_id,
                observation_count=inserted,
                actual_lead_days=TARGET_LEAD_DAYS,
            )

            print("✓ Task marked SUCCESS")

            results.append({
                "source": source,
                "status": "SUCCESS",
                "normalized": len(observations),
                "inserted": inserted,
            })

        except Exception as exc:

            print()
            print(f"✗ {source.upper()} FAILED")
            print(
                f"  {type(exc).__name__}: {exc}"
            )

            mark_task_failed(
                task_id,
                error_type=type(exc).__name__,
                error_message=str(exc),
            )

            results.append({
                "source": source,
                "status": "FAILED",
                "normalized": 0,
                "inserted": 0,
            })

    # ========================================================
    # FINALIZE RUN
    # ========================================================

    run_status = finalize_collection_run(run_id)

    # ========================================================
    # FINAL REPORT
    # ========================================================

    print()
    print("=" * 70)
    print("STAGE A FINAL REPORT")
    print("=" * 70)

    for result in results:

        print(
            f"{result['source']:12} "
            f"{result['status']:8} "
            f"normalized={result['normalized']:4} "
            f"inserted={result['inserted']:4}"
        )

    successful = sum(
        r["status"] == "SUCCESS"
        for r in results
    )

    failed = sum(
        r["status"] == "FAILED"
        for r in results
    )

    print()
    print(f"Run ID              : {run_id}")
    print(f"Run status          : {run_status}")
    print(f"Successful airlines : {successful}")
    print(f"Failed airlines     : {failed}")

    print()
    print("Database totals:")
    print(
        f"  Air India : {count_observations('airindia')}"
    )
    print(
        f"  IndiGo    : {count_observations('indigo')}"
    )
    print(
        f"  SpiceJet  : {count_observations('spicejet')}"
    )

    print()

    if failed == 0:
        print("🎉 STAGE A PASSED")
        print()
        print(
            "REAL AIRLINES"
            " → SCRAPE"
            " → RAW JSON"
            " → NORMALIZE"
            " → SQLITE"
            " → SUCCESS"
        )
    else:
        print("⚠ STAGE A PARTIAL")
        print(
            "One or more airline tasks failed."
        )


if __name__ == "__main__":
    main()
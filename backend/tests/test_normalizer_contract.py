"""
APIx NORMALIZER CONTRACT AUDIT

Tests the production normalizers against real captured production
raw JSON files.

Run from project root:

    python backend\tests\test_normalizer_contract.py

Audit scope:
    Air India
    IndiGo
    SpiceJet

Test route:
    DEL -> BOM

Departure:
    2026-09-20

Target lead time:
    T+7

IMPORTANT:
    This test does NOT write anything to the database.
"""

from __future__ import annotations

import json
import sys
from datetime import date, datetime
from pathlib import Path


# ============================================================
# PROJECT PATH
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


# ============================================================
# IMPORT PRODUCTION NORMALIZERS
# ============================================================

from normalizers.airindia_normalizer import normalize_airindia
from normalizers.indigo_normalizer import normalize_indigo
from normalizers.spicejet_normalizer import normalize_spicejet


# ============================================================
# APIx CANONICAL 45-COLUMN SCHEMA
# ============================================================

APIX_COLUMNS = [
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
]


# ============================================================
# REAL PRODUCTION RAW FILES
# ============================================================
#
# These are the files you showed from:
#
# backend\data\raw\airindia
# backend\data\raw\indigo
# backend\data\raw\spicejet
#
# We deliberately use ONLY ONE Air India capture here.
# The other two Air India captures can later be used for
# fare-state transition testing.
# ============================================================

RAW_FILES = {
    "airindia": PROJECT_ROOT
    / "data"
    / "raw"
    / "airindia"
    / "20260913_174523_325967_DELHI_MUMBAI_2026-09-20_task_d8e33501a1c1.json",

    "indigo": PROJECT_ROOT
    / "data"
    / "raw"
    / "indigo"
    / "20260913_173605_285140_DELHI_MUMBAI_2026-09-20_task_3417e0dfe5f2.json",

    "spicejet": PROJECT_ROOT
    / "data"
    / "raw"
    / "spicejet"
    / "20260913_173619_542218_DELHI_MUMBAI_2026-09-20_task_9efde1dbeaec.json",
}


# ============================================================
# TASK DEFINITIONS
# ============================================================

TASKS = {
    "airindia": {
        "run_id": "AUDIT_RUN",
        "task_id": "AUDIT_AI_001",
        "route_id": "DELHI_MUMBAI",
        "origin": "DEL",
        "destination": "BOM",
        "departure_date": "2026-09-20",
        "target_lead_days": 7,
    },

    "indigo": {
        "run_id": "AUDIT_RUN",
        "task_id": "AUDIT_6E_001",
        "route_id": "DELHI_MUMBAI",
        "origin": "DEL",
        "destination": "BOM",
        "departure_date": "2026-09-20",
        "target_lead_days": 7,
    },

    "spicejet": {
        "run_id": "AUDIT_RUN",
        "task_id": "AUDIT_SG_001",
        "route_id": "DELHI_MUMBAI",
        "origin": "DEL",
        "destination": "BOM",
        "departure_date": "2026-09-20",
        "target_lead_days": 7,
    },
}


# ============================================================
# NORMALIZER MAP
# ============================================================

NORMALIZERS = {
    "airindia": normalize_airindia,
    "indigo": normalize_indigo,
    "spicejet": normalize_spicejet,
}


# ============================================================
# DISPLAY HELPERS
# ============================================================

PASS = "✓"
FAIL = "✗"
WARN = "⚠"


def check(condition, message, failures):
    """Print a check result and store failures."""

    if condition:
        print(f"  {PASS} {message}")
        return True

    print(f"  {FAIL} {message}")
    failures.append(message)
    return False


def warning(message):
    print(f"  {WARN} {message}")


# ============================================================
# FILE / JSON HELPERS
# ============================================================

def load_json(path: Path):
    """Load JSON from disk."""

    if not path.exists():
        raise FileNotFoundError(
            f"Raw JSON file does not exist:\n{path}"
        )

    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


# ============================================================
# DATE / TIME HELPERS
# ============================================================

def parse_date(value):
    """Parse YYYY-MM-DD from common timestamp/date formats."""

    if value is None:
        return None

    value = str(value).strip()

    if not value:
        return None

    # ISO timestamp
    if "T" in value:
        value = value.split("T", 1)[0]

    # Datetime with space
    if " " in value:
        value = value.split(" ", 1)[0]

    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def parse_datetime(value):
    """Parse an ISO datetime."""

    if value is None:
        return None

    value = str(value).strip()

    if not value:
        return None

    try:
        return datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )
    except (ValueError, TypeError):
        return None


# ============================================================
# TEST 1 — NORMALIZER RETURN TYPE
# ============================================================

def audit_return_type(rows, failures):
    """Verify the normalizer returns a list."""

    check(
        isinstance(rows, list),
        "normalizer returned a list",
        failures,
    )


# ============================================================
# TEST 2 — OBSERVATION COUNT
# ============================================================

def audit_observation_count(rows, failures):
    """Verify at least one observation was generated."""

    check(
        len(rows) > 0,
        f"normalizer generated {len(rows)} observation(s)",
        failures,
    )


# ============================================================
# TEST 3 — EXACT 45 COLUMNS
# ============================================================

def audit_columns(rows, failures):
    """Verify exact canonical schema."""

    expected = set(APIX_COLUMNS)

    for index, row in enumerate(rows):

        if not isinstance(row, dict):
            failures.append(
                f"row {index} is not a dictionary"
            )
            print(
                f"  {FAIL} row {index} is a dictionary"
            )
            continue

        actual = set(row.keys())

        missing = sorted(expected - actual)
        extra = sorted(actual - expected)

        check(
            not missing,
            (
                f"row {index}: no missing canonical columns"
                + (
                    f" -> {missing}"
                    if missing
                    else ""
                )
            ),
            failures,
        )

        check(
            not extra,
            (
                f"row {index}: no unexpected columns"
                + (
                    f" -> {extra}"
                    if extra
                    else ""
                )
            ),
            failures,
        )


# ============================================================
# TEST 4 — SOURCE
# ============================================================

def audit_source_value(rows, source, failures):
    """Verify source is correct."""

    if not rows:
        return

    values = {
        row.get("source")
        for row in rows
    }

    check(
        values == {source},
        f"source = {source}",
        failures,
    )


# ============================================================
# TEST 5 — ROUTE
# ============================================================

def audit_route(rows, task, failures):
    """Verify origin and destination."""

    if not rows:
        return

    origins = {
        row.get("origin")
        for row in rows
    }

    destinations = {
        row.get("destination")
        for row in rows
    }

    check(
        origins == {task["origin"]},
        (
            f"origin = {task['origin']}"
            + (
                f" -> observed {sorted(origins)}"
                if origins != {task["origin"]}
                else ""
            )
        ),
        failures,
    )

    check(
        destinations == {task["destination"]},
        (
            f"destination = {task['destination']}"
            + (
                f" -> observed {sorted(destinations)}"
                if destinations != {task["destination"]}
                else ""
            )
        ),
        failures,
    )


# ============================================================
# TEST 6 — DEPARTURE DATE
# ============================================================

def audit_departure_date(rows, task, failures):
    """Verify departure date matches task."""

    if not rows:
        return

    expected = task["departure_date"]

    bad = []

    for row in rows:

        actual = parse_date(
            row.get("departure_datetime")
        )

        if actual is None:
            bad.append(
                row.get("departure_datetime")
            )

        elif actual.isoformat() != expected:
            bad.append(
                row.get("departure_datetime")
            )

    check(
        not bad,
        (
            f"departure date = {expected}"
            + (
                f" -> invalid values: {bad[:5]}"
                if bad
                else ""
            )
        ),
        failures,
    )


# ============================================================
# TEST 7 — TIMESTAMPS
# ============================================================

def audit_timestamps(rows, failures):
    """Verify important timestamps can be parsed."""

    if not rows:
        return

    bad_search = []
    bad_departure = []
    bad_arrival = []

    for row in rows:

        if parse_datetime(
            row.get("search_timestamp")
        ) is None:
            bad_search.append(
                row.get("search_timestamp")
            )

        if parse_datetime(
            row.get("departure_datetime")
        ) is None:
            bad_departure.append(
                row.get("departure_datetime")
            )

        if parse_datetime(
            row.get("arrival_datetime")
        ) is None:
            bad_arrival.append(
                row.get("arrival_datetime")
            )

    check(
        not bad_search,
        "search_timestamp is parseable",
        failures,
    )

    check(
        not bad_departure,
        "departure_datetime is parseable",
        failures,
    )

    check(
        not bad_arrival,
        "arrival_datetime is parseable",
        failures,
    )


# ============================================================
# TEST 8 — LEAD TIME
# ============================================================

def audit_lead_time(rows, failures):
    """
    Verify actual lead time can be calculated.

    We intentionally DO NOT require actual lead time to equal
    target_lead_days.

    The target is the requested bucket.
    Actual lead time comes from the real search timestamp
    and departure date.
    """

    if not rows:
        return

    invalid = []
    lead_times = []

    for row in rows:

        search_date = parse_date(
            row.get("search_timestamp")
        )

        departure_date = parse_date(
            row.get("departure_datetime")
        )

        if not search_date or not departure_date:
            continue

        lead_days = (
            departure_date - search_date
        ).days

        lead_times.append(lead_days)

        if lead_days < 0:
            invalid.append(
                (
                    row.get("observation_id"),
                    lead_days,
                )
            )

    check(
        not invalid,
        "actual lead time is non-negative",
        failures,
    )

    if lead_times:
        print(
            "  • actual lead-time values observed: "
            f"{sorted(set(lead_times))}"
        )


# ============================================================
# TEST 9 — OBSERVATION IDS
# ============================================================

def audit_observation_ids(rows, failures):
    """Verify observation IDs exist and are unique."""

    if not rows:
        return

    ids = [
        row.get("observation_id")
        for row in rows
    ]

    missing = [
        value
        for value in ids
        if value in (None, "")
    ]

    check(
        not missing,
        "all observations have observation_id",
        failures,
    )

    check(
        len(ids) == len(set(ids)),
        (
            "observation_id values are unique "
            f"within sample ({len(ids)} rows)"
        ),
        failures,
    )


# ============================================================
# TEST 10 — FARE ARITHMETIC
# ============================================================

def audit_fare_arithmetic(rows, failures):
    """
    Validate:

        base_fare + taxes + total_fees = total_fare

    Only rows where ALL four values exist are checked.

    We deliberately do NOT infer missing values.
    """

    if not rows:
        return

    checked = 0
    failures_found = []

    for row in rows:

        base = row.get("base_fare")
        taxes = row.get("taxes")
        fees = row.get("total_fees")
        total = row.get("total_fare")

        if None in (
            base,
            taxes,
            fees,
            total,
        ):
            continue

        try:
            expected = (
                float(base)
                + float(taxes)
                + float(fees)
            )

            actual = float(total)

        except (
            TypeError,
            ValueError,
        ):
            failures_found.append(
                (
                    row.get("observation_id"),
                    "non-numeric fare component",
                )
            )
            continue

        checked += 1

        if abs(expected - actual) > 0.01:

            failures_found.append(
                (
                    row.get("observation_id"),
                    expected,
                    actual,
                )
            )

    if checked == 0:

        warning(
            "No observations had all four fare components "
            "available for arithmetic validation."
        )

        return

    check(
        not failures_found,
        (
            f"fare arithmetic passed for {checked} "
            "observation(s)"
            + (
                f" -> failures: {failures_found[:3]}"
                if failures_found
                else ""
            )
        ),
        failures,
    )


# ============================================================
# TEST 11 — REQUIRED ECONOMIC IDENTITY
# ============================================================

def audit_required_identity(rows, failures):
    """
    Verify minimum fields needed to identify a priced journey.
    """

    if not rows:
        return

    required = [
        "source",
        "origin",
        "destination",
        "departure_datetime",
        "arrival_datetime",
        "currency",
        "total_fare",
    ]

    for field in required:

        missing = sum(
            1
            for row in rows
            if row.get(field) in (None, "")
        )

        check(
            missing == 0,
            (
                f"{field}: no missing values"
                + (
                    f" ({missing} missing)"
                    if missing
                    else ""
                )
            ),
            failures,
        )


# ============================================================
# TEST 12 — STOPS
# ============================================================

def audit_stops(rows, failures):
    """Verify stops are sane when populated."""

    if not rows:
        return

    invalid = []

    for row in rows:

        value = row.get("stops")

        if value is None:
            continue

        try:
            number = int(value)

            if number < 0:
                invalid.append(value)

        except (
            TypeError,
            ValueError,
        ):
            invalid.append(value)

    check(
        not invalid,
        "stops values are valid non-negative integers",
        failures,
    )


# ============================================================
# TEST 13 — TOTAL FARE SANITY
# ============================================================

def audit_total_fare(rows, failures):
    """Verify total fares are non-negative when present."""

    if not rows:
        return

    invalid = []

    for row in rows:

        total = row.get("total_fare")

        if total is None:
            continue

        try:
            if float(total) < 0:
                invalid.append(total)

        except (
            TypeError,
            ValueError,
        ):
            invalid.append(total)

    check(
        not invalid,
        "total_fare values are non-negative",
        failures,
    )


# ============================================================
# TEST 14 — FARE CLASS / PRODUCT OBSERVATION
# ============================================================

def audit_fare_information(rows):
    """Print observed fare information."""

    if not rows:
        return

    fare_classes = sorted(
        {
            str(row.get("fare_class"))
            for row in rows
            if row.get("fare_class")
            not in (None, "")
        }
    )

    fare_products = sorted(
        {
            str(row.get("fare_product_class"))
            for row in rows
            if row.get("fare_product_class")
            not in (None, "")
        }
    )

    fare_families = sorted(
        {
            str(row.get("fare_family"))
            for row in rows
            if row.get("fare_family")
            not in (None, "")
        }
    )

    print(
        f"  • fare_class values: "
        f"{fare_classes[:15]}"
    )

    print(
        f"  • fare_product_class values: "
        f"{fare_products[:15]}"
    )

    print(
        f"  • fare_family values: "
        f"{fare_families[:15]}"
    )


# ============================================================
# TEST 15 — JOURNEY / FLIGHT IDENTITY
# ============================================================

def audit_identity_fields(rows, failures):
    """Check that journey/flight identity is not completely absent."""

    if not rows:
        return

    missing_flight = sum(
        1
        for row in rows
        if row.get("flight_number")
        in (None, "")
    )

    missing_journey = sum(
        1
        for row in rows
        if row.get("journey_id")
        in (None, "")
    )

    check(
        missing_flight < len(rows),
        (
            "flight_number populated for at least "
            "some observations"
        ),
        failures,
    )

    if missing_journey == len(rows):

        warning(
            "journey_id is empty for every observation. "
            "This needs review before production integration."
        )

    else:

        print(
            "  "
            f"{PASS} journey_id populated for "
            f"{len(rows) - missing_journey}/{len(rows)} "
            "observations"
        )


# ============================================================
# SAMPLE SUMMARY
# ============================================================

def print_sample_summary(rows):
    """Print useful diagnostics."""

    if not rows:
        return

    currencies = sorted(
        {
            str(row.get("currency"))
            for row in rows
            if row.get("currency")
            not in (None, "")
        }
    )

    carriers = sorted(
        {
            str(row.get("carrier_code"))
            for row in rows
            if row.get("carrier_code")
            not in (None, "")
        }
    )

    flight_types = sorted(
        {
            str(row.get("flight_type"))
            for row in rows
            if row.get("flight_type")
            not in (None, "")
        }
    )

    stops = sorted(
        {
            str(row.get("stops"))
            for row in rows
            if row.get("stops")
            not in (None, "")
        }
    )

    print()
    print("  SAMPLE SUMMARY")
    print(
        f"  • observations: {len(rows)}"
    )
    print(
        f"  • currencies: {currencies}"
    )
    print(
        f"  • carriers: {carriers}"
    )
    print(
        f"  • flight_type: {flight_types}"
    )
    print(
        f"  • stops: {stops}"
    )


# ============================================================
# SOURCE AUDIT
# ============================================================

def audit_source(source):
    """Run complete audit for one source."""

    print()
    print("=" * 64)
    print(f"{source.upper()} NORMALIZER AUDIT")
    print("=" * 64)

    failures = []

    raw_path = RAW_FILES[source]
    task = TASKS[source]
    normalizer = NORMALIZERS[source]

    print()
    print(f"Raw file:")
    print(f"  {raw_path}")

    # --------------------------------------------------------
    # LOAD RAW
    # --------------------------------------------------------

    try:

        raw_json = load_json(raw_path)

        print()
        print(
            f"  {PASS} raw JSON loaded"
        )

    except Exception as exc:

        print()
        print(
            f"  {FAIL} raw JSON load failed"
        )
        print(
            f"  Error: {exc}"
        )

        return [
            f"raw JSON load failed: {exc}"
        ]

    # --------------------------------------------------------
    # NORMALIZE
    # --------------------------------------------------------

    try:

        rows = normalizer(
            raw_json,
            task,
        )

        print(
            f"  {PASS} normalizer executed"
        )

    except Exception as exc:

        print()
        print(
            f"  {FAIL} normalizer execution failed"
        )
        print(
            f"  Error: {exc}"
        )

        return [
            f"normalizer execution failed: {exc}"
        ]

    # --------------------------------------------------------
    # CONTRACT TESTS
    # --------------------------------------------------------

    audit_return_type(
        rows,
        failures,
    )

    if not isinstance(rows, list):
        return failures

    audit_observation_count(
        rows,
        failures,
    )

    if not rows:
        return failures

    audit_columns(
        rows,
        failures,
    )

    audit_source_value(
        rows,
        source,
        failures,
    )

    audit_route(
        rows,
        task,
        failures,
    )

    audit_departure_date(
        rows,
        task,
        failures,
    )

    audit_timestamps(
        rows,
        failures,
    )

    audit_lead_time(
        rows,
        failures,
    )

    audit_observation_ids(
        rows,
        failures,
    )

    audit_fare_arithmetic(
        rows,
        failures,
    )

    audit_required_identity(
        rows,
        failures,
    )

    audit_stops(
        rows,
        failures,
    )

    audit_total_fare(
        rows,
        failures,
    )

    audit_identity_fields(
        rows,
        failures,
    )

    # --------------------------------------------------------
    # DIAGNOSTICS
    # --------------------------------------------------------

    audit_fare_information(
        rows,
    )

    print_sample_summary(
        rows,
    )

    return failures


# ============================================================
# MAIN
# ============================================================

def main():

    print()
    print("=" * 64)
    print("APIx NORMALIZER CONTRACT AUDIT")
    print("=" * 64)

    print()
    print(
        f"Canonical schema columns: "
        f"{len(APIX_COLUMNS)}"
    )

    print(
        "Route: DEL -> BOM"
    )

    print(
        "Departure: 2026-09-20"
    )

    print(
        "Target lead time: T+7"
    )

    print()
    print(
        "Database writes: NONE"
    )

    all_failures = {}

    # --------------------------------------------------------
    # RUN ALL THREE SOURCES
    # --------------------------------------------------------

    for source in (
        "airindia",
        "indigo",
        "spicejet",
    ):

        failures = audit_source(
            source
        )

        if failures:
            all_failures[source] = failures

    # --------------------------------------------------------
    # FINAL RESULT
    # --------------------------------------------------------

    print()
    print("=" * 64)
    print("FINAL AUDIT RESULT")
    print("=" * 64)

    if not all_failures:

        print()
        print(
            "ALL NORMALIZER CONTRACT TESTS PASSED ✓"
        )

        print()
        print(
            "The three production normalizers are "
            "contract-compatible with the 45-column "
            "APIx observation schema."
        )

        print()
        print(
            "NEXT:"
        )

        print(
            "1. Review source-specific warnings/diagnostics."
        )

        print(
            "2. Add collection run/task storage."
        )

        print(
            "3. Perform one live scraper -> normalizer "
            "-> database integration test."
        )

        print()

        return 0

    # --------------------------------------------------------
    # FAILURES
    # --------------------------------------------------------

    print()

    for source, failures in all_failures.items():

        print(
            f"{source.upper()}:"
        )

        for failure in failures:

            print(
                f"  {FAIL} {failure}"
            )

        print()

    print(
        f"Sources requiring attention: "
        f"{len(all_failures)}"
    )

    print()

    print(
        "DO NOT start the 2,280-task production run yet."
    )

    print()

    return 1


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    raise SystemExit(
        main()
    )
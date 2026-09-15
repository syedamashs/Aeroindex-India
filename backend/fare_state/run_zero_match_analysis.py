from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
import sqlite3
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BACKEND_DIR / "data" / "apix.db"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from run_transition_readiness import get_latest_two_successful_runs


OBSERVATION_COLUMNS = (
    "observation_id, source, route_id, target_lead_days, "
    "departure_datetime, arrival_datetime, carrier_code, flight_number, "
    "flight_id, journey_id, fare_availability_key, source_offer_id"
)


def _normalise(value):
    return "" if value is None else str(value).strip().casefold()


def _format_key(value):
    return "".join(character for character in _normalise(value) if character.isalnum())


def _parse_timestamp(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _calendar_date(value):
    parsed = _parse_timestamp(value)
    return parsed.date().isoformat() if parsed else None


def _values(rows, field):
    return sorted(
        {str(row[field]).strip() for row in rows if row[field] not in (None, "")},
        key=str.casefold,
    )


def _flight_numbers(rows):
    return _values(rows, "flight_number")


def _group_key(row):
    return (
        _normalise(row["source"]),
        _normalise(row["route_id"]),
        row["target_lead_days"],
        _calendar_date(row["departure_datetime"]),
        _normalise(row["carrier_code"]),
    )


def _group_rows(rows):
    grouped = defaultdict(list)
    for row in rows:
        key = _group_key(row)
        if all((key[0], key[1], key[3], key[4])) and key[2] is not None:
            grouped[key].append(row)
    return grouped


def _percentage(numerator, denominator):
    return round(numerator * 100.0 / denominator, 2) if denominator else 0.0


def _classify_group(previous_rows, current_rows):
    previous_numbers = _flight_numbers(previous_rows)
    current_numbers = _flight_numbers(current_rows)
    categories = []
    explanations = []

    if len(previous_numbers) < len(previous_rows) or len(current_numbers) < len(current_rows):
        categories.append("B")
        explanations.append("flight number missing on one or both sides")

    if {
        _format_key(value) for value in previous_numbers
    } & {
        _format_key(value) for value in current_numbers
    }:
        categories.append("C")
        explanations.append("same apparent flight number with formatting differences")

    previous_flight_ids = {_normalise(row["flight_id"]) for row in previous_rows if row["flight_id"]}
    current_flight_ids = {_normalise(row["flight_id"]) for row in current_rows if row["flight_id"]}
    previous_journey_ids = {_normalise(row["journey_id"]) for row in previous_rows if row["journey_id"]}
    current_journey_ids = {_normalise(row["journey_id"]) for row in current_rows if row["journey_id"]}

    if (previous_flight_ids & current_flight_ids) or (previous_journey_ids & current_journey_ids):
        categories.append("A")
        explanations.append("explicit flight or journey identity is shared but flight number changed")

    elif previous_flight_ids or current_flight_ids or previous_journey_ids or current_journey_ids:
        categories.append("D")
        explanations.append("available flight or journey identities differ")

    elif not categories:
        categories.append("E")
        explanations.append("no explicit flight or journey identity is available")

    return categories, "; ".join(explanations)


def load_observations(connection, run_id):
    return connection.execute(
        f"SELECT {OBSERVATION_COLUMNS} FROM apix_observations WHERE run_id = ?",
        (run_id,),
    ).fetchall()


def analyze_zero_match_groups(previous_rows, current_rows):
    previous_groups = _group_rows(previous_rows)
    current_groups = _group_rows(current_rows)
    failed_groups = []

    for key in sorted(previous_groups.keys() & current_groups.keys(), key=str):
        previous = previous_groups[key]
        current = current_groups[key]
        previous_numbers = _flight_numbers(previous)
        current_numbers = _flight_numbers(current)
        intersection = sorted(
            {_normalise(value) for value in previous_numbers}
            & {_normalise(value) for value in current_numbers}
        )
        if intersection:
            continue

        categories, explanation = _classify_group(previous, current)
        failed_groups.append(
            {
                "source": key[0],
                "route_id": key[1],
                "target_lead_days": key[2],
                "departure_date": key[3],
                "carrier_code": key[4],
                "previous_flight_numbers": previous_numbers,
                "current_flight_numbers": current_numbers,
                "flight_number_intersection": intersection,
                "previous_flight_count": len(previous_numbers),
                "current_flight_count": len(current_numbers),
                "flight_number_overlap_percentage": _percentage(
                    len(intersection),
                    max(len(previous_numbers), len(current_numbers)),
                ),
                "previous_departure_times": _values(previous, "departure_datetime"),
                "current_departure_times": _values(current, "departure_datetime"),
                "previous_arrival_times": _values(previous, "arrival_datetime"),
                "current_arrival_times": _values(current, "arrival_datetime"),
                "flight_id_values": {
                    "previous": _values(previous, "flight_id"),
                    "current": _values(current, "flight_id"),
                },
                "journey_id_values": {
                    "previous": _values(previous, "journey_id"),
                    "current": _values(current, "journey_id"),
                },
                "fare_availability_key_values": {
                    "previous": _values(previous, "fare_availability_key"),
                    "current": _values(current, "fare_availability_key"),
                },
                "source_offer_id_values": {
                    "previous": _values(previous, "source_offer_id"),
                    "current": _values(current, "source_offer_id"),
                },
                "category": categories[0],
                "categories": categories,
                "category_explanation": explanation,
            }
        )

    return failed_groups


def analyze_connection(connection, previous_run, current_run):
    groups = analyze_zero_match_groups(
        load_observations(connection, previous_run),
        load_observations(connection, current_run),
    )
    categories = Counter(
        category
        for group in groups
        for category in group["categories"]
    )
    by_source_lead = Counter(
        (group["source"], group["target_lead_days"])
        for group in groups
    )
    return {
        "previous_run": previous_run,
        "current_run": current_run,
        "matched_date_group_count": len(groups),
        "groups_by_source_lead": dict(by_source_lead),
        "category_counts": dict(sorted(categories.items())),
        "groups": groups,
    }


def _short_values(values, limit=5):
    return values if len(values) <= limit else values[:limit] + [f"... (+{len(values) - limit} more)"]


def print_report(report, representative_limit=10):
    print("ZERO FLIGHT-NUMBER MATCH ANALYSIS")
    print(f"Previous run: {report['previous_run']}")
    print(f"Current run : {report['current_run']}")
    print("Mode: READ ONLY")
    print("Matched-date groups with no exact flight-number match:", report["matched_date_group_count"])
    print("Groups by source/lead:", report["groups_by_source_lead"])
    print("Categories:", report["category_counts"])
    print("\nRepresentative examples:")
    for group in report["groups"][:representative_limit]:
        print(
            {
                "source": group["source"],
                "lead": group["target_lead_days"],
                "route": group["route_id"],
                "date": group["departure_date"],
                "carrier": group["carrier_code"],
                "previous_flights": _short_values(group["previous_flight_numbers"]),
                "current_flights": _short_values(group["current_flight_numbers"]),
                "previous_departures": _short_values(group["previous_departure_times"]),
                "current_departures": _short_values(group["current_departure_times"]),
                "previous_arrivals": _short_values(group["previous_arrival_times"]),
                "current_arrivals": _short_values(group["current_arrival_times"]),
                "flight_ids": group["flight_id_values"],
                "journey_ids": group["journey_id_values"],
                "fare_keys": group["fare_availability_key_values"],
                "offer_ids": group["source_offer_id_values"],
                "category": group["category"],
                "categories": group["categories"],
            }
        )


def main():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    try:
        previous, current = get_latest_two_successful_runs(connection)
        report = analyze_connection(connection, previous["run_id"], current["run_id"])
        print_report(report)
    finally:
        connection.close()


if __name__ == "__main__":
    main()
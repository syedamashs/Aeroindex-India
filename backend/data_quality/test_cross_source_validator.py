from __future__ import annotations

import copy
from decimal import Decimal
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_QUALITY_DIR = PROJECT_ROOT / "backend" / "data_quality"
if str(DATA_QUALITY_DIR) not in sys.path:
    sys.path.insert(0, str(DATA_QUALITY_DIR))

from cross_source_validator import (
    MAX_ARRIVAL_TIME_DIFFERENCE_MINUTES,
    MAX_DEPARTURE_TIME_DIFFERENCE_MINUTES,
    MAX_TIMESTAMP_DIFFERENCE,
    compare_observation_group,
    compare_observations,
)


BASE_OBSERVATION = {
    "source": "airindia",
    "observation_id": "observation_a",
    "origin": "DEL",
    "destination": "BOM",
    "departure_datetime": "2026-09-20T10:00:00+05:30",
    "arrival_datetime": "2026-09-20T12:00:00+05:30",
    "flight_number": "AI123",
    "flight_id": "AI123-DEL-BOM",
    "journey_id": "AI123-DEL-BOM",
    "passenger_type": "ADT",
    "fare_product_class": "ECONOMY",
    "fare_class": "Y",
    "fare_family": "FLEX",
    "search_timestamp": "2026-09-13T10:00:00+00:00",
    "total_fare": 10000,
    "is_sold": False,
}


def observation(**overrides):
    value = dict(BASE_OBSERVATION)
    value.update(overrides)
    return value


def compare(price_a=10000, price_b=10000, **overrides):
    left = observation(total_fare=price_a)
    right = observation(
        source="indigo",
        observation_id="observation_b",
        total_fare=price_b,
    )
    right.update(overrides)
    return compare_observations(left, right)


def test_identical_prices_agree():
    result = compare()
    assert result.status == "AGREE"
    assert result.reason == "PRICES_AGREE"
    assert result.absolute_difference == 0
    assert result.percentage_difference == 0


def test_one_percent_difference_agrees():
    result = compare(price_b=10100)
    assert result.status == "AGREE"
    assert result.percentage_difference == (Decimal("100") / Decimal("10050") * Decimal("100"))


def test_three_percent_difference_is_minor():
    result = compare(price_b=10300)
    assert result.status == "MINOR_DIFFERENCE"
    assert result.reason == "SMALL_PRICE_DIFFERENCE"


def test_more_than_five_percent_is_discrepant():
    result = compare(price_b=10600)
    assert result.status == "DISCREPANT"
    assert result.reason == "MATERIAL_PRICE_DIFFERENCE"
    assert "CROSS_SOURCE_DIFFERENCE_IS_A_DQE_FLAG" in result.warnings


def test_missing_total_fare_is_not_checkable():
    result = compare(price_b=None)
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "MISSING_TOTAL_FARE"


def test_zero_total_fare_is_not_checkable():
    result = compare(price_b=0)
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "INVALID_TOTAL_FARE"


def test_negative_total_fare_is_not_checkable():
    result = compare(price_b=-1)
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "INVALID_TOTAL_FARE"


def test_sold_observation_is_not_checkable():
    result = compare(is_sold=True)
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "SOLD_OR_UNAVAILABLE"


def test_same_source_is_not_checkable():
    result = compare(source="airindia")
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "SAME_SOURCE"


def test_different_departure_dates_do_not_match():
    result = compare(departure_datetime="2026-09-21T10:00:00+05:30")
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "INSUFFICIENT_MATCHING_IDENTITY"


def test_different_flights_do_not_match():
    result = compare(
        flight_number="AI999",
        departure_datetime="2026-09-20T12:00:00+05:30",
        arrival_datetime="2026-09-20T14:30:00+05:30",
    )
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "INSUFFICIENT_MATCHING_IDENTITY"


def test_different_fare_products_do_not_match():
    result = compare(fare_family="PREMIUM")
    assert result.status == "AGREE"


def test_different_airline_flight_numbers_with_matching_schedule_are_comparable():
    result = compare(
        flight_number="6E999",
        departure_datetime="2026-09-20T10:10:00+05:30",
        arrival_datetime="2026-09-20T12:20:00+05:30",
    )
    assert result.status == "AGREE"


def test_schedule_boundary_values_are_comparable():
    result = compare(
        flight_number="6E999",
        departure_datetime="2026-09-20T10:15:00+05:30",
        arrival_datetime="2026-09-20T12:30:00+05:30",
    )
    assert result.status == "AGREE"


def test_schedule_just_outside_departure_boundary_is_not_checkable():
    result = compare(
        flight_number="6E999",
        departure_datetime="2026-09-20T10:16:00+05:30",
        arrival_datetime="2026-09-20T12:30:00+05:30",
    )
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "INSUFFICIENT_MATCHING_IDENTITY"


def test_schedule_just_outside_arrival_boundary_is_not_checkable():
    result = compare(
        flight_number="6E999",
        departure_datetime="2026-09-20T10:15:00+05:30",
        arrival_datetime="2026-09-20T12:31:00+05:30",
    )
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "INSUFFICIENT_MATCHING_IDENTITY"


def test_optional_duration_and_stops_are_compatibility_evidence():
    result = compare(
        duration_minutes=135,
        stops=0,
    )
    assert result.status == "AGREE"


def test_conflicting_duration_rejects_pair():
    left = observation(duration_minutes=135)
    right = observation(
        source="indigo",
        observation_id="observation_b",
        duration_minutes=200,
    )
    result = compare_observations(left, right)
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "INSUFFICIENT_MATCHING_IDENTITY"


def test_different_passenger_types_do_not_match():
    result = compare(passenger_type="CHD")
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "INSUFFICIENT_MATCHING_IDENTITY"


def test_close_timestamps_are_comparable():
    result = compare(search_timestamp="2026-09-13T11:00:00+00:00")
    assert result.status == "AGREE"


def test_timestamps_too_far_apart_are_not_checkable():
    result = compare(
        search_timestamp="2026-09-15T10:00:01+00:00",
    )
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "TIMESTAMP_TOO_FAR_APART"


def test_percentage_difference_is_symmetric():
    forward = compare(price_a=10000, price_b=12000)
    reverse_left = observation(
        source="indigo",
        observation_id="observation_b",
        total_fare=12000,
    )
    reverse_right = observation(
        source="airindia",
        observation_id="observation_a",
        total_fare=10000,
    )
    reverse = compare_observations(reverse_left, reverse_right)
    expected = (Decimal("2000") / Decimal("11000")) * Decimal("100")
    assert forward.percentage_difference == expected
    assert reverse.percentage_difference == expected


def test_group_produces_cross_source_pairs_and_unmatched_results():
    group = [
        observation(total_fare=10000),
        observation(source="indigo", observation_id="indigo_match", total_fare=10100),
        observation(
            source="spicejet",
            observation_id="spice_other_flight",
            flight_number="SG999",
            departure_datetime="2026-09-20T14:00:00+05:30",
            arrival_datetime="2026-09-20T16:00:00+05:30",
            total_fare=10000,
        ),
    ]
    results = compare_observation_group(group)
    assert len(results) == 3
    assert {result.status for result in results} == {"AGREE", "NOT_CHECKABLE"}
    assert sum(result.status == "AGREE" for result in results) == 1
    assert sum(result.reason == "INSUFFICIENT_MATCHING_IDENTITY" for result in results) == 2


def test_group_does_not_include_same_source_pairs():
    group = [observation(), observation(observation_id="airindia_2", total_fare=10100)]
    assert compare_observation_group(group) == []


def test_matching_does_not_mutate_observations():
    left = observation()
    right = observation(source="indigo", observation_id="observation_b", total_fare=10100)
    before_left = copy.deepcopy(left)
    before_right = copy.deepcopy(right)
    compare_observations(left, right)
    assert left == before_left
    assert right == before_right


def test_validator_has_no_database_dependency():
    result = compare()
    assert result.status == "AGREE"
    assert MAX_TIMESTAMP_DIFFERENCE.total_seconds() == 24 * 60 * 60
    assert MAX_DEPARTURE_TIME_DIFFERENCE_MINUTES == 15
    assert MAX_ARRIVAL_TIME_DIFFERENCE_MINUTES == 30


if __name__ == "__main__":
    tests = [
        value
        for name, value in globals().items()
        if name.startswith("test_") and callable(value)
    ]
    for test in tests:
        test()
    print(f"ALL CROSS-SOURCE VALIDATOR TESTS PASSED ({len(tests)} tests)")

from decimal import Decimal

import pytest

from index_engine.index_orchestrator import (
    ComparableObservation,
    calculate_index,
)


def observation(route_id, lead, previous, current, base_weight=1, current_weight=1):
    return ComparableObservation(
        route_id=route_id,
        target_lead_days=lead,
        previous_price=previous,
        current_price=current,
        base_weight=base_weight,
        current_weight=current_weight,
    )


def test_successful_end_to_end_synthetic_calculation():
    result = calculate_index(
        [
            observation("R1", 1, 100, 110),
            observation("R2", 1, 100, 90),
            observation("R1", 7, 100, 105),
            observation("R2", 7, 100, 100),
        ],
        {"R1": 0.4, "R2": 0.6},
        previous_national_index=100,
    )

    assert result.status == "OK"
    assert result.primary_estimator == "JEVONS"
    assert result.national_result.index_relative == Decimal("0.98")
    assert result.national_result.index_level == Decimal("98.00")
    assert result.inflation == pytest.approx(-2.0)
    assert result.robustness.primary_estimator == "JEVONS"
    assert result.coverage["usable_route_count"] == 2
    assert result.coverage["usable_observation_count"] == 2


def test_multiple_lead_times_remain_separate():
    result = calculate_index(
        [
            observation("R1", 1, 100, 110),
            observation("R1", 7, 100, 90),
            observation("R1", 15, 100, 120),
            observation("R1", 30, 100, 105),
            observation("R1", 45, 100, 95),
        ],
        {"R1": 1},
    )

    by_lead = {
        item.lead_time_days: item
        for item in result.lead_time_results
    }

    assert by_lead[1].index_relative == Decimal("1.1")
    assert by_lead[7].index_relative == Decimal("0.9")
    assert by_lead[15].index_relative == Decimal("1.2")
    assert by_lead[30].index_relative == Decimal("1.05")
    assert by_lead[45].index_relative == Decimal("0.95")


def test_primary_and_alternative_estimators_are_present():
    result = calculate_index(
        [observation("R1", 1, 100, 110, 1, 1)],
        {"R1": 1},
    )

    assert result.primary_estimator == "JEVONS"
    assert result.robustness.alternative_estimators == (
        "LASPEYRES",
        "PAASCHE",
        "FISHER",
    )
    assert result.robustness.jevons.valid is True
    assert result.robustness.laspeyres.valid is True
    assert result.robustness.paasche.valid is True
    assert result.robustness.fisher.valid is True


def test_inflation_is_not_checkable_without_previous_index():
    result = calculate_index(
        [observation("R1", 1, 100, 110)],
        {"R1": 1},
    )

    assert result.national_result.index_level == Decimal("110")
    assert result.inflation is None


def test_incomplete_route_coverage_is_reported_without_zero_imputation():
    result = calculate_index(
        [observation("R1", 1, 100, 110)],
        {"R1": 0.4, "R2": 0.6},
    )

    assert result.status == "INSUFFICIENT_DATA"
    assert result.national_result.valid is False
    assert result.national_result.index_level is None
    assert result.coverage["weight_coverage"] == Decimal("0.4")
    assert result.coverage["missing_routes"] == ("R2",)


def test_zero_or_missing_route_weight_is_not_fabricated():
    zero_weight = calculate_index(
        [observation("R1", 1, 100, 110)],
        {"R1": 0},
    )
    missing_weight = calculate_index(
        [observation("R1", 1, 100, 110)],
        {},
    )

    assert zero_weight.status == "INSUFFICIENT_DATA"
    assert zero_weight.national_result.index_level is None
    assert missing_weight.status == "INSUFFICIENT_DATA"
    assert missing_weight.national_result.index_level is None


def test_missing_historical_fare_is_not_fabricated():
    result = calculate_index(
        [observation("R1", 1, None, 110)],
        {"R1": 1},
    )

    assert result.status == "INSUFFICIENT_DATA"
    assert result.national_result.index_level is None
    assert result.inflation is None
    assert result.robustness.data_status == "INSUFFICIENT_DATA"


def test_no_observations_are_not_checkable():
    result = calculate_index([], {"R1": 1})

    assert result.status == "NOT_CHECKABLE"
    assert result.national_result.index_level is None
    assert result.route_results == ()
    assert result.lead_time_results == ()


def test_repeated_execution_is_deterministic():
    observations = [
        observation("R1", 1, 100, 110),
        observation("R2", 1, 100, 90),
    ]

    first = calculate_index(observations, {"R1": 0.4, "R2": 0.6})
    second = calculate_index(observations, {"R1": 0.4, "R2": 0.6})

    assert first == second


def test_lead_time_observations_do_not_affect_national_t1_result():
    base = calculate_index(
        [
            observation("R1", 1, 100, 110),
            observation("R2", 1, 100, 90),
        ],
        {"R1": 0.4, "R2": 0.6},
    )
    with_other_bucket = calculate_index(
        [
            observation("R1", 1, 100, 110),
            observation("R2", 1, 100, 90),
            observation("R1", 7, 100, 500),
            observation("R2", 7, 100, 500),
        ],
        {"R1": 0.4, "R2": 0.6},
    )

    assert base.national_result == with_other_bucket.national_result


def test_five_supported_buckets_can_be_processed():
    result = calculate_index(
        [observation("R1", lead, 100, 100 + lead) for lead in (1, 7, 15, 30, 45)],
        {"R1": 1},
    )

    assert {item.lead_time_days for item in result.lead_time_results} == {
        1, 7, 15, 30, 45
    }


def test_alternative_estimator_data_is_not_invented():
    result = calculate_index(
        [ComparableObservation("R1", 1, 100, 110)],
        {"R1": 1},
    )

    assert result.robustness.jevons.valid is True
    assert result.robustness.laspeyres.valid is False
    assert result.robustness.paasche.valid is False
    assert result.robustness.fisher.valid is False

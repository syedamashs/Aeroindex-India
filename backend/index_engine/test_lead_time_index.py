from decimal import Decimal
import math

import pytest

from index_engine.lead_time_index import (
    LeadTimeObservation,
    SUPPORTED_LEAD_TIMES,
    calculate_lead_time_indices,
)


def observation(route_id, lead_days, relative=1.1, weight="0.041385"):
    return LeadTimeObservation(
        route_id=route_id,
        route_weight=weight,
        target_lead_days=lead_days,
        price_relative=relative,
    )


def weighted_observation(route_id, lead_days, weight="0.041385"):
    return LeadTimeObservation(
        route_id=route_id,
        route_weight=weight,
        target_lead_days=lead_days,
        base_price=100,
        current_price=110,
        base_weight=1,
        current_weight=1,
    )


def result_for(results, route_id, lead_days):
    return next(
        result
        for result in results
        if result.route_id == route_id
        and result.lead_time_days == lead_days
    )


@pytest.mark.parametrize("lead_days", SUPPORTED_LEAD_TIMES)
def test_each_supported_bucket_produces_a_result(lead_days):
    result = result_for(
        calculate_lead_time_indices([observation("R1", lead_days)]),
        "R1",
        lead_days,
    )

    assert result.valid is True
    assert result.index_relative == Decimal("1.1")
    assert result.index_level == Decimal("110.0")


def test_t1_and_t7_are_never_mixed():
    results = calculate_lead_time_indices([
        observation("R1", 1, 1.10),
        observation("R1", 7, 0.90),
    ])

    assert result_for(results, "R1", 1).index_relative == Decimal("1.1")
    assert result_for(results, "R1", 7).index_relative == Decimal("0.9")


def test_all_five_buckets_coexist_independently():
    observations = [observation("R1", lead) for lead in SUPPORTED_LEAD_TIMES]
    results = calculate_lead_time_indices(observations)

    assert [result_for(results, "R1", lead).lead_time_days for lead in SUPPORTED_LEAD_TIMES] == list(SUPPORTED_LEAD_TIMES)


def test_one_bucket_does_not_affect_another():
    first = calculate_lead_time_indices([
        observation("R1", 1, 1.10),
        observation("R1", 7, 0.90),
    ])
    second = calculate_lead_time_indices([
        observation("R1", 1, 1.10),
        observation("R1", 7, 0.90),
        observation("R1", 7, 1.20),
    ])

    assert result_for(first, "R1", 1).index_relative == result_for(second, "R1", 1).index_relative
    assert result_for(first, "R1", 7).index_relative != result_for(second, "R1", 7).index_relative


def test_missing_lead_time_is_invalid():
    results = calculate_lead_time_indices([observation("R1", None)])

    assert len(results) == 1
    assert results[0].valid is False
    assert results[0].reason == "lead_time_missing"


def test_unsupported_lead_time_is_invalid():
    results = calculate_lead_time_indices([observation("R1", 60)])

    assert len(results) == 1
    assert results[0].valid is False
    assert results[0].lead_time_days == 60
    assert results[0].reason == "lead_time_unsupported"


def test_empty_requested_bucket_is_not_checkable():
    results = calculate_lead_time_indices(
        [observation("R1", 1)],
        requested_lead_times=[1, 7],
    )

    missing = result_for(results, "R1", 7)
    assert missing.valid is False
    assert missing.reason == "insufficient_data"


def test_empty_observations_return_no_fabricated_routes():
    assert calculate_lead_time_indices([]) == []


def test_invalid_relative_is_propagated():
    result = result_for(
        calculate_lead_time_indices([observation("R1", 1, 0)]),
        "R1",
        1,
    )

    assert result.valid is False
    assert result.reason == "relative_non_positive_at_index_0"


def test_jevons_matches_existing_module():
    results = calculate_lead_time_indices([
        observation("R1", 1, 1.10),
        observation("R1", 1, 1.05),
    ])
    result = result_for(results, "R1", 1)
    expected = math.sqrt(1.10 * 1.05)

    assert result.estimator == "jevons"
    assert float(result.index_relative) == pytest.approx(expected)


def test_weighted_estimators_match_existing_modules():
    observations = [weighted_observation("R1", 7), weighted_observation("R1", 7)]

    for estimator in ("laspeyres", "paasche", "fisher"):
        result = result_for(
            calculate_lead_time_indices(observations, estimator),
            "R1",
            7,
        )
        assert result.valid is True
        assert result.index_relative == Decimal("1.1")


def test_multiple_routes_and_lead_times_are_independent():
    results = calculate_lead_time_indices([
        observation("R1", 1, 1.10),
        observation("R1", 7, 1.20),
        observation("R2", 1, 0.90),
        observation("R2", 7, 0.80),
    ])

    assert result_for(results, "R1", 1).index_relative == Decimal("1.1")
    assert result_for(results, "R1", 7).index_relative == Decimal("1.2")
    assert result_for(results, "R2", 1).index_relative == Decimal("0.9")
    assert result_for(results, "R2", 7).index_relative == Decimal("0.8")


def test_route_weight_is_metadata_and_precision_is_preserved():
    result = result_for(
        calculate_lead_time_indices([
            observation("R1", 30, Decimal("1.05"), Decimal("0.0413850001")),
        ]),
        "R1",
        30,
    )

    assert result.route_weight == Decimal("0.0413850001")
    assert result.index_relative == Decimal("1.05")


def test_invalid_weighted_input_is_propagated():
    results = calculate_lead_time_indices([
        LeadTimeObservation(
            route_id="R1",
            route_weight=0.1,
            target_lead_days=45,
            base_price=100,
            current_price=110,
            base_weight=-1,
            current_weight=1,
        ),
    ], "laspeyres")

    result = result_for(results, "R1", 45)
    assert result.valid is False
    assert result.reason == "base_weight_negative_at_index_0"

from decimal import Decimal

import pytest

from index_engine.national_index import calculate_national_index
from index_engine.route_index import RouteIndexResult


def route(route_id, weight, relative, estimator="jevons"):
    return RouteIndexResult(
        route_id=route_id,
        route_weight=weight,
        estimator=estimator,
        relative=Decimal(str(relative)),
        index=Decimal(str(relative)) * 100,
        valid=True,
    )


def test_two_route_national_jevons_calculation():
    result = calculate_national_index(
        [route("R1", "0.4", 1.10), route("R2", "0.6", 0.90)],
        {"R1": "0.4", "R2": "0.6"},
    )

    assert result.valid is True
    assert result.index_relative == Decimal("0.98")
    assert result.index_level == Decimal("98.00")
    assert result.expected_route_count == 2
    assert result.usable_route_count == 2
    assert result.weight_coverage == Decimal("1")


def test_primary_estimator_is_jevons():
    result = calculate_national_index(
        [route("R1", 50, 1.10, "jevons"), route("R2", 50, 0.90, "jevons")],
        {"R1": 50, "R2": 50},
    )

    assert result.estimator == "jevons"
    assert result.index_relative == Decimal("1.0")


@pytest.mark.parametrize("estimator", ["laspeyres", "paasche", "fisher"])
def test_other_estimators_are_supported(estimator):
    result = calculate_national_index(
        [route("R1", 0.25, 1.10, estimator), route("R2", 0.75, 0.90, estimator)],
        {"R1": 0.25, "R2": 0.75},
        estimator,
    )

    assert result.valid is True
    assert result.estimator == estimator
    assert result.index_relative == Decimal("0.95")


def test_percentage_weights_are_normalized():
    result = calculate_national_index(
        [route("R1", 40, 1.10), route("R2", 60, 0.90)],
        {"R1": 40, "R2": 60},
    )

    assert result.weight_coverage == Decimal("1")
    assert result.index_relative == Decimal("0.98")


def test_fraction_weights_with_float_rounding_are_normalized():
    result = calculate_national_index(
        [route("R1", 0.1, 1.10), route("R2", 0.2, 0.90), route("R3", 0.7, 1.0)],
        {"R1": 0.1, "R2": 0.2, "R3": 0.7},
    )

    assert result.valid is True
    assert result.weight_coverage == Decimal("1")
    assert result.index_relative == Decimal("0.99")


def test_missing_route_is_not_treated_as_zero():
    result = calculate_national_index(
        [route("R1", 0.4, 1.10)],
        {"R1": 0.4, "R2": 0.6},
        minimum_weight_coverage=0.3,
    )

    assert result.valid is True
    assert result.index_relative == Decimal("1.10")
    assert result.weight_coverage == Decimal("0.4")
    assert result.missing_routes == ("R2",)


def test_partial_coverage_is_reported():
    result = calculate_national_index(
        [route("R1", 0.4, 1.10)],
        {"R1": 0.4, "R2": 0.6},
        minimum_weight_coverage=0.3,
    )

    assert result.expected_route_count == 2
    assert result.usable_route_count == 1
    assert result.status == "OK"
    assert result.missing_routes == ("R2",)


def test_insufficient_coverage_is_not_checkable():
    result = calculate_national_index(
        [route("R1", 0.4, 1.10)],
        {"R1": 0.4, "R2": 0.6},
    )

    assert result.valid is False
    assert result.status == "INSUFFICIENT_COVERAGE"
    assert result.index_relative is None
    assert result.weight_coverage == Decimal("0.4")


def test_empty_routes_are_not_checkable():
    result = calculate_national_index([], {"R1": 1})

    assert result.valid is False
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "no_usable_routes"


def test_route_weight_does_not_affect_other_route():
    first = calculate_national_index(
        [route("R1", 0.2, 1.10), route("R2", 0.8, 0.90)],
        {"R1": 0.2, "R2": 0.8},
    )
    second = calculate_national_index(
        [route("R1", 0.2, 1.10), route("R2", 0.8, 0.90), route("R3", 0.0, 2.0)],
        {"R1": 0.2, "R2": 0.8, "R3": 0.0},
    )

    assert first.index_relative == second.index_relative


def test_national_result_changes_when_route_index_changes():
    lower = calculate_national_index(
        [route("R1", 0.5, 1.0), route("R2", 0.5, 1.0)],
        {"R1": 0.5, "R2": 0.5},
    )
    higher = calculate_national_index(
        [route("R1", 0.5, 1.2), route("R2", 0.5, 1.0)],
        {"R1": 0.5, "R2": 0.5},
    )

    assert lower.index_relative == Decimal("1")
    assert higher.index_relative == Decimal("1.1")


def test_invalid_route_results_are_not_used():
    invalid = RouteIndexResult("R1", Decimal("0.5"), "jevons", None, None, False, "bad")
    result = calculate_national_index(
        [invalid, route("R2", 0.5, 1.0)],
        {"R1": 0.5, "R2": 0.5},
        minimum_weight_coverage=0.4,
    )

    assert result.valid is True
    assert result.usable_route_count == 1
    assert result.missing_routes == ("R1",)
    assert result.index_relative == Decimal("1")


def test_multiple_independent_route_sets():
    first = calculate_national_index(
        [route("A", 0.25, 1.2), route("B", 0.75, 0.8)],
        {"A": 0.25, "B": 0.75},
    )
    second = calculate_national_index(
        [route("C", 0.5, 1.1), route("D", 0.5, 0.9)],
        {"C": 0.5, "D": 0.5},
    )

    assert first.index_relative == Decimal("0.9")
    assert second.index_relative == Decimal("1.0")


def test_invalid_basket_and_estimator_are_reported():
    empty = calculate_national_index([route("R1", 1, 1.0)], {})
    invalid_estimator = calculate_national_index(
        [route("R1", 1, 1.0)],
        {"R1": 1},
        "unknown",
    )

    assert empty.reason == "empty_route_basket"
    assert invalid_estimator.reason == "unsupported_estimator"

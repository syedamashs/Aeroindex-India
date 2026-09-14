from decimal import Decimal
import math

import pytest

from index_engine.route_index import (
    RouteIndexInput,
    calculate_route_index,
)


def jevons_route(route_id="DELHI_MUMBAI", weight="0.041385", relatives=None):
    return RouteIndexInput(
        route_id=route_id,
        route_weight=weight,
        price_relatives=relatives if relatives is not None else [1.10, 1.05, 0.98, 1.08],
    )


def weighted_route(route_id="DELHI_MUMBAI", weight="0.041385"):
    return RouteIndexInput(
        route_id=route_id,
        route_weight=weight,
        base_prices=[100, 200],
        current_prices=[110, 220],
        base_weights=[2, 1],
        current_weights=[1, 1],
    )


def test_jevons_route_result():
    result = calculate_route_index(jevons_route())
    expected = math.prod([1.10, 1.05, 0.98, 1.08]) ** 0.25

    assert result.valid is True
    assert result.estimator == "jevons"
    assert float(result.relative) == pytest.approx(expected)
    assert float(result.index) == pytest.approx(expected * 100)


def test_laspeyres_route_result():
    result = calculate_route_index(weighted_route(), "laspeyres")

    assert result.valid is True
    assert result.relative == Decimal("1.1")
    assert result.index == Decimal("110.0")


def test_paasche_route_result():
    result = calculate_route_index(weighted_route(), "paasche")

    assert result.valid is True
    assert result.relative == Decimal("1.1")
    assert result.index == Decimal("110.0")


def test_fisher_route_result():
    result = calculate_route_index(weighted_route(), "fisher")

    assert result.valid is True
    assert result.relative == Decimal("1.1")
    assert result.index == Decimal("110.0")


def test_route_weight_is_preserved_not_applied():
    result = calculate_route_index(
        jevons_route(weight="0.041385", relatives=[1.10])
    )

    assert result.relative == Decimal("1.10")
    assert result.index == Decimal("110.0")
    assert result.route_weight == Decimal("0.041385")


def test_unchanged_prices():
    result = calculate_route_index(jevons_route(relatives=[1.0, 1.0, 1.0]))

    assert result.relative == Decimal("1")
    assert result.index == Decimal("100")


def test_price_increase_and_decrease():
    increase = calculate_route_index(jevons_route(relatives=[1.10, 1.20]))
    decrease = calculate_route_index(jevons_route(relatives=[0.90, 0.80]))

    assert increase.relative > Decimal("1")
    assert decrease.relative < Decimal("1")


@pytest.mark.parametrize(
    "route, estimator, reason",
    [
        (RouteIndexInput(None, 0.04, price_relatives=[1.1]), "jevons", "route_id_missing"),
        (RouteIndexInput("R1", None, price_relatives=[1.1]), "jevons", "route_weight_missing"),
        (RouteIndexInput("R1", -0.1, price_relatives=[1.1]), "jevons", "route_weight_negative"),
        (RouteIndexInput("R1", 0.1, price_relatives=[]), "jevons", "empty_input"),
        (RouteIndexInput("R1", 0.1, price_relatives=[None]), "jevons", "relative_missing_at_index_0"),
        (RouteIndexInput("R1", 0.1), "jevons", "jevons_input_missing"),
        (RouteIndexInput("R1", 0.1), "unknown", "unsupported_estimator"),
    ],
)
def test_invalid_route_inputs(route, estimator, reason):
    result = calculate_route_index(route, estimator)

    assert result.valid is False
    assert result.relative is None
    assert result.reason == reason


def test_invalid_weighted_observations():
    route = RouteIndexInput(
        "R1",
        0.1,
        base_prices=[100, 200],
        current_prices=[110],
        base_weights=[1, 1],
    )

    result = calculate_route_index(route, "laspeyres")

    assert result.valid is False
    assert result.reason == "length_mismatch"


def test_multiple_independent_routes():
    routes = [
        jevons_route("R1", relatives=[1.10, 1.10]),
        jevons_route("R2", relatives=[0.90, 0.90]),
        jevons_route("R3", relatives=[1.0, 1.0]),
    ]
    results = [calculate_route_index(route) for route in routes]

    assert [result.route_id for result in results] == ["R1", "R2", "R3"]
    assert [result.relative for result in results] == [
        Decimal("1.1"),
        Decimal("0.9"),
        Decimal("1"),
    ]


def test_one_route_does_not_affect_another():
    route_one = jevons_route("R1", relatives=[1.10])
    route_two = jevons_route("R2", relatives=[1.20])

    first_before = calculate_route_index(route_one)
    calculate_route_index(route_two)
    first_after = calculate_route_index(route_one)

    assert first_before.relative == first_after.relative == Decimal("1.1")


def test_route_weight_numeric_precision():
    result = calculate_route_index(
        jevons_route(weight=Decimal("0.0413850001"), relatives=[1.05])
    )

    assert result.route_weight == Decimal("0.0413850001")
    assert result.relative == Decimal("1.05")


def test_estimator_outputs_match_existing_modules():
    route = weighted_route()
    jevons = calculate_route_index(jevons_route(relatives=[1.10]), "jevons")
    laspeyres = calculate_route_index(route, "laspeyres")
    paasche = calculate_route_index(route, "paasche")
    fisher = calculate_route_index(route, "fisher")

    assert jevons.relative == Decimal("1.10")
    assert laspeyres.relative == Decimal("1.1")
    assert paasche.relative == Decimal("1.1")
    assert fisher.relative == Decimal("1.1")

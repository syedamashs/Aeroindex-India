import math

import pytest

from index_engine.inflation import (
    index_change_pct,
    inflation_pct,
    yoy_inflation_pct,
)


def test_positive_period_over_period_inflation():
    assert inflation_pct(110, 100) == pytest.approx(10.0)


def test_negative_period_over_period_inflation():
    assert inflation_pct(90, 100) == pytest.approx(-10.0)


def test_zero_inflation():
    assert inflation_pct(100, 100) == pytest.approx(0.0)


def test_exact_known_percentage_change():
    assert inflation_pct(125, 100) == pytest.approx(25.0)
    assert inflation_pct(100, 125) == pytest.approx(-20.0)


def test_yoy_inflation():
    assert yoy_inflation_pct(120, 100) == pytest.approx(20.0)


def test_unchanged_index_level_is_not_inflation():
    index_level = 100

    assert index_level == 100
    assert inflation_pct(index_level, index_level) == 0.0


@pytest.mark.parametrize(
    "current_index, reference_index",
    [
        (None, 100),
        (100, None),
        (0, 100),
        (100, 0),
        (-1, 100),
        (100, -1),
        (float("nan"), 100),
        (100, float("nan")),
        (float("inf"), 100),
        (100, float("-inf")),
        ("not-an-index", 100),
    ],
)
def test_invalid_or_missing_levels_return_none(current_index, reference_index):
    assert inflation_pct(current_index, reference_index) is None


def test_yoy_missing_historical_period_is_not_fabricated():
    assert yoy_inflation_pct(110, None) is None


def test_zero_reference_never_divides():
    assert index_change_pct(110, 0) is None


def test_precision_is_preserved_without_internal_rounding():
    result = inflation_pct(100.01, 100.00)

    assert result == pytest.approx((100.01 / 100.00 - 1.0) * 100.0)
    assert result != round(result, 0)


def test_period_and_yoy_helpers_share_the_same_change_rule():
    assert inflation_pct(105, 100) == yoy_inflation_pct(105, 100)


def test_multiple_independent_index_series():
    series = [
        (110, 100, 10.0),
        (95, 100, -5.0),
        (100, 100, 0.0),
    ]

    results = [inflation_pct(current, previous) for current, previous, _ in series]

    assert results == pytest.approx([expected for _, _, expected in series])

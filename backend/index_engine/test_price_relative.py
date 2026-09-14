from decimal import Decimal

import pytest

from index_engine.price_relative import calculate_price_relative


def test_unchanged_price():
    result = calculate_price_relative(5000, 5000)

    assert result.valid is True
    assert result.relative == Decimal("1")


def test_price_increase():
    result = calculate_price_relative(5000, 5500)

    assert result.valid is True
    assert result.relative == Decimal("1.1")


def test_price_decrease():
    result = calculate_price_relative(5500, 5000)

    assert result.valid is True
    assert result.relative == pytest.approx(Decimal("0.9090909090909090909090909091"))


def test_missing_previous_price():
    result = calculate_price_relative(None, 5000)

    assert result.valid is False
    assert result.relative is None
    assert result.reason == "previous_price_missing"


def test_missing_current_price():
    result = calculate_price_relative(5000, None)

    assert result.valid is False
    assert result.relative is None
    assert result.reason == "current_price_missing"


@pytest.mark.parametrize(
    "previous_price, current_price, reason",
    [
        (0, 5000, "previous_price_non_positive"),
        (5000, 0, "current_price_non_positive"),
        (-100, 5000, "previous_price_non_positive"),
        (5000, -100, "current_price_non_positive"),
    ],
)
def test_non_positive_prices_are_not_checkable(
    previous_price,
    current_price,
    reason,
):
    result = calculate_price_relative(previous_price, current_price)

    assert result.valid is False
    assert result.relative is None
    assert result.reason == reason


def test_decimal_precision_is_preserved():
    result = calculate_price_relative(
        Decimal("100.00"),
        Decimal("100.01"),
    )

    assert result.valid is True
    assert result.relative == Decimal("1.0001")


def test_invalid_numeric_input_is_not_checkable():
    result = calculate_price_relative("not-a-price", 5000)

    assert result.valid is False
    assert result.relative is None
    assert result.reason == "previous_price_invalid"


def test_multiple_observations_are_independent():
    observations = [
        (5000, 5000, Decimal("1")),
        (5000, 5500, Decimal("1.1")),
        (5500, 5000, Decimal("0.9090909090909090909090909091")),
    ]

    results = [
        calculate_price_relative(previous, current)
        for previous, current, _ in observations
    ]

    assert [result.relative for result in results] == [
        expected for _, _, expected in observations
    ]
    assert all(result.valid for result in results)

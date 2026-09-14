from decimal import Decimal

import pytest

from index_engine.paasche import calculate_paasche_index


def test_simple_known_paasche_example():
    result = calculate_paasche_index(
        [100, 200],
        [110, 220],
        [1, 1],
    )

    assert result.valid is True
    assert result.relative == Decimal("1.1")
    assert result.index == Decimal("110.0")


def test_equal_current_weights():
    result = calculate_paasche_index(
        [100, 200],
        [110, 210],
        [1, 1],
    )

    assert result.relative == Decimal("320") / Decimal("300")


def test_unequal_current_weights():
    result = calculate_paasche_index(
        [100, 200],
        [120, 210],
        [3, 1],
    )

    expected = Decimal("570") / Decimal("500")
    assert result.relative == expected


def test_unchanged_prices_equal_one():
    result = calculate_paasche_index(
        [100, 200, 300],
        [100, 200, 300],
        [1, 2, 3],
    )

    assert result.relative == Decimal("1")
    assert result.index == Decimal("100")


def test_price_increase():
    result = calculate_paasche_index(
        [100, 100],
        [110, 120],
        [1, 1],
    )

    assert result.relative == Decimal("1.15")


def test_price_decrease():
    result = calculate_paasche_index(
        [100, 100],
        [90, 80],
        [1, 1],
    )

    assert result.relative == Decimal("0.85")


@pytest.mark.parametrize(
    "base, current, weights, reason",
    [
        ([100], [110, 120], [1], "length_mismatch"),
        ([100], [110], [], "length_mismatch"),
        ([100], [None], [1], "current_price_missing_at_index_0"),
        ([None], [110], [1], "base_price_missing_at_index_0"),
        ([100], [110], [0], "zero_denominator"),
        ([0], [110], [1], "base_price_non_positive_at_index_0"),
        ([100], [0], [1], "current_price_non_positive_at_index_0"),
        ([100], [110], [None], "current_weight_missing_at_index_0"),
        ([100], [110], [-1], "current_weight_negative_at_index_0"),
        ([100], [110], ["invalid"], "current_weight_invalid_at_index_0"),
    ],
)
def test_invalid_inputs_are_not_checkable(base, current, weights, reason):
    result = calculate_paasche_index(base, current, weights)

    assert result.valid is False
    assert result.relative is None
    assert result.index is None
    assert result.reason == reason


def test_empty_input():
    result = calculate_paasche_index([], [], [])

    assert result.valid is False
    assert result.relative is None
    assert result.reason == "empty_input"


def test_decimal_precision_is_preserved():
    result = calculate_paasche_index(
        [Decimal("100.00"), Decimal("200.00")],
        [Decimal("100.01"), Decimal("199.99")],
        [Decimal("2.00"), Decimal("1.00")],
    )

    expected = Decimal("400.01") / Decimal("400.00")
    assert result.valid is True
    assert result.relative == expected


def test_multiple_independent_datasets():
    datasets = [
        ([100], [110], [1], Decimal("1.1")),
        ([100, 200], [90, 220], [1, 1], Decimal("31") / Decimal("30")),
        ([80, 120, 160], [88, 108, 176], [1, 2, 3], Decimal("1.04")),
    ]

    results = [
        calculate_paasche_index(base, current, weights)
        for base, current, weights, _ in datasets
    ]

    assert [result.relative for result in results] == [
        expected for _, _, _, expected in datasets
    ]
    assert all(result.valid for result in results)

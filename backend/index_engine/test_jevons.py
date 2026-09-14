from decimal import Decimal
import math

import pytest

from index_engine.jevons import calculate_jevons_index


def test_one_relative():
    result = calculate_jevons_index([Decimal("1.10")])

    assert result.valid is True
    assert result.relative == Decimal("1.10")
    assert result.index == Decimal("110.0")


def test_two_relatives():
    result = calculate_jevons_index([Decimal("1.10"), Decimal("0.90")])
    expected = math.sqrt(1.10 * 0.90)

    assert result.valid is True
    assert float(result.relative) == pytest.approx(expected)


def test_several_relatives():
    relatives = [1.10, 1.05, 0.98, 1.08]
    result = calculate_jevons_index(relatives)
    expected = math.prod(relatives) ** (1 / len(relatives))

    assert result.valid is True
    assert float(result.relative) == pytest.approx(expected)


def test_all_unchanged():
    result = calculate_jevons_index([1.0, 1.0, 1.0])

    assert result.valid is True
    assert result.relative == Decimal("1")
    assert result.index == Decimal("100")


def test_index_conversion_is_separate_from_relative():
    result = calculate_jevons_index([Decimal("1.05")])

    assert result.relative == Decimal("1.05")
    assert result.index == Decimal("105.00")


@pytest.mark.parametrize(
    "relatives, reason",
    [
        ([], "empty_input"),
        ([0], "relative_non_positive_at_index_0"),
        ([-1.1], "relative_non_positive_at_index_0"),
        ([1.1, 0], "relative_non_positive_at_index_1"),
        ([1.1, None], "relative_missing_at_index_1"),
        ([1.1, "not-a-relative"], "relative_invalid_at_index_1"),
    ],
)
def test_invalid_or_not_checkable_input(relatives, reason):
    result = calculate_jevons_index(relatives)

    assert result.valid is False
    assert result.relative is None
    assert result.index is None
    assert result.reason == reason


def test_decimal_precision_is_preserved():
    result = calculate_jevons_index(
        [Decimal("1.0001"), Decimal("1.0001")]
    )

    assert result.valid is True
    assert result.relative == Decimal("1.0001")
    assert result.index == Decimal("100.0100")


def test_multiple_independent_groups():
    groups = [
        ([1.10], 1.10),
        ([1.10, 0.90], math.sqrt(0.99)),
        ([1.02, 1.03, 1.01], math.prod([1.02, 1.03, 1.01]) ** (1 / 3)),
    ]

    results = [calculate_jevons_index(relatives) for relatives, _ in groups]

    for result, (_, expected) in zip(results, groups):
        assert result.valid is True
        assert float(result.relative) == pytest.approx(expected)

from decimal import Decimal
import math

import pytest

from index_engine.fisher import calculate_fisher_index
from index_engine.laspeyres import calculate_laspeyres_index
from index_engine.paasche import calculate_paasche_index


def test_known_laspeyres_and_paasche_values():
    result = calculate_fisher_index(Decimal("1.05"), Decimal("1.03"))

    assert result.valid is True
    assert float(result.relative) == pytest.approx(math.sqrt(1.05 * 1.03))


def test_equal_laspeyres_and_paasche_values():
    result = calculate_fisher_index(Decimal("1.08"), Decimal("1.08"))

    assert result.relative == Decimal("1.08")


def test_both_unchanged():
    result = calculate_fisher_index(1, 1)

    assert result.relative == Decimal("1")
    assert result.index == Decimal("100")


def test_increase_case():
    result = calculate_fisher_index(1.10, 1.20)

    assert float(result.relative) == pytest.approx(math.sqrt(1.10 * 1.20))
    assert result.relative > Decimal("1")


def test_decrease_case():
    result = calculate_fisher_index(0.90, 0.80)

    assert float(result.relative) == pytest.approx(math.sqrt(0.90 * 0.80))
    assert result.relative < Decimal("1")


@pytest.mark.parametrize(
    "laspeyres, paasche, reason",
    [
        (None, 1.05, "laspeyres_missing"),
        (1.05, None, "paasche_missing"),
        (0, 1.05, "laspeyres_non_positive"),
        (1.05, 0, "paasche_non_positive"),
        (-1.05, 1.05, "laspeyres_non_positive"),
        (1.05, -1.05, "paasche_non_positive"),
        ("invalid", 1.05, "laspeyres_invalid"),
        (1.05, "invalid", "paasche_invalid"),
    ],
)
def test_invalid_inputs_are_not_checkable(laspeyres, paasche, reason):
    result = calculate_fisher_index(laspeyres, paasche)

    assert result.valid is False
    assert result.relative is None
    assert result.index is None
    assert result.reason == reason


def test_index_form_conversion():
    result = calculate_fisher_index(Decimal("1.05"), Decimal("1.05"))

    assert result.relative == Decimal("1.05")
    assert result.index == Decimal("105.00")


def test_decimal_precision_is_preserved():
    result = calculate_fisher_index(
        Decimal("1.0001"),
        Decimal("1.0001"),
    )

    assert result.relative == Decimal("1.0001")
    assert result.index == Decimal("100.0100")


def test_result_objects_are_accepted():
    laspeyres = calculate_laspeyres_index([100], [105], [1])
    paasche = calculate_paasche_index([100], [103], [1])

    result = calculate_fisher_index(laspeyres, paasche)

    assert result.valid is True
    assert float(result.relative) == pytest.approx(math.sqrt(1.05 * 1.03))


def test_invalid_estimator_result_is_not_checkable():
    invalid_laspeyres = calculate_laspeyres_index([], [], [])

    result = calculate_fisher_index(invalid_laspeyres, Decimal("1.05"))

    assert result.valid is False
    assert result.reason == "laspeyres_invalid"


def test_multiple_independent_cases():
    cases = [
        (Decimal("1.05"), Decimal("1.03")),
        (Decimal("1"), Decimal("1")),
        (Decimal("0.90"), Decimal("0.80")),
    ]

    results = [calculate_fisher_index(left, right) for left, right in cases]

    assert [result.valid for result in results] == [True, True, True]
    assert [float(result.relative) for result in results] == pytest.approx([
        math.sqrt(1.05 * 1.03),
        1.0,
        math.sqrt(0.90 * 0.80),
    ])

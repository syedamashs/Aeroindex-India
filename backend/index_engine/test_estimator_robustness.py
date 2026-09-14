from decimal import Decimal
import math

import pytest

from index_engine.estimator_robustness import (
    MODERATE_THRESHOLD_PCT,
    PRIMARY_ESTIMATOR,
    ROBUST_THRESHOLD_PCT,
    assess_estimator_robustness,
    calculate_estimator_robustness,
)
from index_engine.fisher import calculate_fisher_index
from index_engine.jevons import calculate_jevons_index
from index_engine.laspeyres import calculate_laspeyres_index
from index_engine.paasche import calculate_paasche_index


def test_all_four_estimators_are_available_for_one_dataset():
    result = calculate_estimator_robustness(
        [1.10, 1.05],
        [100, 200],
        [110, 210],
        [1, 1],
        [1, 1],
        usable_observation_count=2,
    )

    assert result.data_status == "COMPLETE"
    assert result.primary_estimator == "JEVONS"
    assert result.usable_observation_count == 2
    assert all(
        estimator.valid
        for estimator in (
            result.jevons,
            result.laspeyres,
            result.paasche,
            result.fisher,
        )
    )


def test_identical_values_have_zero_spread_and_are_robust():
    result = assess_estimator_robustness(1, 1, 1, 1)

    assert result.absolute_spread == Decimal("0")
    assert result.relative_spread_pct == Decimal("0")
    assert result.robustness_status == "ROBUST"


def test_small_difference_is_robust():
    result = assess_estimator_robustness(1, 1.005, 1.003, 1.004)

    assert result.relative_spread_pct <= ROBUST_THRESHOLD_PCT
    assert result.robustness_status == "ROBUST"


def test_moderate_difference_is_reported():
    result = assess_estimator_robustness(1, 1.02, 1.015, 1.01)

    assert result.robustness_status == "MODERATE_DIFFERENCE"
    assert result.relative_spread_pct > ROBUST_THRESHOLD_PCT
    assert result.relative_spread_pct <= MODERATE_THRESHOLD_PCT


def test_high_difference_is_reported():
    result = assess_estimator_robustness(1, 1.04, 1.02, 1.03)

    assert result.robustness_status == "HIGH_DIFFERENCE"
    assert result.relative_spread_pct > MODERATE_THRESHOLD_PCT


@pytest.mark.parametrize(
    "values",
    [
        (None, 1, 1, 1),
        (1, None, 1, 1),
        (1, 1, None, 1),
        (1, 1, 1, None),
        (float("nan"), 1, 1, 1),
        (1, float("inf"), 1, 1),
        (1, 0, 1, 1),
        (1, -1, 1, 1),
    ],
)
def test_missing_invalid_nonfinite_and_nonpositive_values_are_not_checkable(values):
    result = assess_estimator_robustness(*values)

    assert result.data_status == "INSUFFICIENT_DATA"
    assert result.robustness_status == "NOT_CHECKABLE"
    assert result.absolute_spread is None
    assert result.relative_spread_pct is None


def test_primary_estimator_is_always_jevons():
    result = assess_estimator_robustness(1.2, 1.1, 1.0, 1.05)

    assert result.primary_estimator == PRIMARY_ESTIMATOR == "JEVONS"
    assert result.alternative_estimators == (
        "LASPEYRES",
        "PAASCHE",
        "FISHER",
    )


def test_no_zero_imputation_or_fabrication():
    result = assess_estimator_robustness(1.1, None, 1.0, None)

    assert result.laspeyres is None
    assert result.fisher is None
    assert result.relative_spread_pct is None
    assert result.reason is not None


def test_deterministic_repeated_results():
    arguments = ([1.10, 1.05], [100, 200], [110, 210], [1, 1], [1, 1])

    first = calculate_estimator_robustness(*arguments)
    second = calculate_estimator_robustness(*arguments)

    assert first == second


def test_end_to_end_reuses_existing_estimators():
    relatives = [Decimal("1.10"), Decimal("1.05")]
    base_prices = [Decimal("100"), Decimal("200")]
    current_prices = [Decimal("110"), Decimal("210")]
    base_weights = [Decimal("1"), Decimal("1")]
    current_weights = [Decimal("1"), Decimal("1")]

    jevons = calculate_jevons_index(relatives)
    laspeyres = calculate_laspeyres_index(
        base_prices,
        current_prices,
        base_weights,
    )
    paasche = calculate_paasche_index(
        base_prices,
        current_prices,
        current_weights,
    )
    fisher = calculate_fisher_index(laspeyres, paasche)
    report = assess_estimator_robustness(
        jevons,
        laspeyres,
        paasche,
        fisher,
    )

    assert report.jevons == jevons
    assert report.laspeyres == laspeyres
    assert report.paasche == paasche
    assert report.fisher == fisher
    assert report.data_status == "COMPLETE"


def test_spread_formula_is_explicit_and_deterministic():
    result = assess_estimator_robustness(
        Decimal("1.00"),
        Decimal("1.10"),
        Decimal("1.05"),
        Decimal("1.02"),
    )

    assert result.absolute_spread == Decimal("0.10")
    assert result.relative_spread_pct == Decimal("10")


def test_missing_weighted_inputs_do_not_fabricate_alternatives():
    result = calculate_estimator_robustness([1.05, 1.05])

    assert result.jevons.valid is True
    assert result.laspeyres.valid is False
    assert result.paasche.valid is False
    assert result.fisher.valid is False
    assert result.robustness_status == "NOT_CHECKABLE"

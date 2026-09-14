from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Iterable

from index_engine.fisher import calculate_fisher_index
from index_engine.jevons import calculate_jevons_index
from index_engine.laspeyres import calculate_laspeyres_index
from index_engine.paasche import calculate_paasche_index


PRIMARY_ESTIMATOR = "JEVONS"
ROBUST_THRESHOLD_PCT = Decimal("1")
MODERATE_THRESHOLD_PCT = Decimal("3")


@dataclass(frozen=True)
class EstimatorRobustnessResult:
    """Structured comparison of the four prototype estimators."""

    jevons: Any
    laspeyres: Any
    paasche: Any
    fisher: Any
    primary_estimator: str
    alternative_estimators: tuple[str, ...]
    absolute_spread: Decimal | None
    relative_spread_pct: Decimal | None
    robustness_status: str
    data_status: str
    usable_observation_count: int | None = None
    reason: str | None = None


def _relative(value: Any) -> tuple[Decimal | None, str | None]:
    if hasattr(value, "valid") and hasattr(value, "relative"):
        if not value.valid:
            return None, "invalid_estimator"
        value = value.relative

    if value is None or value == "":
        return None, "missing_estimator"
    if isinstance(value, bool):
        return None, "invalid_estimator"

    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None, "invalid_estimator"

    if not number.is_finite():
        return None, "invalid_estimator"
    if number <= 0:
        return None, "non_positive_estimator"

    return number, None


def assess_estimator_robustness(
    jevons: Any,
    laspeyres: Any,
    paasche: Any,
    fisher: Any,
    usable_observation_count: int | None = None,
) -> EstimatorRobustnessResult:
    """Compare already-calculated estimator results without ranking them."""

    estimators = {
        "jevons": jevons,
        "laspeyres": laspeyres,
        "paasche": paasche,
        "fisher": fisher,
    }
    values: dict[str, Decimal] = {}
    invalid_reasons = []

    for name, result in estimators.items():
        value, reason = _relative(result)
        if reason is not None:
            invalid_reasons.append(f"{name}_{reason}")
        else:
            values[name] = value

    if len(values) != 4:
        return EstimatorRobustnessResult(
            jevons=jevons,
            laspeyres=laspeyres,
            paasche=paasche,
            fisher=fisher,
            primary_estimator=PRIMARY_ESTIMATOR,
            alternative_estimators=("LASPEYRES", "PAASCHE", "FISHER"),
            absolute_spread=None,
            relative_spread_pct=None,
            robustness_status="NOT_CHECKABLE",
            data_status="INSUFFICIENT_DATA",
            usable_observation_count=usable_observation_count,
            reason=";".join(invalid_reasons),
        )

    maximum = max(values.values())
    minimum = min(values.values())
    absolute_spread = maximum - minimum
    relative_spread_pct = (maximum / minimum - Decimal("1")) * Decimal("100")

    if relative_spread_pct <= ROBUST_THRESHOLD_PCT:
        status = "ROBUST"
    elif relative_spread_pct <= MODERATE_THRESHOLD_PCT:
        status = "MODERATE_DIFFERENCE"
    else:
        status = "HIGH_DIFFERENCE"

    return EstimatorRobustnessResult(
        jevons=jevons,
        laspeyres=laspeyres,
        paasche=paasche,
        fisher=fisher,
        primary_estimator=PRIMARY_ESTIMATOR,
        alternative_estimators=("LASPEYRES", "PAASCHE", "FISHER"),
        absolute_spread=absolute_spread,
        relative_spread_pct=relative_spread_pct,
        robustness_status=status,
        data_status="COMPLETE",
        usable_observation_count=usable_observation_count,
    )


def calculate_estimator_robustness(
    price_relatives: Iterable[Any],
    base_prices: Iterable[Any] | None = None,
    current_prices: Iterable[Any] | None = None,
    base_weights: Iterable[Any] | None = None,
    current_weights: Iterable[Any] | None = None,
    usable_observation_count: int | None = None,
) -> EstimatorRobustnessResult:
    """Calculate and compare all estimators on one supplied dataset.

    Laspeyres and Paasche remain unavailable unless explicit synthetic base or
    current weights are supplied. No production quantities are inferred.
    """

    jevons = calculate_jevons_index(price_relatives)

    if base_prices is None or current_prices is None or base_weights is None:
        laspeyres = calculate_laspeyres_index([], [], [])
    else:
        laspeyres = calculate_laspeyres_index(
            base_prices,
            current_prices,
            base_weights,
        )

    if base_prices is None or current_prices is None or current_weights is None:
        paasche = calculate_paasche_index([], [], [])
    else:
        paasche = calculate_paasche_index(
            base_prices,
            current_prices,
            current_weights,
        )

    fisher = calculate_fisher_index(laspeyres, paasche)

    return assess_estimator_robustness(
        jevons,
        laspeyres,
        paasche,
        fisher,
        usable_observation_count,
    )

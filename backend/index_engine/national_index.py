from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Iterable, Mapping

from index_engine.route_index import RouteIndexResult


SUPPORTED_ESTIMATORS = {"jevons", "laspeyres", "paasche", "fisher"}
DEFAULT_MINIMUM_WEIGHT_COVERAGE = Decimal("0.5")


@dataclass(frozen=True)
class NationalIndexResult:
    """Weighted national result and explicit route-coverage diagnostics."""

    estimator: str
    index_relative: Decimal | None
    index_level: Decimal | None
    expected_route_count: int
    usable_route_count: int
    weight_coverage: Decimal
    status: str
    valid: bool
    missing_routes: tuple[str, ...] = ()
    reason: str | None = None


def _to_non_negative_decimal(value: Any, field_name: str) -> tuple[Decimal | None, str | None]:
    if value is None or value == "":
        return None, f"{field_name}_missing"
    if isinstance(value, bool):
        return None, f"{field_name}_invalid"
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None, f"{field_name}_invalid"
    if not number.is_finite():
        return None, f"{field_name}_invalid"
    if number < 0:
        return None, f"{field_name}_negative"
    return number, None


def _normalized_weights(
    expected_route_weights: Mapping[Any, Any],
) -> tuple[dict[str, Decimal] | None, str | None]:
    if not expected_route_weights:
        return None, "empty_route_basket"

    parsed: dict[str, Decimal] = {}
    for route_id, value in expected_route_weights.items():
        normalized_id = str(route_id).strip()
        if not normalized_id:
            return None, "route_id_missing"
        if normalized_id in parsed:
            return None, "duplicate_route_id"
        weight, reason = _to_non_negative_decimal(value, "route_weight")
        if reason is not None:
            return None, reason
        parsed[normalized_id] = weight

    total = sum(parsed.values(), Decimal("0"))
    if total == 0:
        return None, "zero_total_route_weight"

    # The project CSV stores percentage-point weights, while synthetic callers
    # may provide proportions. Convert percentages to a common fraction scale.
    scale = Decimal("100") if total > Decimal("1") else Decimal("1")
    return {
        route_id: weight / (total if scale == Decimal("1") else Decimal("100"))
        for route_id, weight in parsed.items()
    }, None


def calculate_national_index(
    route_results: Iterable[RouteIndexResult],
    expected_route_weights: Mapping[Any, Any],
    estimator: str = "jevons",
    minimum_weight_coverage: Any = DEFAULT_MINIMUM_WEIGHT_COVERAGE,
) -> NationalIndexResult:
    """Aggregate usable route indices with authoritative basket weights.

    Missing routes are excluded from both numerator and represented-weight
    denominator; they are never assigned a zero index. Coverage is measured
    against the full expected basket, and below-threshold coverage is invalid.
    """

    normalized_estimator = str(estimator).strip().casefold()
    weights, reason = _normalized_weights(expected_route_weights)
    expected_count = len(expected_route_weights)
    if reason is not None:
        return NationalIndexResult(
            normalized_estimator,
            None,
            None,
            expected_count,
            0,
            Decimal("0"),
            "NOT_CHECKABLE",
            False,
            reason=reason,
        )

    threshold, reason = _to_non_negative_decimal(
        minimum_weight_coverage,
        "minimum_weight_coverage",
    )
    if reason is not None or threshold > Decimal("1"):
        return NationalIndexResult(
            normalized_estimator,
            None,
            None,
            expected_count,
            0,
            Decimal("0"),
            "NOT_CHECKABLE",
            False,
            reason=reason or "minimum_weight_coverage_invalid",
        )

    if normalized_estimator not in SUPPORTED_ESTIMATORS:
        return NationalIndexResult(
            normalized_estimator,
            None,
            None,
            expected_count,
            0,
            Decimal("0"),
            "NOT_CHECKABLE",
            False,
            reason="unsupported_estimator",
        )

    usable: dict[str, RouteIndexResult] = {}
    for route_result in route_results:
        route_id = route_result.route_id
        if (
            route_result.valid
            and route_id is not None
            and str(route_id).strip() in weights
            and route_result.estimator == normalized_estimator
            and route_result.relative is not None
            and str(route_id).strip() not in usable
        ):
            usable[str(route_id).strip()] = route_result

    usable_weight = sum(
        (weights[route_id] for route_id in usable),
        Decimal("0"),
    )
    missing_routes = tuple(
        route_id for route_id in weights if route_id not in usable
    )
    coverage = usable_weight

    if not usable:
        return NationalIndexResult(
            normalized_estimator,
            None,
            None,
            expected_count,
            0,
            coverage,
            "NOT_CHECKABLE",
            False,
            missing_routes,
            "no_usable_routes",
        )

    if coverage < threshold:
        return NationalIndexResult(
            normalized_estimator,
            None,
            None,
            expected_count,
            len(usable),
            coverage,
            "INSUFFICIENT_COVERAGE",
            False,
            missing_routes,
            "weight_coverage_below_threshold",
        )

    represented_total = sum(
        (weights[route_id] for route_id in usable),
        Decimal("0"),
    )
    weighted_relative = sum(
        (
            usable[route_id].relative * weights[route_id]
            for route_id in usable
        ),
        Decimal("0"),
    ) / represented_total

    return NationalIndexResult(
        normalized_estimator,
        weighted_relative,
        weighted_relative * Decimal("100"),
        expected_count,
        len(usable),
        coverage,
        "OK",
        True,
        missing_routes,
    )

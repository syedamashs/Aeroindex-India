from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Iterable

from index_engine.fisher import calculate_fisher_index
from index_engine.jevons import calculate_jevons_index
from index_engine.laspeyres import calculate_laspeyres_index
from index_engine.paasche import calculate_paasche_index


@dataclass(frozen=True)
class RouteIndexInput:
    """Synthetic or validated inputs for one route-level calculation."""

    route_id: Any
    route_weight: Any
    price_relatives: Iterable[Any] | None = None
    base_prices: Iterable[Any] | None = None
    current_prices: Iterable[Any] | None = None
    base_weights: Iterable[Any] | None = None
    current_weights: Iterable[Any] | None = None


@dataclass(frozen=True)
class RouteIndexResult:
    """One route-level result; route weight is metadata, not an applied factor."""

    route_id: str | None
    route_weight: Decimal | None
    estimator: str
    relative: Decimal | None
    index: Decimal | None
    valid: bool
    reason: str | None = None


def _to_weight(value: Any) -> tuple[Decimal | None, str | None]:
    if value is None or value == "":
        return None, "route_weight_missing"
    if isinstance(value, bool):
        return None, "route_weight_invalid"
    try:
        weight = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None, "route_weight_invalid"
    if not weight.is_finite():
        return None, "route_weight_invalid"
    if weight < 0:
        return None, "route_weight_negative"
    return weight, None


def _missing_estimator_input(estimator: str) -> RouteIndexResult:
    return RouteIndexResult(
        None,
        None,
        estimator,
        None,
        None,
        False,
        f"{estimator}_input_missing",
    )


def calculate_route_index(
    route: RouteIndexInput,
    estimator: str = "jevons",
) -> RouteIndexResult:
    """Calculate one route index without applying national route weights."""

    normalized_estimator = str(estimator).strip().casefold()
    if normalized_estimator not in {"jevons", "laspeyres", "paasche", "fisher"}:
        return RouteIndexResult(
            None,
            None,
            normalized_estimator,
            None,
            None,
            False,
            "unsupported_estimator",
        )

    if route.route_id is None or str(route.route_id).strip() == "":
        return RouteIndexResult(
            None,
            None,
            normalized_estimator,
            None,
            None,
            False,
            "route_id_missing",
        )

    route_weight, reason = _to_weight(route.route_weight)
    if reason is not None:
        return RouteIndexResult(
            str(route.route_id),
            None,
            normalized_estimator,
            None,
            None,
            False,
            reason,
        )

    if normalized_estimator == "jevons":
        if route.price_relatives is None:
            return _missing_estimator_input(normalized_estimator)
        calculation = calculate_jevons_index(route.price_relatives)
    elif normalized_estimator == "laspeyres":
        if (
            route.base_prices is None
            or route.current_prices is None
            or route.base_weights is None
        ):
            return _missing_estimator_input(normalized_estimator)
        calculation = calculate_laspeyres_index(
            route.base_prices,
            route.current_prices,
            route.base_weights,
        )
    elif normalized_estimator == "paasche":
        if (
            route.base_prices is None
            or route.current_prices is None
            or route.current_weights is None
        ):
            return _missing_estimator_input(normalized_estimator)
        calculation = calculate_paasche_index(
            route.base_prices,
            route.current_prices,
            route.current_weights,
        )
    else:
        if (
            route.base_prices is None
            or route.current_prices is None
            or route.base_weights is None
            or route.current_weights is None
        ):
            return _missing_estimator_input(normalized_estimator)
        laspeyres = calculate_laspeyres_index(
            route.base_prices,
            route.current_prices,
            route.base_weights,
        )
        paasche = calculate_paasche_index(
            route.base_prices,
            route.current_prices,
            route.current_weights,
        )
        calculation = calculate_fisher_index(laspeyres, paasche)

    return RouteIndexResult(
        route_id=str(route.route_id),
        route_weight=route_weight,
        estimator=normalized_estimator,
        relative=calculation.relative,
        index=calculation.index,
        valid=calculation.valid,
        reason=calculation.reason,
    )

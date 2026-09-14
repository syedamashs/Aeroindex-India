from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Iterable

from index_engine.route_index import RouteIndexInput, calculate_route_index


SUPPORTED_LEAD_TIMES = (1, 7, 15, 30, 45)
SUPPORTED_ESTIMATORS = {"jevons", "laspeyres", "paasche", "fisher"}


@dataclass(frozen=True)
class LeadTimeObservation:
    """One synthetic route observation for one lead-time bucket."""

    route_id: Any
    route_weight: Any
    target_lead_days: Any
    price_relative: Any = None
    base_price: Any = None
    current_price: Any = None
    base_weight: Any = None
    current_weight: Any = None


@dataclass(frozen=True)
class LeadTimeIndexResult:
    """One route/lead-time result; lead time is not a national weight."""

    route_id: str | None
    lead_time_days: int | None
    estimator: str
    index_relative: Decimal | None
    index_level: Decimal | None
    route_weight: Decimal | None
    valid: bool
    reason: str | None = None


def _invalid_result(
    route_id: Any,
    lead_time_days: Any,
    estimator: str,
    reason: str,
    route_weight: Any = None,
) -> LeadTimeIndexResult:
    return LeadTimeIndexResult(
        route_id=(str(route_id) if route_id is not None else None),
        lead_time_days=(
            lead_time_days
            if isinstance(lead_time_days, int)
            and not isinstance(lead_time_days, bool)
            else None
        ),
        estimator=estimator,
        index_relative=None,
        index_level=None,
        route_weight=(
            Decimal(str(route_weight))
            if route_weight not in (None, "")
            else None
        ),
        valid=False,
        reason=reason,
    )


def _group_route_input(
    observations: list[LeadTimeObservation],
    estimator: str,
) -> RouteIndexInput:
    first = observations[0]

    return RouteIndexInput(
        route_id=first.route_id,
        route_weight=first.route_weight,
        price_relatives=(
            [observation.price_relative for observation in observations]
            if estimator == "jevons"
            else None
        ),
        base_prices=(
            [observation.base_price for observation in observations]
            if estimator in {"laspeyres", "paasche", "fisher"}
            else None
        ),
        current_prices=(
            [observation.current_price for observation in observations]
            if estimator in {"laspeyres", "paasche", "fisher"}
            else None
        ),
        base_weights=(
            [observation.base_weight for observation in observations]
            if estimator == "laspeyres" or estimator == "fisher"
            else None
        ),
        current_weights=(
            [observation.current_weight for observation in observations]
            if estimator == "paasche" or estimator == "fisher"
            else None
        ),
    )


def calculate_lead_time_indices(
    observations: Iterable[LeadTimeObservation],
    estimator: str = "jevons",
    requested_lead_times: Iterable[int] | None = None,
) -> list[LeadTimeIndexResult]:
    """Calculate independent route indices for supported lead-time buckets.

    Observations are grouped by route and exact ``target_lead_days``. Route
    weights are carried through as metadata; no national aggregation occurs.
    """

    normalized_estimator = str(estimator).strip().casefold()
    if requested_lead_times is None:
        requested = []
    else:
        requested = list(requested_lead_times)

    observations = list(observations)
    if not observations:
        return []

    grouped: dict[tuple[Any, int], list[LeadTimeObservation]] = {}
    invalid_results: list[LeadTimeIndexResult] = []

    for observation in observations:
        route_id = observation.route_id
        lead_time = observation.target_lead_days

        if lead_time is None or lead_time == "":
            invalid_results.append(
                _invalid_result(
                    route_id,
                    None,
                    normalized_estimator,
                    "lead_time_missing",
                    observation.route_weight,
                )
            )
            continue

        if isinstance(lead_time, bool) or not isinstance(lead_time, int):
            invalid_results.append(
                _invalid_result(
                    route_id,
                    None,
                    normalized_estimator,
                    "lead_time_invalid",
                    observation.route_weight,
                )
            )
            continue

        if lead_time not in SUPPORTED_LEAD_TIMES:
            invalid_results.append(
                _invalid_result(
                    route_id,
                    lead_time,
                    normalized_estimator,
                    "lead_time_unsupported",
                    observation.route_weight,
                )
            )
            continue

        grouped.setdefault((route_id, lead_time), []).append(observation)

    results = list(invalid_results)
    for route_id, lead_time in sorted(
        grouped,
        key=lambda key: (str(key[0]), key[1]),
    ):
        route_observations = grouped[(route_id, lead_time)]
        if normalized_estimator not in SUPPORTED_ESTIMATORS:
            results.append(
                _invalid_result(
                    route_id,
                    lead_time,
                    normalized_estimator,
                    "unsupported_estimator",
                    route_observations[0].route_weight,
                )
            )
            continue

        route_input = _group_route_input(
            route_observations,
            normalized_estimator,
        )
        route_result = calculate_route_index(
            route_input,
            normalized_estimator,
        )
        results.append(
            LeadTimeIndexResult(
                route_id=route_result.route_id,
                lead_time_days=lead_time,
                estimator=normalized_estimator,
                index_relative=route_result.relative,
                index_level=route_result.index,
                route_weight=route_result.route_weight,
                valid=route_result.valid,
                reason=route_result.reason,
            )
        )

    if requested:
        existing = {
            (result.route_id, result.lead_time_days)
            for result in results
        }
        route_ids = sorted(
            {
                str(observation.route_id)
                for observation in observations
                if observation.route_id is not None
            }
        )
        for route_id in route_ids:
            route_observations = [
                observation
                for observation in observations
                if str(observation.route_id) == route_id
            ]
            for lead_time in requested:
                if lead_time not in SUPPORTED_LEAD_TIMES:
                    results.append(
                        _invalid_result(
                            route_id,
                            lead_time,
                            normalized_estimator,
                            "lead_time_unsupported",
                            route_observations[0].route_weight,
                        )
                    )
                elif (route_id, lead_time) not in existing:
                    results.append(
                        _invalid_result(
                            route_id,
                            lead_time,
                            normalized_estimator,
                            "insufficient_data",
                            route_observations[0].route_weight,
                        )
                    )

    return sorted(
        results,
        key=lambda result: (
            "" if result.route_id is None else result.route_id,
            -1 if result.lead_time_days is None else result.lead_time_days,
        ),
    )

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Iterable, Mapping

from index_engine.estimator_robustness import calculate_estimator_robustness
from index_engine.inflation import inflation_pct
from index_engine.lead_time_index import (
    LeadTimeIndexResult,
    LeadTimeObservation,
    calculate_lead_time_indices,
)
from index_engine.national_index import NationalIndexResult, calculate_national_index
from index_engine.price_relative import calculate_price_relative
from index_engine.route_index import RouteIndexResult


PRIMARY_ESTIMATOR = "JEVONS"
SUPPORTED_LEAD_TIMES = (1, 7, 15, 30, 45)


@dataclass(frozen=True)
class ComparableObservation:
    """Prepared synthetic comparable fare pair for orchestration."""

    route_id: Any
    target_lead_days: Any
    previous_price: Any
    current_price: Any
    base_weight: Any = None
    current_weight: Any = None


@dataclass(frozen=True)
class IndexOrchestratorResult:
    status: str
    primary_estimator: str
    route_results: tuple[LeadTimeIndexResult, ...]
    lead_time_results: tuple[LeadTimeIndexResult, ...]
    national_result: NationalIndexResult
    inflation: float | None
    robustness: Any
    coverage: dict[str, Any]
    reason: str | None = None


def _lead_observation(
    observation: ComparableObservation,
    route_weights: Mapping[Any, Any],
    relative: Decimal | None,
) -> LeadTimeObservation:
    return LeadTimeObservation(
        route_id=observation.route_id,
        route_weight=route_weights.get(observation.route_id),
        target_lead_days=observation.target_lead_days,
        price_relative=relative,
        base_price=observation.previous_price,
        current_price=observation.current_price,
        base_weight=observation.base_weight,
        current_weight=observation.current_weight,
    )


def calculate_index(
    observations: Iterable[ComparableObservation],
    route_weights: Mapping[Any, Any],
    previous_national_index: Any = None,
    national_lead_time: int = 1,
) -> IndexOrchestratorResult:
    """Coordinate pure APIx calculations for one prepared synthetic dataset."""

    observations = list(observations)
    relative_results = [
        calculate_price_relative(
            observation.previous_price,
            observation.current_price,
        )
        for observation in observations
    ]

    lead_observations = [
        _lead_observation(
            observation,
            route_weights,
            relative_result.relative if relative_result.valid else None,
        )
        for observation, relative_result in zip(observations, relative_results)
    ]

    lead_time_results = tuple(
        calculate_lead_time_indices(lead_observations, "jevons")
    )
    route_results = tuple(
        result
        for result in lead_time_results
        if result.lead_time_days == national_lead_time
    )

    national_route_results = tuple(
        RouteIndexResult(
            route_id=result.route_id,
            route_weight=result.route_weight,
            estimator=result.estimator,
            relative=result.index_relative,
            index=result.index_level,
            valid=result.valid,
            reason=result.reason,
        )
        for result in route_results
    )

    national_result = calculate_national_index(
        national_route_results,
        route_weights,
        "jevons",
    )

    selected_observations = [
        (observation, relative_result)
        for observation, relative_result in zip(observations, relative_results)
        if observation.target_lead_days == national_lead_time
    ]
    selected_relatives = [
        relative_result.relative if relative_result.valid else None
        for _, relative_result in selected_observations
    ]
    selected_base_prices = [
        observation.previous_price
        for observation, _ in selected_observations
    ]
    selected_current_prices = [
        observation.current_price
        for observation, _ in selected_observations
    ]
    selected_base_weights = [
        observation.base_weight
        for observation, _ in selected_observations
    ]
    selected_current_weights = [
        observation.current_weight
        for observation, _ in selected_observations
    ]

    robustness = calculate_estimator_robustness(
        selected_relatives,
        selected_base_prices,
        selected_current_prices,
        selected_base_weights,
        selected_current_weights,
        usable_observation_count=sum(
            relative_result.valid
            for _, relative_result in selected_observations
        ),
    )

    current_index = national_result.index_level
    inflation = (
        inflation_pct(current_index, previous_national_index)
        if current_index is not None
        else None
    )

    usable_observation_count = sum(
        relative_result.valid
        for _, relative_result in selected_observations
    )
    coverage = {
        "expected_route_count": national_result.expected_route_count,
        "usable_route_count": national_result.usable_route_count,
        "weight_coverage": national_result.weight_coverage,
        "usable_observation_count": usable_observation_count,
        "missing_routes": national_result.missing_routes,
        "status": national_result.status,
        "national_lead_time": national_lead_time,
    }

    if not observations:
        status = "NOT_CHECKABLE"
        reason = "no_observations"
    elif not national_result.valid:
        status = "INSUFFICIENT_DATA"
        reason = national_result.reason or national_result.status
    elif national_lead_time not in SUPPORTED_LEAD_TIMES:
        status = "NOT_CHECKABLE"
        reason = "unsupported_national_lead_time"
    else:
        status = "OK"
        reason = None

    return IndexOrchestratorResult(
        status=status,
        primary_estimator=PRIMARY_ESTIMATOR,
        route_results=route_results,
        lead_time_results=lead_time_results,
        national_result=national_result,
        inflation=inflation,
        robustness=robustness,
        coverage=coverage,
        reason=reason,
    )

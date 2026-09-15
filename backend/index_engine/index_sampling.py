from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from statistics import median
from typing import Any, Iterable, Mapping

from index_engine.production_cohort import (
    ProductionObservation,
    construct_item_key,
    normalize_fare_identity,
)


SUPPORTED_LEAD_TIMES = (1, 7, 15, 30, 45)
EXPLICIT_SOLD_VALUES = {"1", "true", "sold", "unavailable", "unavailable"}
SUCCESS_EXTRACTION_STATUSES = {"", "success", "succeeded", "valid"}


@dataclass(frozen=True)
class Exclusion:
    observation_id: Any
    reason: str
    collection_date: str | None
    route_id: Any
    source: Any
    target_lead_days: Any


@dataclass(frozen=True)
class ItemAggregate:
    item_key: tuple[Any, ...]
    representative_price: Decimal
    observation_ids: tuple[Any, ...]
    duplicate_count: int
    prices: tuple[Decimal, ...]


@dataclass(frozen=True)
class DailySourceSample:
    collection_date: str
    route_id: Any
    source: Any
    target_lead_days: int
    representative_price: Decimal
    eligible_observation_count: int
    unique_item_count: int
    excluded_count: int
    duplicate_observation_count: int
    item_provenance: tuple[ItemAggregate, ...]
    observation_ids: tuple[Any, ...]
    exclusion_reasons: tuple[tuple[str, int], ...]


@dataclass(frozen=True)
class RouteDailySample:
    collection_date: str
    route_id: Any
    target_lead_days: int
    representative_price: Decimal
    source_count: int
    eligible_observation_count: int
    unique_item_count: int
    excluded_count: int
    source_samples: tuple[DailySourceSample, ...]
    provenance_observation_ids: tuple[Any, ...]


def _observation(value: Mapping[str, Any] | ProductionObservation) -> ProductionObservation:
    return value if isinstance(value, ProductionObservation) else ProductionObservation.from_mapping(value)


def _optional_field(value: Mapping[str, Any] | ProductionObservation, field: str) -> Any:
    if isinstance(value, ProductionObservation):
        return getattr(value, field, None)
    return value.get(field)


def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _normalized(value: Any) -> str:
    return _text(value).casefold()


def _parse_datetime(value: Any) -> datetime | None:
    try:
        return datetime.fromisoformat(_text(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _collection_date(observation: ProductionObservation) -> str | None:
    parsed = _parse_datetime(observation.search_timestamp)
    return parsed.date().isoformat() if parsed else None


def _price(value: Any) -> Decimal | None:
    if value in (None, "") or isinstance(value, bool):
        return None
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    if not parsed.is_finite() or parsed <= 0:
        return None
    return parsed


def _is_explicitly_unavailable(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return _normalized(value) in EXPLICIT_SOLD_VALUES


def _cohort_key(observation: ProductionObservation) -> tuple[str | None, str, str, Any]:
    return (
        _collection_date(observation),
        _normalized(observation.route_id),
        _normalized(observation.source),
        observation.target_lead_days,
    )


def _exclusion(observation: ProductionObservation, reason: str) -> Exclusion:
    return Exclusion(
        observation_id=observation.observation_id,
        reason=reason,
        collection_date=_collection_date(observation),
        route_id=observation.route_id,
        source=observation.source,
        target_lead_days=observation.target_lead_days,
    )


def filter_eligible_observations(
    observations: Iterable[Mapping[str, Any] | ProductionObservation],
) -> tuple[tuple[ProductionObservation, ...], tuple[Exclusion, ...]]:
    """Return valid market observations and auditable exclusion records."""

    eligible = []
    exclusions = []
    for value in observations:
        observation = _observation(value)
        if not _normalized(observation.route_id):
            exclusions.append(_exclusion(observation, "route_missing"))
        elif not _normalized(observation.source):
            exclusions.append(_exclusion(observation, "source_missing"))
        elif observation.target_lead_days not in SUPPORTED_LEAD_TIMES:
            exclusions.append(_exclusion(observation, "lead_time_missing_or_unsupported"))
        elif _price(observation.total_fare) is None:
            exclusions.append(_exclusion(observation, "total_fare_missing_invalid_or_non_positive"))
        elif _parse_datetime(observation.departure_datetime) is None:
            exclusions.append(_exclusion(observation, "departure_datetime_missing_or_invalid"))
        elif _is_explicitly_unavailable(_optional_field(value, "is_sold")) or _is_explicitly_unavailable(_optional_field(value, "availability_status")):
            exclusions.append(_exclusion(observation, "sold_or_unavailable"))
        elif normalize_fare_identity(observation) is None:
            exclusions.append(_exclusion(observation, "fare_identity_missing_or_invalid"))
        elif construct_item_key(observation) is None:
            exclusions.append(_exclusion(observation, "flight_identity_missing_or_invalid"))
        else:
            eligible.append(observation)
    return tuple(eligible), tuple(exclusions)


def generate_daily_cohort_groups(
    observations: Iterable[Mapping[str, Any] | ProductionObservation],
) -> dict[tuple[str | None, str, str, Any], tuple[ProductionObservation, ...]]:
    groups = defaultdict(list)
    for value in observations:
        observation = _observation(value)
        groups[_cohort_key(observation)].append(observation)
    return {
        key: tuple(sorted(items, key=lambda item: str(item.observation_id)))
        for key, items in groups.items()
    }


def generate_item_identity(observation: Mapping[str, Any] | ProductionObservation) -> tuple[Any, ...] | None:
    """Use the existing deterministic, date-independent production identity."""

    return construct_item_key(observation)


def deduplicate_daily_cohort(
    observations: Iterable[Mapping[str, Any] | ProductionObservation],
) -> tuple[ItemAggregate, ...]:
    """Collapse duplicate observations by item, using a per-item median price."""

    grouped = defaultdict(list)
    for value in observations:
        observation = _observation(value)
        key = generate_item_identity(observation)
        price = _price(observation.total_fare)
        if key is None or price is None:
            raise ValueError("deduplicate_daily_cohort requires eligible observations")
        grouped[key].append((observation, price))

    aggregates = []
    for key, values in grouped.items():
        prices = tuple(sorted((price for _, price in values)))
        aggregates.append(
            ItemAggregate(
                item_key=key,
                representative_price=Decimal(str(median(prices))),
                observation_ids=tuple(sorted((item.observation_id for item, _ in values), key=str)),
                duplicate_count=max(0, len(values) - 1),
                prices=prices,
            )
        )
    return tuple(sorted(aggregates, key=lambda item: repr(item.item_key)))


def calculate_representative_daily_price(
    item_aggregates: Iterable[ItemAggregate],
) -> Decimal | None:
    """Use the median of unique-item medians, limiting duplicate influence."""

    prices = [item.representative_price for item in item_aggregates]
    if not prices:
        return None
    return Decimal(str(median(sorted(prices))))


def report_exclusion_reasons(exclusions: Iterable[Exclusion]) -> dict[str, int]:
    return dict(sorted(Counter(item.reason for item in exclusions).items()))


def construct_daily_source_samples(
    observations: Iterable[Mapping[str, Any] | ProductionObservation],
) -> tuple[DailySourceSample, ...]:
    """Build one robust daily sample per source/route/lead cohort."""

    values = [_observation(value) for value in observations]
    eligible, exclusions = filter_eligible_observations(values)
    groups = generate_daily_cohort_groups(eligible)
    excluded_by_group = defaultdict(list)
    for exclusion in exclusions:
        excluded_by_group[(exclusion.collection_date, _normalized(exclusion.route_id), _normalized(exclusion.source), exclusion.target_lead_days)].append(exclusion)

    samples = []
    for key, cohort in sorted(groups.items(), key=str):
        aggregates = deduplicate_daily_cohort(cohort)
        representative_price = calculate_representative_daily_price(aggregates)
        if representative_price is None:
            continue
        group_exclusions = excluded_by_group[key]
        samples.append(
            DailySourceSample(
                collection_date=key[0],
                route_id=key[1],
                source=key[2],
                target_lead_days=key[3],
                representative_price=representative_price,
                eligible_observation_count=len(cohort),
                unique_item_count=len(aggregates),
                excluded_count=len(group_exclusions),
                duplicate_observation_count=sum(item.duplicate_count for item in aggregates),
                item_provenance=aggregates,
                observation_ids=tuple(sorted((item.observation_id for item in cohort), key=str)),
                exclusion_reasons=tuple(report_exclusion_reasons(group_exclusions).items()),
            )
        )
    return tuple(samples)


def combine_source_samples_into_route_daily_samples(
    source_samples: Iterable[DailySourceSample],
) -> tuple[RouteDailySample, ...]:
    groups = defaultdict(list)
    for sample in source_samples:
        groups[(sample.collection_date, _normalized(sample.route_id), sample.target_lead_days)].append(sample)

    route_samples = []
    for key, samples in sorted(groups.items(), key=str):
        route_samples.append(
            RouteDailySample(
                collection_date=key[0],
                route_id=key[1],
                target_lead_days=key[2],
                representative_price=Decimal(str(median(sorted(sample.representative_price for sample in samples)))),
                source_count=len(samples),
                eligible_observation_count=sum(sample.eligible_observation_count for sample in samples),
                unique_item_count=sum(sample.unique_item_count for sample in samples),
                excluded_count=sum(sample.excluded_count for sample in samples),
                source_samples=tuple(sorted(samples, key=lambda sample: str(sample.source))),
                provenance_observation_ids=tuple(sorted({observation_id for sample in samples for observation_id in sample.observation_ids}, key=str)),
            )
        )
    return tuple(route_samples)
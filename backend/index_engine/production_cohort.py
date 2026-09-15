from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Iterable, Mapping


REQUIRED_FIELDS = (
    "observation_id",
    "source",
    "route_id",
    "origin",
    "destination",
    "departure_datetime",
    "flight_number",
    "carrier_code",
    "fare_product_class",
    "fare_class",
    "fare_family",
    "fare_availability_key",
    "source_offer_id",
    "total_fare",
    "search_timestamp",
    "target_lead_days",
)


@dataclass(frozen=True)
class ProductionObservation:
    observation_id: Any
    source: Any
    route_id: Any
    origin: Any
    destination: Any
    departure_datetime: Any
    flight_number: Any
    carrier_code: Any
    fare_product_class: Any
    fare_class: Any
    fare_family: Any
    fare_availability_key: Any
    source_offer_id: Any
    total_fare: Any
    search_timestamp: Any
    target_lead_days: Any
    arrival_datetime: Any = None

    @classmethod
    def from_mapping(cls, observation: Mapping[str, Any]) -> "ProductionObservation":
        missing = [field for field in REQUIRED_FIELDS if field not in observation]
        if missing:
            raise ValueError(f"missing observation fields: {', '.join(missing)}")
        return cls(**{field: observation.get(field) for field in REQUIRED_FIELDS}, arrival_datetime=observation.get("arrival_datetime"))


def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _normalized(value: Any) -> str:
    return _text(value).casefold()


def _parse_datetime(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    try:
        parsed = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=None)
    return parsed


def _time_of_day(value: Any) -> str | None:
    parsed = _parse_datetime(value)
    return parsed.time().isoformat(timespec="seconds") if parsed else None


def _calendar_date(value: Any) -> str | None:
    parsed = _parse_datetime(value)
    return parsed.date().isoformat() if parsed else None


def _lead_time(value: Any) -> int | str | None:
    if value in (None, "") or isinstance(value, bool):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return _normalized(value) or None
    return parsed


def normalize_flight_number(value: Any) -> str | None:
    """Normalize a flight number without using schedule or price as identity."""

    normalized = "".join(character for character in _normalized(value) if character.isalnum())
    return normalized or None


def normalize_fare_identity(observation: Mapping[str, Any] | ProductionObservation) -> tuple[Any, ...] | None:
    """Return the strongest available fare identity, or None when unusable."""

    value = _observation(observation)
    availability_key = _normalized(value.fare_availability_key)
    if availability_key:
        return ("availability_key", availability_key)

    offer_id = _normalized(value.source_offer_id)
    if offer_id:
        return ("source_offer_id", offer_id)

    fare_parts = tuple(
        _normalized(getattr(value, field))
        for field in ("fare_product_class", "fare_class", "fare_family")
    )
    if all(fare_parts):
        return ("fare_classification",) + fare_parts
    return None


def _observation(value: Mapping[str, Any] | ProductionObservation) -> ProductionObservation:
    return value if isinstance(value, ProductionObservation) else ProductionObservation.from_mapping(value)


def construct_item_key(observation: Mapping[str, Any] | ProductionObservation) -> tuple[Any, ...] | None:
    """Construct a date-independent deterministic identity for index comparison.

    Flight number is preferred. The fallback requires both scheduled departure
    and arrival times; it never uses price or nearest-flight heuristics.
    """

    item = _observation(observation)
    source = _normalized(item.source)
    route = _normalized(item.route_id)
    carrier = _normalized(item.carrier_code)
    lead_time = _lead_time(item.target_lead_days)
    fare_identity = normalize_fare_identity(item)
    departure_time = _time_of_day(item.departure_datetime)

    if not source or not route or not carrier or lead_time is None or fare_identity is None:
        return None
    if departure_time is None:
        return None

    flight_number = normalize_flight_number(item.flight_number)
    if flight_number:
        return (
            "flight_number",
            source,
            route,
            carrier,
            lead_time,
            flight_number,
            departure_time,
            fare_identity,
        )

    arrival_time = _time_of_day(item.arrival_datetime)
    if arrival_time is None:
        return None
    return (
        "scheduled_time_fallback",
        source,
        route,
        carrier,
        lead_time,
        departure_time,
        arrival_time,
        fare_identity,
    )


def item_key_reason(observation: Mapping[str, Any] | ProductionObservation) -> str | None:
    item = _observation(observation)
    if not _normalized(item.source):
        return "source_missing"
    if not _normalized(item.route_id):
        return "route_missing"
    if _normalized(item.carrier_code) == "":
        return "carrier_missing"
    if _lead_time(item.target_lead_days) is None:
        return "lead_time_missing_or_invalid"
    if _time_of_day(item.departure_datetime) is None:
        return "departure_datetime_missing_or_invalid"
    if normalize_fare_identity(item) is None:
        return "fare_identity_missing_or_invalid"
    if not normalize_flight_number(item.flight_number) and _time_of_day(item.arrival_datetime) is None:
        return "flight_number_missing_and_schedule_fallback_invalid"
    return None


def collection_date(observation: Mapping[str, Any] | ProductionObservation) -> str | None:
    return _calendar_date(_observation(observation).search_timestamp)


def departure_calendar_date(observation: Mapping[str, Any] | ProductionObservation) -> str | None:
    return _calendar_date(_observation(observation).departure_datetime)


def group_daily_cohorts(
    observations: Iterable[Mapping[str, Any] | ProductionObservation],
) -> dict[tuple[str | None, str, str, int | str | None], list[ProductionObservation]]:
    """Group by collection day, source, route, and fixed lead-time bucket."""

    cohorts = defaultdict(list)
    for value in observations:
        item = _observation(value)
        cohorts[(collection_date(item), _normalized(item.source), _normalized(item.route_id), _lead_time(item.target_lead_days))].append(item)
    return dict(cohorts)


def select_observations_for_day(
    observations: Iterable[Mapping[str, Any] | ProductionObservation],
    route_id: Any,
    source: Any,
    target_lead_days: Any,
    day: Any,
) -> list[ProductionObservation]:
    if isinstance(day, datetime):
        requested_day = day.date().isoformat()
    elif isinstance(day, date):
        requested_day = day.isoformat()
    else:
        requested_day = _calendar_date(day)
    requested_lead = _lead_time(target_lead_days)
    return [
        item
        for item in (_observation(value) for value in observations)
        if collection_date(item) == requested_day
        and _normalized(item.route_id) == _normalized(route_id)
        and _normalized(item.source) == _normalized(source)
        and _lead_time(item.target_lead_days) == requested_lead
    ]


def identify_duplicate_item_observations(
    observations: Iterable[Mapping[str, Any] | ProductionObservation],
) -> dict[tuple[Any, ...], tuple[ProductionObservation, ...]]:
    grouped = defaultdict(list)
    for value in observations:
        item = _observation(value)
        key = construct_item_key(item)
        if key is not None:
            grouped[key].append(item)
    return {
        key: tuple(items)
        for key, items in grouped.items()
        if len(items) > 1
    }


def comparable_item_keys(
    previous_observations: Iterable[Mapping[str, Any] | ProductionObservation],
    current_observations: Iterable[Mapping[str, Any] | ProductionObservation],
) -> tuple[tuple[Any, ...], ...]:
    previous_keys = {construct_item_key(value) for value in previous_observations}
    current_keys = {construct_item_key(value) for value in current_observations}
    common_keys = previous_keys & current_keys
    common_keys.discard(None)
    return tuple(sorted(common_keys, key=repr))


def compare_adjacent_cohorts(
    previous_observations: Iterable[Mapping[str, Any] | ProductionObservation],
    current_observations: Iterable[Mapping[str, Any] | ProductionObservation],
) -> dict[str, Any]:
    """Match only unique, stable keys across adjacent collection dates."""

    previous = [_observation(value) for value in previous_observations]
    current = [_observation(value) for value in current_observations]
    previous_by_key = defaultdict(list)
    current_by_key = defaultdict(list)
    unmatched = []

    for side, values, grouped in (
        ("previous", previous, previous_by_key),
        ("current", current, current_by_key),
    ):
        for item in values:
            key = construct_item_key(item)
            if key is None:
                unmatched.append({"side": side, "observation_id": item.observation_id, "reason": item_key_reason(item)})
            else:
                grouped[key].append(item)

    matched = []
    for key in sorted(previous_by_key.keys() & current_by_key.keys(), key=repr):
        previous_items = previous_by_key[key]
        current_items = current_by_key[key]
        if len(previous_items) != 1 or len(current_items) != 1:
            for side, items in (("previous", previous_items), ("current", current_items)):
                unmatched.extend(
                    {"side": side, "observation_id": item.observation_id, "reason": "duplicate_item_key"}
                    for item in items
                )
            continue
        matched.append({"item_key": key, "previous": previous_items[0], "current": current_items[0]})

    for side, grouped, other_grouped in (
        ("previous", previous_by_key, current_by_key),
        ("current", current_by_key, previous_by_key),
    ):
        for key, items in grouped.items():
            if key not in other_grouped:
                unmatched.extend(
                    {"side": side, "observation_id": item.observation_id, "reason": "no_matching_item_key"}
                    for item in items
                )

    return {
        "matched": tuple(matched),
        "unmatched": tuple(unmatched),
        "comparable_item_keys": tuple(item["item_key"] for item in matched),
    }


def load_observations(connection: Any, run_id: Any) -> list[ProductionObservation]:
    """Read the production observation fields without writing to the database."""

    columns = ", ".join(REQUIRED_FIELDS + ("arrival_datetime",))
    rows = connection.execute(
        f"SELECT {columns} FROM apix_observations WHERE run_id = ?",
        (run_id,),
    ).fetchall()
    return [ProductionObservation.from_mapping(dict(row)) for row in rows]
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple


@dataclass(frozen=True)
class Observation:
    observation_id: Any
    run_id: Any
    source: Any
    origin: Any
    destination: Any
    departure_datetime: Any
    arrival_datetime: Any
    flight_number: Any
    carrier_code: Any
    flight_id: Any
    journey_id: Any
    fare_product_class: Any
    fare_class: Any
    fare_family: Any
    fare_availability_key: Any
    source_offer_id: Any
    total_fare: Optional[float]
    is_sold: Any
    passenger_type: Any
    search_timestamp: Any
    target_lead_days: Any
    route_id: Any = None


def _norm(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().casefold()


def _float_or_none(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None

    try:
        number = float(value)
        return number
    except (TypeError, ValueError):
        return None


def _parse_dt(value: Any) -> Optional[datetime]:
    if value is None or value == "":
        return None

    text = str(value).strip()

    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _same_calendar_date(a: Any, b: Any) -> bool:
    da = _parse_dt(a)
    db = _parse_dt(b)

    if da is None or db is None:
        return False

    return da.date() == db.date()


def _time_difference_minutes(a: Any, b: Any) -> Optional[float]:
    da = _parse_dt(a)
    db = _parse_dt(b)

    if da is None or db is None:
        return None

    return abs((da - db).total_seconds()) / 60.0


def _compatible_identity(a: Observation, b: Observation) -> bool:
    """
    Conservative comparable-flight logic.

    Priority:
    1. Same route.
    2. Same departure calendar date.
    3. Same carrier when available.
    4. Exact flight number if both available.
    5. Otherwise use departure/arrival timing.
    6. Duration/stops are not required here because the readiness
       layer should avoid rejecting observations unnecessarily.
    """

    if _norm(a.origin) != _norm(b.origin):
        return False

    if _norm(a.destination) != _norm(b.destination):
        return False

    if not _same_calendar_date(
        a.departure_datetime,
        b.departure_datetime,
    ):
        return False

    # Same carrier is strong evidence when available.
    if a.carrier_code and b.carrier_code:
        if _norm(a.carrier_code) != _norm(b.carrier_code):
            return False

    # Exact flight number is strongest.
    if a.flight_number and b.flight_number:
        return _norm(a.flight_number) == _norm(b.flight_number)

    # If flight numbers are unavailable, compare schedule.
    dep_diff = _time_difference_minutes(
        a.departure_datetime,
        b.departure_datetime,
    )

    if dep_diff is None or dep_diff > 15:
        return False

    arr_diff = _time_difference_minutes(
        a.arrival_datetime,
        b.arrival_datetime,
    )

    if arr_diff is not None and arr_diff > 30:
        return False

    return True


def _same_fare_identity(a: Observation, b: Observation) -> bool:
    """
    Fare identity hierarchy.

    Exact availability key is strongest.
    Then source offer ID.
    Then fare product/class/family combination.

    Missing identifiers do not automatically make an observation
    unusable; we fall back to the information that exists.
    """

    if (
        a.fare_availability_key
        and b.fare_availability_key
    ):
        return (
            _norm(a.fare_availability_key)
            == _norm(b.fare_availability_key)
        )

    if a.source_offer_id and b.source_offer_id:
        return (
            _norm(a.source_offer_id)
            == _norm(b.source_offer_id)
        )

    identity_a = (
        _norm(a.fare_product_class),
        _norm(a.fare_class),
        _norm(a.fare_family),
    )

    identity_b = (
        _norm(b.fare_product_class),
        _norm(b.fare_class),
        _norm(b.fare_family),
    )

    # Only use this fallback if there is actually some fare identity.
    if any(identity_a) and any(identity_b):
        return identity_a == identity_b

    return False


def _same_passenger_type(a: Observation, b: Observation) -> bool:
    if a.passenger_type and b.passenger_type:
        return _norm(a.passenger_type) == _norm(b.passenger_type)

    return True


def _same_target_lead_days(a: Observation, b: Observation) -> bool:
    if a.target_lead_days is not None and b.target_lead_days is not None:
        return a.target_lead_days == b.target_lead_days

    return True


def comparable_pair(
    a: Observation,
    b: Observation,
) -> bool:
    """
    Return True when two observations are suitable candidates
    for repeated-snapshot comparison.
    """

    if _norm(a.source) != _norm(b.source):
        return False

    if not _same_passenger_type(a, b):
        return False

    if not _same_target_lead_days(a, b):
        return False

    if not _compatible_identity(a, b):
        return False

    return _same_fare_identity(a, b)


def classify_price_change(
    old_price: Optional[float],
    new_price: Optional[float],
    tolerance_pct: float = 0.01,
) -> str:
    """
    Classify repeated observation price movement.

    tolerance_pct is percentage tolerance, not a fraction.
    """

    if old_price is None or new_price is None:
        return "PRICE_NOT_CHECKABLE"

    if old_price <= 0 or new_price <= 0:
        return "PRICE_NOT_CHECKABLE"

    if old_price == new_price:
        return "UNCHANGED"

    change_pct = abs(new_price - old_price) / old_price * 100.0

    if change_pct <= tolerance_pct:
        return "UNCHANGED"

    if new_price > old_price:
        return "PRICE_INCREASE"

    return "PRICE_DECREASE"


def build_comparison(
    old: Observation,
    new: Observation,
) -> Dict[str, Any]:
    """
    Build a human-readable comparison record.

    This does not write to the database.
    """

    old_price = _float_or_none(old.total_fare)
    new_price = _float_or_none(new.total_fare)

    price_change_pct = None

    if (
        old_price is not None
        and new_price is not None
        and old_price > 0
    ):
        price_change_pct = (
            (new_price - old_price)
            / old_price
            * 100.0
        )

    return {
        "old_observation_id": old.observation_id,
        "new_observation_id": new.observation_id,
        "source": old.source,
        "origin": old.origin,
        "destination": old.destination,
        "departure_datetime": old.departure_datetime,
        "flight_number": old.flight_number or new.flight_number,
        "carrier_code": old.carrier_code or new.carrier_code,
        "fare_product_class": (
            old.fare_product_class
            or new.fare_product_class
        ),
        "fare_class": old.fare_class or new.fare_class,
        "fare_family": old.fare_family or new.fare_family,
        "old_total_fare": old_price,
        "new_total_fare": new_price,
        "price_change_pct": price_change_pct,
        "price_change_type": classify_price_change(
            old_price,
            new_price,
        ),
        "old_search_timestamp": old.search_timestamp,
        "new_search_timestamp": new.search_timestamp,
        "old_is_sold": old.is_sold,
        "new_is_sold": new.is_sold,
    }


def match_repeated_snapshots(
    old_observations: Iterable[Observation],
    new_observations: Iterable[Observation],
) -> Dict[str, Any]:
    """
    Match observations from two separate collection runs.

    Matching is one-to-one: once a new observation is matched to
    an old observation, it cannot be reused.

    This is a readiness diagnostic, not the final transition engine.
    """

    old_list = list(old_observations)
    new_list = list(new_observations)

    used_new = set()
    matches: List[Dict[str, Any]] = []

    for old in old_list:
        best_index = None

        for index, new in enumerate(new_list):
            if index in used_new:
                continue

            if comparable_pair(old, new):
                best_index = index
                break

        if best_index is not None:
            used_new.add(best_index)

            new = new_list[best_index]

            matches.append(
                build_comparison(old, new)
            )

    matched_old_ids = {
        item["old_observation_id"]
        for item in matches
    }

    matched_new_ids = {
        item["new_observation_id"]
        for item in matches
    }

    old_ids = {
        observation.observation_id
        for observation in old_list
    }

    new_ids = {
        observation.observation_id
        for observation in new_list
    }

    return {
        "old_count": len(old_list),
        "new_count": len(new_list),
        "matched_count": len(matches),
        "old_unmatched_count": len(
            old_ids - matched_old_ids
        ),
        "new_unmatched_count": len(
            new_ids - matched_new_ids
        ),
        "comparisons": matches,
    }


def summarize_comparisons(
    comparisons: Iterable[Dict[str, Any]],
) -> Dict[str, int]:
    summary = {
        "matched": 0,
        "unchanged": 0,
        "price_increase": 0,
        "price_decrease": 0,
        "price_not_checkable": 0,
    }

    for item in comparisons:
        summary["matched"] += 1

        change_type = item["price_change_type"]

        if change_type == "UNCHANGED":
            summary["unchanged"] += 1
        elif change_type == "PRICE_INCREASE":
            summary["price_increase"] += 1
        elif change_type == "PRICE_DECREASE":
            summary["price_decrease"] += 1
        else:
            summary["price_not_checkable"] += 1

    return summary
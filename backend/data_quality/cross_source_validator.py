from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from itertools import combinations
import math
from typing import Any, Iterable


AGREE_THRESHOLD_PERCENT = Decimal("2")
MINOR_DIFFERENCE_THRESHOLD_PERCENT = Decimal("5")
MAX_TIMESTAMP_DIFFERENCE = timedelta(hours=24)
MAX_DEPARTURE_TIME_DIFFERENCE_MINUTES = 15
MAX_ARRIVAL_TIME_DIFFERENCE_MINUTES = 30
MAX_DURATION_DIFFERENCE_MINUTES = 30
FARE_PRODUCT_FIELDS = ("fare_product_class", "fare_class", "fare_family")


@dataclass
class CrossSourceResult:
    source_a: str | None
    source_b: str | None
    observation_id_a: str | None
    observation_id_b: str | None
    status: str
    absolute_difference: Decimal | None = None
    percentage_difference: Decimal | None = None
    reason: str | None = None
    warnings: list[str] | None = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


def _text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text.casefold() if text else None


def _source(observation: dict[str, Any]) -> str | None:
    return _text(observation.get("source"))


def _to_decimal(value: Any) -> Decimal | None:
    if value is None or isinstance(value, bool):
        return None

    if isinstance(value, str):
        value = value.strip().replace(",", "").replace("₹", "")
        if not value:
            return None

    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None

    if not number.is_finite():
        return None
    return number


def _is_sold(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return bool(value)

    text = _text(value)
    if text in {"1", "true", "yes", "y", "sold", "sold_out", "unavailable"}:
        return True
    if text in {"0", "false", "no", "n", "available"}:
        return False
    return None


def _calendar_date(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text[:10] if text else None


def _timestamp(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value

    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _time_minutes(value: Any) -> int | None:
    parsed = _timestamp(value)
    if parsed is None:
        return None
    return parsed.hour * 60 + parsed.minute


def _time_difference_minutes(value_a: Any, value_b: Any) -> int | None:
    minutes_a = _time_minutes(value_a)
    minutes_b = _time_minutes(value_b)
    if minutes_a is None or minutes_b is None:
        return None
    difference = abs(minutes_a - minutes_b)
    return min(difference, 1440 - difference)


def _result(
    observation_a: dict[str, Any],
    observation_b: dict[str, Any] | None,
    reason: str,
    warnings: list[str] | None = None,
) -> CrossSourceResult:
    return CrossSourceResult(
        source_a=_source(observation_a),
        source_b=_source(observation_b) if observation_b else None,
        observation_id_a=observation_a.get("observation_id"),
        observation_id_b=observation_b.get("observation_id") if observation_b else None,
        status="NOT_CHECKABLE",
        reason=reason,
        warnings=warnings or [],
    )


def _flight_identity_compatible(
    observation_a: dict[str, Any],
    observation_b: dict[str, Any],
) -> bool:
    flight_number_a = _text(observation_a.get("flight_number"))
    flight_number_b = _text(observation_b.get("flight_number"))
    if flight_number_a and flight_number_b:
        if flight_number_a == flight_number_b:
            return True

    departure_difference = _time_difference_minutes(
        observation_a.get("departure_datetime"),
        observation_b.get("departure_datetime"),
    )
    arrival_difference = _time_difference_minutes(
        observation_a.get("arrival_datetime"),
        observation_b.get("arrival_datetime"),
    )

    return (
        departure_difference is not None
        and arrival_difference is not None
        and departure_difference <= MAX_DEPARTURE_TIME_DIFFERENCE_MINUTES
        and arrival_difference <= MAX_ARRIVAL_TIME_DIFFERENCE_MINUTES
    )


def _fare_product_compatible(
    observation_a: dict[str, Any],
    observation_b: dict[str, Any],
) -> bool:
    # These labels are source-specific in the current canonical data. Without
    # a shared normalized taxonomy, unequal strings are not contradictions.
    return True


def _optional_schedule_compatible(
    observation_a: dict[str, Any],
    observation_b: dict[str, Any],
) -> bool:
    duration_a = _to_decimal(observation_a.get("duration_minutes"))
    duration_b = _to_decimal(observation_b.get("duration_minutes"))
    if (
        duration_a is not None
        and duration_b is not None
        and abs(duration_a - duration_b) > MAX_DURATION_DIFFERENCE_MINUTES
    ):
        return False

    stops_a = observation_a.get("stops")
    stops_b = observation_b.get("stops")
    if stops_a not in (None, "") and stops_b not in (None, ""):
        try:
            if int(stops_a) != int(stops_b):
                return False
        except (TypeError, ValueError):
            pass

    return True


def _timestamps_compatible(
    observation_a: dict[str, Any],
    observation_b: dict[str, Any],
    max_timestamp_difference: timedelta,
) -> bool | None:
    value_a = observation_a.get("search_timestamp")
    value_b = observation_b.get("search_timestamp")
    if value_a in (None, "") or value_b in (None, ""):
        return None

    timestamp_a = _timestamp(value_a)
    timestamp_b = _timestamp(value_b)
    if timestamp_a is None or timestamp_b is None:
        return False

    if timestamp_a.tzinfo is not None and timestamp_b.tzinfo is not None:
        difference = abs(timestamp_a - timestamp_b)
    else:
        difference = abs(timestamp_a.replace(tzinfo=None) - timestamp_b.replace(tzinfo=None))
    return difference <= max_timestamp_difference


def compare_observations(
    observation_a: dict[str, Any],
    observation_b: dict[str, Any],
    max_timestamp_difference: timedelta = MAX_TIMESTAMP_DIFFERENCE,
) -> CrossSourceResult:
    """Compare two observations without mutating either input."""
    if _source(observation_a) == _source(observation_b):
        return _result(observation_a, observation_b, "SAME_SOURCE")

    origin_a = _text(observation_a.get("origin"))
    origin_b = _text(observation_b.get("origin"))
    destination_a = _text(observation_a.get("destination"))
    destination_b = _text(observation_b.get("destination"))
    if not origin_a or not destination_a or origin_a != origin_b or destination_a != destination_b:
        return _result(observation_a, observation_b, "INSUFFICIENT_MATCHING_IDENTITY")

    departure_date_a = _calendar_date(observation_a.get("departure_datetime"))
    departure_date_b = _calendar_date(observation_b.get("departure_datetime"))
    if not departure_date_a or not departure_date_b or departure_date_a != departure_date_b:
        return _result(observation_a, observation_b, "INSUFFICIENT_MATCHING_IDENTITY")

    if not _flight_identity_compatible(observation_a, observation_b):
        return _result(observation_a, observation_b, "INSUFFICIENT_MATCHING_IDENTITY")

    if not _optional_schedule_compatible(observation_a, observation_b):
        return _result(observation_a, observation_b, "INSUFFICIENT_MATCHING_IDENTITY")

    passenger_a = _text(observation_a.get("passenger_type"))
    passenger_b = _text(observation_b.get("passenger_type"))
    if passenger_a and passenger_b and passenger_a != passenger_b:
        return _result(observation_a, observation_b, "INSUFFICIENT_MATCHING_IDENTITY")

    if not _fare_product_compatible(observation_a, observation_b):
        return _result(observation_a, observation_b, "INSUFFICIENT_MATCHING_IDENTITY")

    timestamp_status = _timestamps_compatible(
        observation_a,
        observation_b,
        max_timestamp_difference,
    )
    if timestamp_status is False:
        return _result(observation_a, observation_b, "TIMESTAMP_TOO_FAR_APART")

    if _is_sold(observation_a.get("is_sold")) is True or _is_sold(observation_b.get("is_sold")) is True:
        return _result(observation_a, observation_b, "SOLD_OR_UNAVAILABLE")

    price_a = _to_decimal(observation_a.get("total_fare"))
    price_b = _to_decimal(observation_b.get("total_fare"))
    if price_a is None or price_b is None:
        return _result(observation_a, observation_b, "MISSING_TOTAL_FARE")
    if price_a <= 0 or price_b <= 0:
        return _result(observation_a, observation_b, "INVALID_TOTAL_FARE")

    absolute_difference = abs(price_a - price_b)
    percentage_difference = absolute_difference / ((price_a + price_b) / Decimal("2")) * Decimal("100")

    if percentage_difference <= AGREE_THRESHOLD_PERCENT:
        status = "AGREE"
        reason = "PRICES_AGREE"
    elif percentage_difference <= MINOR_DIFFERENCE_THRESHOLD_PERCENT:
        status = "MINOR_DIFFERENCE"
        reason = "SMALL_PRICE_DIFFERENCE"
    else:
        status = "DISCREPANT"
        reason = "MATERIAL_PRICE_DIFFERENCE"

    return CrossSourceResult(
        source_a=_source(observation_a),
        source_b=_source(observation_b),
        observation_id_a=observation_a.get("observation_id"),
        observation_id_b=observation_b.get("observation_id"),
        status=status,
        absolute_difference=absolute_difference,
        percentage_difference=percentage_difference,
        reason=reason,
        warnings=["CROSS_SOURCE_DIFFERENCE_IS_A_DQE_FLAG"] if status == "DISCREPANT" else [],
    )


def compare_observation_group(
    observations: Iterable[dict[str, Any]],
    max_timestamp_difference: timedelta = MAX_TIMESTAMP_DIFFERENCE,
) -> list[CrossSourceResult]:
    """Return one result for every cross-source pair in the supplied group."""
    observations = list(observations)
    return [
        compare_observations(
            observation_a,
            observation_b,
            max_timestamp_difference=max_timestamp_difference,
        )
        for observation_a, observation_b in combinations(observations, 2)
        if _source(observation_a) != _source(observation_b)
    ]

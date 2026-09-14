from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
import math
from statistics import median
from typing import Any, Iterable


MIN_COMPARISON_SAMPLE = 5
ROBUST_Z_THRESHOLD = 3.5


@dataclass
class OutlierResult:
    observation_id: str | None
    status: str
    method: str | None = None
    reason: str | None = None
    score: float | None = None
    median_fare: float | None = None
    mad: float | None = None
    comparison_count: int = 0
    warnings: list[str] | None = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


def _to_number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None

    if isinstance(value, str):
        value = value.strip().replace(",", "").replace("₹", "")
        if not value:
            return None

    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    return number if math.isfinite(number) else None


def _to_bool(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return bool(value)

    text = str(value).strip().casefold()
    if text in {"1", "true", "yes", "y", "sold", "sold_out", "unavailable"}:
        return True
    if text in {"0", "false", "no", "n", "available"}:
        return False
    return None


def _date_value(observation: dict[str, Any]) -> str | None:
    value = observation.get("departure_date")
    if value is None:
        value = observation.get("departure_datetime")
    if value is None:
        return None

    if isinstance(value, (datetime, date)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()

    text = str(value).strip()
    if not text:
        return None
    return text[:10]


def _calendar_date(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text[:10] if text else None


def _lead_value(observation: dict[str, Any]) -> float | None:
    value = observation.get("target_lead_days")
    if value is None:
        value = observation.get("actual_lead_days")
    explicit_lead = _to_number(value)
    if explicit_lead is not None:
        return explicit_lead

    departure_date = _date_value(observation)
    search_date = _calendar_date(observation.get("search_timestamp"))
    if departure_date is None or search_date is None:
        return None

    try:
        departure = date.fromisoformat(departure_date)
        searched = date.fromisoformat(search_date)
    except ValueError:
        return None

    return float((departure - searched).days)


def _route_key(observation: dict[str, Any]) -> tuple[Any, ...] | None:
    origin = observation.get("origin")
    destination = observation.get("destination")
    if origin not in (None, "") and destination not in (None, ""):
        return ("airports", str(origin).strip().casefold(), str(destination).strip().casefold())

    route_id = observation.get("route_id")
    if route_id not in (None, ""):
        return ("route_id", str(route_id).strip().casefold())
    return None


def _same_group(left: dict[str, Any], right: dict[str, Any]) -> bool:
    left_route = _route_key(left)
    right_route = _route_key(right)
    left_date = _date_value(left)
    right_date = _date_value(right)
    left_lead = _lead_value(left)
    right_lead = _lead_value(right)

    if left_route is None or right_route is None or left_route != right_route:
        return False
    if left_date is None or right_date is None or left_date != right_date:
        return False
    if left_lead is None or right_lead is None or left_lead != right_lead:
        return False
    return True


def _is_eligible_fare(observation: dict[str, Any]) -> bool:
    fare = _to_number(observation.get("total_fare"))
    if fare is None or fare <= 0:
        return False
    return _to_bool(observation.get("is_sold")) is not True


def _result(
    observation: dict[str, Any],
    reason: str,
    warnings: list[str] | None = None,
) -> OutlierResult:
    return OutlierResult(
        observation_id=observation.get("observation_id"),
        status="NOT_CHECKABLE",
        reason=reason,
        warnings=warnings or [],
    )


def validate_outlier(
    observation: dict[str, Any],
    comparison_fares: Iterable[dict[str, Any]],
    min_comparison_sample: int = MIN_COMPARISON_SAMPLE,
    robust_z_threshold: float = ROBUST_Z_THRESHOLD,
) -> OutlierResult:
    """Screen one fare against an economically matched comparison group.

    The function only returns a classification. It never mutates the target,
    comparison observations, or any persistent data.
    """
    target_fare = _to_number(observation.get("total_fare"))
    if target_fare is None or target_fare <= 0:
        return _result(observation, "MISSING_OR_NON_POSITIVE_TOTAL_FARE")

    if _to_bool(observation.get("is_sold")) is True:
        return _result(observation, "SOLD_OR_UNAVAILABLE_FARE")

    try:
        candidates = list(comparison_fares)
    except TypeError:
        return _result(observation, "NO_COMPARISON_DATA")

    base_group = [
        candidate
        for candidate in candidates
        if isinstance(candidate, dict)
        and candidate.get("observation_id") != observation.get("observation_id")
        and _same_group(observation, candidate)
        and _is_eligible_fare(candidate)
    ]

    target_carrier = observation.get("carrier_code") or observation.get("marketing_airline")
    carrier_group = [
        candidate
        for candidate in base_group
        if target_carrier not in (None, "")
        and (candidate.get("carrier_code") or candidate.get("marketing_airline")) == target_carrier
    ]

    if len(carrier_group) >= min_comparison_sample:
        group = carrier_group
        method = "MEDIAN_MAD_SAME_CARRIER"
    elif len(base_group) >= min_comparison_sample:
        group = base_group
        method = "MEDIAN_MAD_CARRIER_FALLBACK"
    else:
        return _result(
            observation,
            "INSUFFICIENT_COMPARISON_SAMPLE",
            warnings=["REQUIRED_MINIMUM_SAMPLE:" + str(min_comparison_sample)],
        )

    fares = [_to_number(candidate.get("total_fare")) for candidate in group]
    fares = [fare for fare in fares if fare is not None]
    if len(fares) < min_comparison_sample:
        return _result(
            observation,
            "INSUFFICIENT_COMPARISON_SAMPLE",
            warnings=["REQUIRED_MINIMUM_SAMPLE:" + str(min_comparison_sample)],
        )

    group_median = float(median(fares))
    deviations = [abs(fare - group_median) for fare in fares]
    group_mad = float(median(deviations))

    if group_mad == 0:
        if target_fare == group_median:
            return OutlierResult(
                observation_id=observation.get("observation_id"),
                status="NORMAL",
                method="MEDIAN_MAD_ZERO_EXACT_MATCH",
                reason="TARGET_EQUALS_IDENTICAL_COMPARISON_FARES",
                score=0.0,
                median_fare=group_median,
                mad=group_mad,
                comparison_count=len(fares),
            )
        return OutlierResult(
            observation_id=observation.get("observation_id"),
            status="SUSPECT",
            method="MEDIAN_MAD_ZERO_DEVIATION",
            reason="TARGET_DIFFERS_FROM_IDENTICAL_COMPARISON_FARES",
            score=None,
            median_fare=group_median,
            mad=group_mad,
            comparison_count=len(fares),
            warnings=["ROBUST_Z_UNDEFINED_WHEN_MAD_ZERO"],
        )

    robust_z = 0.6745 * (target_fare - group_median) / group_mad
    status = "SUSPECT" if abs(robust_z) >= robust_z_threshold else "NORMAL"
    reason = "ROBUST_DEVIATION_ABOVE_THRESHOLD" if status == "SUSPECT" else "ROBUST_DEVIATION_WITHIN_THRESHOLD"

    return OutlierResult(
        observation_id=observation.get("observation_id"),
        status=status,
        method=method,
        reason=reason,
        score=robust_z,
        median_fare=group_median,
        mad=group_mad,
        comparison_count=len(fares),
        warnings=["STATISTICAL_SCREEN_ONLY"] if status == "SUSPECT" else [],
    )


def validate_observations(
    observations: Iterable[dict[str, Any]],
    min_comparison_sample: int = MIN_COMPARISON_SAMPLE,
    robust_z_threshold: float = ROBUST_Z_THRESHOLD,
) -> list[OutlierResult]:
    """Validate each observation against the other observations supplied."""
    observations = list(observations)
    return [
        validate_outlier(
            observation,
            observations,
            min_comparison_sample=min_comparison_sample,
            robust_z_threshold=robust_z_threshold,
        )
        for observation in observations
    ]

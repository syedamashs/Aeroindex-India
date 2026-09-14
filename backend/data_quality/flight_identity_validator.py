from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable


@dataclass
class IdentityResult:
    observation_id: str | None
    status: str
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _is_missing(value: Any) -> bool:
    return value is None or str(value).strip() == ""


def validate_observation(obs: dict[str, Any]) -> IdentityResult:
    observation_id = obs.get("observation_id")

    errors: list[str] = []
    warnings: list[str] = []

    # ---------------------------------------------------------
    # Core route identity
    # ---------------------------------------------------------
    origin = obs.get("origin")
    destination = obs.get("destination")

    if _is_missing(origin):
        errors.append("MISSING_ORIGIN")

    if _is_missing(destination):
        errors.append("MISSING_DESTINATION")

    if not _is_missing(origin) and not _is_missing(destination):
        if str(origin).strip().upper() == str(destination).strip().upper():
            errors.append("ORIGIN_EQUALS_DESTINATION")

    # ---------------------------------------------------------
    # Departure identity
    # ---------------------------------------------------------
    if _is_missing(obs.get("departure_datetime")):
        errors.append("MISSING_DEPARTURE_DATETIME")

    # ---------------------------------------------------------
    # Carrier / flight identity
    # ---------------------------------------------------------
    if _is_missing(obs.get("carrier_code")):
        errors.append("MISSING_CARRIER_CODE")

    if _is_missing(obs.get("flight_number")):
        warnings.append("MISSING_FLIGHT_NUMBER")

    # ---------------------------------------------------------
    # Journey identity
    # ---------------------------------------------------------
    if _is_missing(obs.get("journey_id")):
        warnings.append("MISSING_JOURNEY_ID")

    # ---------------------------------------------------------
    # Fare-offer identity
    # ---------------------------------------------------------
    if _is_missing(obs.get("source_offer_id")):
        warnings.append("MISSING_SOURCE_OFFER_ID")

    if _is_missing(obs.get("fare_availability_key")):
        warnings.append("MISSING_FARE_AVAILABILITY_KEY")

    if _is_missing(obs.get("fare_product_class")):
        warnings.append("MISSING_FARE_PRODUCT_CLASS")

    if _is_missing(obs.get("fare_class")):
        warnings.append("MISSING_FARE_CLASS")

    if _is_missing(obs.get("fare_family")):
        warnings.append("MISSING_FARE_FAMILY")

    # ---------------------------------------------------------
    # Journey structure
    # ---------------------------------------------------------
    stops = obs.get("stops")

    if stops is not None and str(stops).strip() != "":
        try:
            stops_value = int(stops)

            if stops_value < 0:
                errors.append("NEGATIVE_STOPS")

        except (TypeError, ValueError):
            errors.append("INVALID_STOPS")

    # ---------------------------------------------------------
    # Flight identity quality
    # ---------------------------------------------------------
    flight_id = obs.get("flight_id")

    if _is_missing(flight_id):
        warnings.append("MISSING_FLIGHT_ID")

    # ---------------------------------------------------------
    # Final status
    # ---------------------------------------------------------
    if errors:
        status = "INVALID"
    elif warnings:
        status = "VALID_WITH_WARNINGS"
    else:
        status = "VALID"

    return IdentityResult(
        observation_id=observation_id,
        status=status,
        errors=errors,
        warnings=warnings,
    )


def validate_observations(
    observations: Iterable[dict[str, Any]],
) -> list[IdentityResult]:
    return [validate_observation(obs) for obs in observations]


def summarize_results(results: Iterable[IdentityResult]) -> dict[str, Any]:
    results = list(results)

    summary = {
        "total": len(results),
        "valid": 0,
        "valid_with_warnings": 0,
        "invalid": 0,
        "error_counts": {},
        "warning_counts": {},
    }

    for result in results:
        if result.status == "VALID":
            summary["valid"] += 1

        elif result.status == "VALID_WITH_WARNINGS":
            summary["valid_with_warnings"] += 1

        elif result.status == "INVALID":
            summary["invalid"] += 1

        for error in result.errors:
            summary["error_counts"][error] = (
                summary["error_counts"].get(error, 0) + 1
            )

        for warning in result.warnings:
            summary["warning_counts"][warning] = (
                summary["warning_counts"].get(warning, 0) + 1
            )

    return summary
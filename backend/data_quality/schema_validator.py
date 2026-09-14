"""
APIx Data Quality Engine
Canonical + operational schema validation.

Validates the 51 fields stored in apix_observations:
    - 45 canonical airfare observation fields
    - 6 operational collection metadata fields

This module checks schema structure only.
It does NOT perform fare arithmetic, duplicate detection,
outlier detection, or other statistical quality checks.
"""

from __future__ import annotations

from typing import Any, Iterable


# ---------------------------------------------------------------------------
# 45 canonical airfare observation fields
# ---------------------------------------------------------------------------

CANONICAL_FIELDS = (
    "observation_id",
    "source",
    "source_url",
    "search_timestamp",
    "extraction_status",
    "currency",
    "origin",
    "destination",
    "origin_city",
    "destination_city",
    "departure_datetime",
    "arrival_datetime",
    "departure_utc",
    "arrival_utc",
    "duration_minutes",
    "flight_number",
    "carrier_code",
    "marketing_airline",
    "operating_airline",
    "flight_id",
    "journey_id",
    "aircraft_code",
    "stops",
    "flight_type",
    "departure_terminal",
    "arrival_terminal",
    "code_share_indicator",
    "schedule_service_type",
    "fare_product_class",
    "fare_class",
    "fare_family",
    "source_offer_id",
    "fare_availability_key",
    "base_fare",
    "taxes",
    "total_fees",
    "total_fare",
    "is_cheapest_offer",
    "is_sold",
    "filling_fast",
    "service_charges",
    "original_fare_amount",
    "original_published_amount",
    "original_total_discount",
    "passenger_type",
)


# ---------------------------------------------------------------------------
# 6 operational collection fields stored alongside observations
# ---------------------------------------------------------------------------

OPERATIONAL_FIELDS = (
    "run_id",
    "task_id",
    "route_id",
    "target_lead_days",
    "actual_lead_days",
    "created_at",
)


# ---------------------------------------------------------------------------
# Complete stored observation schema = 45 + 6 = 51 fields
# ---------------------------------------------------------------------------

STORED_FIELDS = CANONICAL_FIELDS + OPERATIONAL_FIELDS


def validate_observation(observation: dict[str, Any]) -> dict[str, Any]:
    """
    Validate the structure of one stored APIx observation.

    This function does not modify or delete the observation.
    """

    if not isinstance(observation, dict):
        raise TypeError("observation must be a dictionary")

    fields = set(observation.keys())
    canonical = set(CANONICAL_FIELDS)
    operational = set(OPERATIONAL_FIELDS)
    stored = set(STORED_FIELDS)

    missing_canonical_fields = sorted(canonical - fields)
    missing_operational_fields = sorted(operational - fields)

    unexpected_fields = sorted(fields - stored)

    empty_canonical_identity_fields = [
        field
        for field in (
            "observation_id",
            "source",
            "origin",
            "destination",
            "departure_datetime",
            "flight_number",
            "carrier_code",
        )
        if observation.get(field) is None
    ]

    empty_operational_fields = [
        field
        for field in OPERATIONAL_FIELDS
        if observation.get(field) is None
    ]

    errors: list[str] = []
    warnings: list[str] = []

    if missing_canonical_fields:
        errors.append("MISSING_CANONICAL_FIELDS")

    if unexpected_fields:
        errors.append("UNEXPECTED_FIELDS")

    if empty_canonical_identity_fields:
        errors.append("EMPTY_CANONICAL_IDENTITY_FIELDS")

    if missing_operational_fields:
        warnings.append("MISSING_OPERATIONAL_FIELDS")

    if empty_operational_fields:
        warnings.append("EMPTY_OPERATIONAL_FIELDS")

    if errors:
        validation_status = "INVALID"
    elif warnings:
        validation_status = "VALID_WITH_WARNINGS"
    else:
        validation_status = "VALID"

    return {
        "is_valid": len(errors) == 0,
        "validation_status": validation_status,
        "errors": errors,
        "warnings": warnings,
        "missing_canonical_fields": missing_canonical_fields,
        "missing_operational_fields": missing_operational_fields,
        "unexpected_fields": unexpected_fields,
        "empty_canonical_identity_fields": empty_canonical_identity_fields,
        "empty_operational_fields": empty_operational_fields,
    }


def validate_observations(
    observations: Iterable[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Validate multiple stored APIx observations."""

    return [
        validate_observation(observation)
        for observation in observations
    ]
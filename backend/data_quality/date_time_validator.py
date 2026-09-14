from __future__ import annotations

from datetime import datetime, date
from typing import Any


def parse_datetime(value: Any) -> datetime | None:
    """
    Safely parse common ISO-style datetime values.

    Returns None when the value is missing or cannot be parsed.
    """
    if value is None:
        return None

    if isinstance(value, datetime):
        return value

    value = str(value).strip()

    if not value:
        return None

    # Handle UTC Z suffix.
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"

    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def parse_date(value: Any) -> date | None:
    """
    Safely parse ISO date values.
    """
    if value is None:
        return None

    if isinstance(value, date) and not isinstance(value, datetime):
        return value

    value = str(value).strip()

    if not value:
        return None

    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def validate_datetime_observation(
    observation: dict[str, Any],
) -> dict[str, Any]:
    """
    Validate temporal consistency of one APIx observation.
    """

    observation_id = observation.get("observation_id")

    result = {
        "observation_id": observation_id,
        "status": "VALID",
        "errors": [],
        "warnings": [],
    }

    search_timestamp = parse_datetime(
        observation.get("search_timestamp")
    )

    departure_datetime = parse_datetime(
        observation.get("departure_datetime")
    )

    arrival_datetime = parse_datetime(
        observation.get("arrival_datetime")
    )

    departure_utc = parse_datetime(
        observation.get("departure_utc")
    )

    arrival_utc = parse_datetime(
        observation.get("arrival_utc")
    )

    duration_minutes = observation.get("duration_minutes")
    actual_lead_days = observation.get("actual_lead_days")

    # ---------------------------------------------------------
    # Timestamp parsing
    # ---------------------------------------------------------

    timestamp_fields = {
        "search_timestamp": search_timestamp,
        "departure_datetime": departure_datetime,
        "arrival_datetime": arrival_datetime,
    }

    for field_name, parsed_value in timestamp_fields.items():
        original_value = observation.get(field_name)

        if original_value not in (None, "") and parsed_value is None:
            result["errors"].append(
                f"INVALID_TIMESTAMP:{field_name}"
            )

    # ---------------------------------------------------------
    # Search → departure
    # ---------------------------------------------------------

    if search_timestamp and departure_datetime:

        # Only compare directly when both timestamps have
        # compatible timezone awareness.
        if (
            search_timestamp.tzinfo is None
            and departure_datetime.tzinfo is None
        ) or (
            search_timestamp.tzinfo is not None
            and departure_datetime.tzinfo is not None
        ):
            if departure_datetime < search_timestamp:
                result["errors"].append(
                    "DEPARTURE_BEFORE_SEARCH"
                )

        else:
            result["warnings"].append(
                "TIMEZONE_AWARENESS_MISMATCH:SEARCH_DEPARTURE"
            )

    # ---------------------------------------------------------
    # Departure → arrival
    # ---------------------------------------------------------

    if departure_datetime and arrival_datetime:

        if (
            departure_datetime.tzinfo is None
            and arrival_datetime.tzinfo is None
        ) or (
            departure_datetime.tzinfo is not None
            and arrival_datetime.tzinfo is not None
        ):
            if arrival_datetime <= departure_datetime:
                result["errors"].append(
                    "ARRIVAL_NOT_AFTER_DEPARTURE"
                )

        else:
            result["warnings"].append(
                "TIMEZONE_AWARENESS_MISMATCH:DEPARTURE_ARRIVAL"
            )

    # ---------------------------------------------------------
    # Duration validation
    # ---------------------------------------------------------

    if duration_minutes not in (None, ""):

        try:
            duration = float(duration_minutes)

            if duration <= 0:
                result["errors"].append(
                    "NON_POSITIVE_DURATION"
                )

            if (
                departure_datetime
                and arrival_datetime
                and (
                    departure_datetime.tzinfo
                    == arrival_datetime.tzinfo
                )
            ):
                calculated_duration = (
                    arrival_datetime - departure_datetime
                ).total_seconds() / 60

                # Allow a small tolerance for source rounding.
                if abs(calculated_duration - duration) > 2:
                    result["errors"].append(
                        "DURATION_MISMATCH"
                    )

        except (TypeError, ValueError):
            result["errors"].append(
                "INVALID_DURATION"
            )

    # ---------------------------------------------------------
    # UTC timestamp consistency
    # ---------------------------------------------------------

    if departure_utc and arrival_utc:

        if arrival_utc <= departure_utc:
            result["errors"].append(
                "UTC_ARRIVAL_NOT_AFTER_DEPARTURE"
            )

    # ---------------------------------------------------------
    # Actual lead-time validation
    # ---------------------------------------------------------

    if (
        search_timestamp
        and departure_datetime
        and actual_lead_days not in (None, "")
    ):

        try:
            stored_lead = int(actual_lead_days)

            calculated_lead = (
                departure_datetime.date()
                - search_timestamp.date()
            ).days

            if calculated_lead != stored_lead:
                result["errors"].append(
                    "LEAD_TIME_MISMATCH"
                )

        except (TypeError, ValueError):
            result["errors"].append(
                "INVALID_ACTUAL_LEAD_DAYS"
            )

    # ---------------------------------------------------------
    # Final status
    # ---------------------------------------------------------

    if result["errors"]:
        result["status"] = "INVALID"
    elif result["warnings"]:
        result["status"] = "VALID_WITH_WARNINGS"

    return result


def validate_observations(
    observations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Validate a collection of APIx observations.
    """
    return [
        validate_datetime_observation(observation)
        for observation in observations
    ]
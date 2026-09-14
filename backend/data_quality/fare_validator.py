from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any


DEFAULT_TOLERANCE = Decimal("0.01")


def to_decimal(value: Any) -> Decimal | None:
    """
    Safely convert a monetary value to Decimal.

    Returns None for missing, blank, or non-numeric values.
    """
    if value is None:
        return None

    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None

        # Handle common formatted monetary strings.
        value = value.replace(",", "").replace("₹", "").strip()

    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None


def validate_fare_arithmetic(
    observation: dict[str, Any],
    tolerance: Decimal = DEFAULT_TOLERANCE,
) -> dict[str, Any]:
    """
    Validate:

        base_fare + taxes + total_fees = total_fare

    The validator does not reject observations where the arithmetic
    cannot reasonably be checked, such as sold/unavailable fares
    with missing monetary components.
    """

    observation_id = observation.get("observation_id")

    base_fare = to_decimal(observation.get("base_fare"))
    taxes = to_decimal(observation.get("taxes"))
    total_fees = to_decimal(observation.get("total_fees"))
    total_fare = to_decimal(observation.get("total_fare"))

    result = {
        "observation_id": observation_id,
        "status": "NOT_CHECKABLE",
        "expected_total": None,
        "actual_total": total_fare,
        "difference": None,
        "errors": [],
        "warnings": [],
    }

    # ---------------------------------------------------------
    # Sold / unavailable observation
    # ---------------------------------------------------------
    is_sold = observation.get("is_sold")

    if is_sold in (1, True, "1", "true", "True"):
        result["warnings"].append("SOLD_OR_UNAVAILABLE")
        return result

    # ---------------------------------------------------------
    # Check required monetary components
    # ---------------------------------------------------------
    missing_components = []

    if base_fare is None:
        missing_components.append("base_fare")

    if taxes is None:
        missing_components.append("taxes")

    if total_fees is None:
        missing_components.append("total_fees")

    if total_fare is None:
        missing_components.append("total_fare")

    if missing_components:
        result["warnings"].append(
            "MISSING_FARE_COMPONENTS:" + ",".join(missing_components)
        )
        return result

    # ---------------------------------------------------------
    # Negative monetary values
    # ---------------------------------------------------------
    monetary_values = {
        "base_fare": base_fare,
        "taxes": taxes,
        "total_fees": total_fees,
        "total_fare": total_fare,
    }

    negative_fields = [
        name
        for name, value in monetary_values.items()
        if value < 0
    ]

    if negative_fields:
        result["status"] = "INVALID_ARITHMETIC"
        result["errors"].append(
            "NEGATIVE_FARE_COMPONENTS:" + ",".join(negative_fields)
        )
        return result

    # ---------------------------------------------------------
    # Arithmetic check
    # ---------------------------------------------------------
    expected_total = base_fare + taxes + total_fees
    difference = total_fare - expected_total

    result["expected_total"] = expected_total
    result["difference"] = difference

    if abs(difference) <= tolerance:
        if difference == 0:
            result["status"] = "VALID"
        else:
            result["status"] = "VALID_WITH_TOLERANCE"
            result["warnings"].append("ROUNDING_DIFFERENCE")
    else:
        result["status"] = "INVALID_ARITHMETIC"
        result["errors"].append(
            "TOTAL_FARE_MISMATCH"
        )

    return result


def validate_observations(
    observations: list[dict[str, Any]],
    tolerance: Decimal = DEFAULT_TOLERANCE,
) -> list[dict[str, Any]]:
    """
    Validate a collection of observations.
    """
    return [
        validate_fare_arithmetic(
            observation,
            tolerance=tolerance,
        )
        for observation in observations
    ]
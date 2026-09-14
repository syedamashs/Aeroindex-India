from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable


@dataclass
class SoldOutResult:
    observation_id: str | None
    status: str
    reason: str | None = None
    warnings: list[str] | None = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


def _is_missing(value: Any) -> bool:
    return value is None or str(value).strip() == ""


def _to_bool(value: Any) -> bool | None:
    """
    Convert common database representations into
    True / False.

    Returns None when the value cannot be interpreted.
    """

    if value is None:
        return None

    if isinstance(value, bool):
        return value

    if isinstance(value, int):
        if value == 1:
            return True
        if value == 0:
            return False

    text = str(value).strip().casefold()

    if text in {"1", "true", "yes", "y", "sold", "sold_out"}:
        return True

    if text in {"0", "false", "no", "n", "available"}:
        return False

    return None


def validate_sold_out_status(
    observation: dict[str, Any],
) -> SoldOutResult:

    observation_id = observation.get("observation_id")

    is_sold = _to_bool(observation.get("is_sold"))
    total_fare = observation.get("total_fare")
    extraction_status = observation.get("extraction_status")

    warnings = []

    # ---------------------------------------------------------
    # Explicitly sold / unavailable
    # ---------------------------------------------------------
    if is_sold is True:

        if not _is_missing(total_fare):
            warnings.append(
                "SOLD_BUT_HAS_TOTAL_FARE"
            )

        return SoldOutResult(
            observation_id=observation_id,
            status="SOLD_OUT",
            reason="EXPLICIT_SOLD_FLAG",
            warnings=warnings,
        )

    # ---------------------------------------------------------
    # Explicitly available
    # ---------------------------------------------------------
    if is_sold is False:

        if _is_missing(total_fare):
            return SoldOutResult(
                observation_id=observation_id,
                status="INVALID",
                reason="AVAILABLE_BUT_MISSING_TOTAL_FARE",
                warnings=warnings,
            )

        return SoldOutResult(
            observation_id=observation_id,
            status="AVAILABLE",
            reason="AVAILABLE_WITH_FARE",
            warnings=warnings,
        )

    # ---------------------------------------------------------
    # No interpretable sold flag
    # ---------------------------------------------------------
    if is_sold is None:

        if _is_missing(total_fare):

            warnings.append(
                "SOLD_STATUS_UNKNOWN_AND_NO_FARE"
            )

            return SoldOutResult(
                observation_id=observation_id,
                status="NOT_CHECKABLE",
                reason="NO_SOLD_FLAG_NO_FARE",
                warnings=warnings,
            )

        warnings.append(
            "SOLD_STATUS_UNKNOWN"
        )

        return SoldOutResult(
            observation_id=observation_id,
            status="NOT_CHECKABLE",
            reason="NO_INTERPRETABLE_SOLD_FLAG",
            warnings=warnings,
        )

    # ---------------------------------------------------------
    # Defensive fallback
    # ---------------------------------------------------------
    return SoldOutResult(
        observation_id=observation_id,
        status="NOT_CHECKABLE",
        reason="UNCLASSIFIED",
        warnings=warnings,
    )


def validate_observations(
    observations: Iterable[dict[str, Any]],
) -> list[SoldOutResult]:

    return [
        validate_sold_out_status(observation)
        for observation in observations
    ]
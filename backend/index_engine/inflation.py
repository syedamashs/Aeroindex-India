from __future__ import annotations

import math
from typing import Any


def _positive_finite(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None

    try:
        numeric_value = float(value)
    except (TypeError, ValueError, OverflowError):
        return None

    if not math.isfinite(numeric_value) or numeric_value <= 0:
        return None

    return numeric_value


def index_change_pct(
    current_index: Any,
    reference_index: Any,
) -> float | None:
    """Return percentage change between two positive APIx index levels.

    An APIx index is a level on a fixed base scale. Inflation is the
    percentage change between the current level and a reference level; this
    helper does not redefine or reset the base. Missing historical levels stay
    missing instead of being fabricated or interpolated.
    """

    current = _positive_finite(current_index)
    reference = _positive_finite(reference_index)

    if current is None or reference is None:
        return None

    return (current / reference - 1.0) * 100.0


def inflation_pct(
    current_index: Any,
    previous_index: Any,
) -> float | None:
    """Calculate period-over-period APIx inflation as a percentage."""

    return index_change_pct(current_index, previous_index)


def yoy_inflation_pct(
    current_index: Any,
    index_12_periods_ago: Any,
) -> float | None:
    """Calculate YoY APIx inflation against the level 12 periods earlier.

    The caller must provide the actual historical level. No missing period is
    invented, interpolated, or replaced with the base-period level.
    """

    return index_change_pct(current_index, index_12_periods_ago)

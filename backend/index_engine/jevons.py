from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Iterable


@dataclass(frozen=True)
class JevonsResult:
    """Result of one Jevons geometric-mean calculation."""

    relative: Decimal | None
    index: Decimal | None
    valid: bool
    reason: str | None = None


def _to_positive_decimal(value: Any, position: int) -> tuple[Decimal | None, str | None]:
    if value is None or value == "":
        return None, f"relative_missing_at_index_{position}"

    if isinstance(value, bool):
        return None, f"relative_invalid_at_index_{position}"

    try:
        relative = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None, f"relative_invalid_at_index_{position}"

    if not relative.is_finite():
        return None, f"relative_invalid_at_index_{position}"

    if relative <= 0:
        return None, f"relative_non_positive_at_index_{position}"

    return relative, None


def calculate_jevons_index(
    relatives: Iterable[Any],
) -> JevonsResult:
    """Calculate the Jevons geometric mean and its index-form value.

    Positive relatives are aggregated in log space, then exponentiated. This
    avoids multiplying many values directly and is more numerically stable
    for larger collections while preserving Decimal precision.
    """

    values = list(relatives)

    if not values:
        return JevonsResult(None, None, False, "empty_input")

    decimals = []
    for position, value in enumerate(values):
        decimal_value, reason = _to_positive_decimal(value, position)
        if reason is not None:
            return JevonsResult(None, None, False, reason)
        decimals.append(decimal_value)

    log_mean = sum(value.ln() for value in decimals) / Decimal(len(decimals))
    relative = log_mean.exp()

    return JevonsResult(
        relative=relative,
        index=relative * Decimal("100"),
        valid=True,
    )

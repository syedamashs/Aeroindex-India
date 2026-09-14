from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any


@dataclass(frozen=True)
class FisherResult:
    """Result of one Fisher Ideal Index calculation."""

    relative: Decimal | None
    index: Decimal | None
    valid: bool
    reason: str | None = None


def _to_positive_decimal(value: Any, name: str) -> tuple[Decimal | None, str | None]:
    if hasattr(value, "valid") and hasattr(value, "relative"):
        if not value.valid:
            return None, f"{name}_invalid"
        value = value.relative

    if value is None or value == "":
        return None, f"{name}_missing"

    if isinstance(value, bool):
        return None, f"{name}_invalid"

    try:
        relative = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None, f"{name}_invalid"

    if not relative.is_finite():
        return None, f"{name}_invalid"

    if relative <= 0:
        return None, f"{name}_non_positive"

    return relative, None


def calculate_fisher_index(
    laspeyres: Any,
    paasche: Any,
) -> FisherResult:
    """Calculate ``sqrt(Laspeyres relative * Paasche relative)``.

    The inputs may be raw positive relatives or valid result objects from the
    existing Laspeyres and Paasche estimators. The returned ``relative`` is
    distinct from the index-form value, which is scaled by 100.
    """

    laspeyres_value, reason = _to_positive_decimal(
        laspeyres,
        "laspeyres",
    )
    if reason is not None:
        return FisherResult(None, None, False, reason)

    paasche_value, reason = _to_positive_decimal(
        paasche,
        "paasche",
    )
    if reason is not None:
        return FisherResult(None, None, False, reason)

    relative = (laspeyres_value * paasche_value).sqrt()

    return FisherResult(
        relative=relative,
        index=relative * Decimal("100"),
        valid=True,
    )

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any


@dataclass(frozen=True)
class PriceRelativeResult:
    """Result of one elementary price-relative calculation."""

    relative: Decimal | None
    valid: bool
    reason: str | None = None


def _to_positive_decimal(value: Any, field_name: str) -> tuple[Decimal | None, str | None]:
    if value is None or value == "":
        return None, f"{field_name}_missing"

    if isinstance(value, bool):
        return None, f"{field_name}_invalid"

    try:
        price = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None, f"{field_name}_invalid"

    if not price.is_finite():
        return None, f"{field_name}_invalid"

    if price <= 0:
        return None, f"{field_name}_non_positive"

    return price, None


def calculate_price_relative(
    previous_price: Any,
    current_price: Any,
) -> PriceRelativeResult:
    """Calculate ``current_price / previous_price`` safely."""

    previous, previous_reason = _to_positive_decimal(
        previous_price,
        "previous_price",
    )
    if previous_reason is not None:
        return PriceRelativeResult(None, False, previous_reason)

    current, current_reason = _to_positive_decimal(
        current_price,
        "current_price",
    )
    if current_reason is not None:
        return PriceRelativeResult(None, False, current_reason)

    return PriceRelativeResult(
        relative=current / previous,
        valid=True,
    )

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Iterable


@dataclass(frozen=True)
class PaascheResult:
    """Result of one current-weight Paasche calculation."""

    relative: Decimal | None
    index: Decimal | None
    valid: bool
    reason: str | None = None


def _to_decimal(value: Any, field_name: str, position: int) -> tuple[Decimal | None, str | None]:
    if value is None or value == "":
        return None, f"{field_name}_missing_at_index_{position}"

    if isinstance(value, bool):
        return None, f"{field_name}_invalid_at_index_{position}"

    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None, f"{field_name}_invalid_at_index_{position}"

    if not number.is_finite():
        return None, f"{field_name}_invalid_at_index_{position}"

    return number, None


def _to_positive_price(value: Any, field_name: str, position: int) -> tuple[Decimal | None, str | None]:
    price, reason = _to_decimal(value, field_name, position)
    if reason is not None:
        return None, reason

    if price <= 0:
        return None, f"{field_name}_non_positive_at_index_{position}"

    return price, None


def calculate_paasche_index(
    base_prices: Iterable[Any],
    current_prices: Iterable[Any],
    current_weights: Iterable[Any],
) -> PaascheResult:
    """Calculate the Paasche current-weight price relative and index.

    The estimator is ``sum(current_price * current_weight) /``
    ``sum(base_price * current_weight)``. Current-period weights are supplied
    explicitly by the caller; production quantities are never inferred here.
    """

    base_values = list(base_prices)
    current_values = list(current_prices)
    weight_values = list(current_weights)

    if not base_values and not current_values and not weight_values:
        return PaascheResult(None, None, False, "empty_input")

    lengths = {len(base_values), len(current_values), len(weight_values)}
    if len(lengths) != 1:
        return PaascheResult(None, None, False, "length_mismatch")

    if not base_values:
        return PaascheResult(None, None, False, "empty_input")

    weighted_base_total = Decimal("0")
    weighted_current_total = Decimal("0")

    for position, (base, current, weight) in enumerate(
        zip(base_values, current_values, weight_values)
    ):
        base_price, reason = _to_positive_price(
            base,
            "base_price",
            position,
        )
        if reason is not None:
            return PaascheResult(None, None, False, reason)

        current_price, reason = _to_positive_price(
            current,
            "current_price",
            position,
        )
        if reason is not None:
            return PaascheResult(None, None, False, reason)

        current_weight, reason = _to_decimal(
            weight,
            "current_weight",
            position,
        )
        if reason is not None:
            return PaascheResult(None, None, False, reason)

        if current_weight < 0:
            return PaascheResult(
                None,
                None,
                False,
                f"current_weight_negative_at_index_{position}",
            )

        weighted_base_total += base_price * current_weight
        weighted_current_total += current_price * current_weight

    if weighted_base_total == 0:
        return PaascheResult(None, None, False, "zero_denominator")

    relative = weighted_current_total / weighted_base_total

    return PaascheResult(
        relative=relative,
        index=relative * Decimal("100"),
        valid=True,
    )

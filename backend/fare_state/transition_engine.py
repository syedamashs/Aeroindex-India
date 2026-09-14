from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional

from transition_readiness import Observation, comparable_pair


@dataclass(frozen=True)
class Transition:
    source: str
    origin: str
    destination: str
    flight_number: Optional[str]
    fare_family: Optional[str]
    previous_total_fare: Optional[float]
    current_total_fare: Optional[float]
    transition_type: str


def _fare(value) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_transition(
    previous: Observation,
    current: Observation,
) -> Transition:
    if not comparable_pair(previous, current):
        raise ValueError("Observations are not comparable.")

    previous_fare = _fare(previous.total_fare)
    current_fare = _fare(current.total_fare)

    if previous.is_sold in (None, "") or current.is_sold in (None, ""):
        transition_type = "AVAILABILITY_UNKNOWN"
    elif previous.is_sold != current.is_sold and current.is_sold:
        transition_type = "BECAME_UNAVAILABLE"
    elif previous.is_sold != current.is_sold and not current.is_sold:
        transition_type = "BECAME_AVAILABLE"
    elif previous_fare is None or current_fare is None:
        transition_type = "PRICE_NOT_CHECKABLE"
    elif current_fare > previous_fare:
        transition_type = "PRICE_INCREASE"
    elif current_fare < previous_fare:
        transition_type = "PRICE_DECREASE"
    else:
        transition_type = "UNCHANGED"

    return Transition(
        source=previous.source,
        origin=previous.origin,
        destination=previous.destination,
        flight_number=previous.flight_number or current.flight_number,
        fare_family=previous.fare_family or current.fare_family,
        previous_total_fare=previous_fare,
        current_total_fare=current_fare,
        transition_type=transition_type,
    )


def summarize_transitions(
    transitions: Iterable[Transition],
) -> dict:
    transitions = list(transitions)
    counts = {}

    for transition in transitions:
        counts[transition.transition_type] = (
            counts.get(transition.transition_type, 0) + 1
        )

    price_transitions = [
        transition
        for transition in transitions
        if transition.previous_total_fare is not None
        and transition.previous_total_fare > 0
        and transition.current_total_fare is not None
    ]

    escalation_count = sum(
        transition.current_total_fare > transition.previous_total_fare
        for transition in price_transitions
    )

    fare_escalation_pressure = (
        escalation_count / len(price_transitions)
        if price_transitions
        else None
    )

    return {
        "total_transitions": len(transitions),
        "counts": counts,
        "fare_escalation_pressure": fare_escalation_pressure,
    }
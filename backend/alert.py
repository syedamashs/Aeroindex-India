"""Reusable airfare alert rules for the AeroIndex backend.

The Node API currently owns data loading. This module keeps the alert policy
explicit and testable for batch jobs, diagnostics, and future API adapters.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping


SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


@dataclass(frozen=True)
class Alert:
    id: str
    type: str
    severity: str
    route: str
    message: str
    date: str

    def as_dict(self) -> dict[str, str]:
        return {
            "id": self.id,
            "type": self.type,
            "severity": self.severity,
            "route": self.route,
            "message": self.message,
            "date": self.date,
        }


def _number(value, default=0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def generate_alerts(
    routes: Iterable[Mapping],
    *,
    booking_windows: Iterable[Mapping] = (),
    index_points: Iterable[Mapping] = (),
    total_observations: int = 0,
    invalid_observations: int = 0,
    date: str = "",
    limit: int = 12,
) -> list[dict[str, str]]:
    """Generate deterministic, evidence-backed alerts from aggregate data."""
    alerts: list[Alert] = []

    for route in routes:
        route_id = str(route.get("routeId") or route.get("route_id") or "UNKNOWN")
        origin = str(route.get("origin") or route_id.split("_")[0])
        destination = str(route.get("destination") or route_id.split("_")[-1])
        label = f"{origin} -> {destination}"
        mom = _number(route.get("momChange"))
        volatility = _number(route.get("volatility"))
        index = _number(route.get("index"), 100)

        if mom >= 8:
            alerts.append(Alert(f"ALERT-{route_id}-spike", "price_spike", "high", route_id, f"{label} increased {mom:.1f}% month-over-month.", date))
        elif mom >= 4:
            alerts.append(Alert(f"ALERT-{route_id}-spike", "price_spike", "medium", route_id, f"{label} increased {mom:.1f}% month-over-month.", date))
        elif mom <= -8:
            alerts.append(Alert(f"ALERT-{route_id}-drop", "price_drop", "medium", route_id, f"{label} decreased {abs(mom):.1f}% month-over-month.", date))
        elif mom <= -4:
            alerts.append(Alert(f"ALERT-{route_id}-drop", "price_drop", "low", route_id, f"{label} decreased {abs(mom):.1f}% month-over-month.", date))

        if volatility >= 14:
            alerts.append(Alert(f"ALERT-{route_id}-volatility", "volatility", "medium", route_id, f"{label} has {volatility:.1f}% fare volatility.", date))

        if index >= 120:
            alerts.append(Alert(f"ALERT-{route_id}-premium", "price_spike", "medium", route_id, f"{label} is {index:.1f}% of the national average fare.", date))

    windows = {int(_number(row.get("window"))): _number(row.get("averageFare")) for row in booking_windows}
    if windows.get(1, 0) > 0 and windows.get(45, 0) > 0:
        premium = (windows[1] - windows[45]) / windows[45] * 100
        if premium >= 10:
            alerts.append(Alert("ALERT-BOOKING-WINDOW", "price_spike", "high" if premium >= 25 else "medium", "National", f"T+1 fares are {premium:.1f}% above T+45 fares on average.", date))

    points = list(index_points)
    if points:
        latest = points[-1]
        index_value = _number(latest.get("indexValue"), 100)
        if index_value >= 115:
            alerts.append(Alert("ALERT-NATIONAL-INDEX", "index_threshold", "high", "National", f"The national airfare index reached {index_value:.1f}, above the 115 monitoring threshold.", date))

    if total_observations and invalid_observations / total_observations >= 0.05:
        rate = invalid_observations / total_observations * 100
        alerts.append(Alert("ALERT-DATA-QUALITY", "data_quality", "medium", "National", f"{rate:.1f}% of observations failed validation and should be reviewed.", date))

    alerts.sort(key=lambda item: (SEVERITY_ORDER[item.severity], item.type, item.route))
    return [alert.as_dict() for alert in alerts[:max(1, limit)]]

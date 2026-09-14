from __future__ import annotations

import sqlite3
import sys
from dataclasses import asdict
from decimal import Decimal
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from index_engine.index_orchestrator import (
    ComparableObservation,
    calculate_index,
)
from index_engine.index_persistence import (
    persist_lead_time_indices,
    persist_national_index,
    persist_route_indices,
)
from index_engine.inflation import yoy_inflation_pct
from index_engine.route_index import RouteIndexInput, calculate_route_index


DEMO_ROUTES = {
    "DEMO_DELHI_MUMBAI": Decimal("0.50"),
    "DEMO_BENGALURU_DELHI": Decimal("0.30"),
    "DEMO_MUMBAI_HYDERABAD": Decimal("0.20"),
}
DEMO_LEAD_TIMES = (1, 7, 15, 30, 45)
DEMO_PERIODS = ("P0", "P1", "P2")

DEMO_SCHEMA = """
CREATE TABLE dgca_route_master (route_id TEXT PRIMARY KEY);
CREATE TABLE route_price_indices (
    index_id TEXT PRIMARY KEY, route_id TEXT NOT NULL, index_date TEXT NOT NULL,
    lead_time_days INTEGER, index_value REAL, previous_index_value REAL,
    daily_change_pct REAL, observation_count INTEGER, flight_count INTEGER,
    carrier_count INTEGER, coverage_pct REAL, methodology TEXT, quality_flag TEXT,
    FOREIGN KEY (route_id) REFERENCES dgca_route_master(route_id)
);
CREATE TABLE lead_time_indices (
    lead_time_index_id TEXT PRIMARY KEY, route_id TEXT NOT NULL,
    index_date TEXT NOT NULL, lead_time_days INTEGER NOT NULL, index_value REAL,
    median_fare REAL, mean_fare REAL, observation_count INTEGER,
    coverage_pct REAL, quality_flag TEXT,
    FOREIGN KEY (route_id) REFERENCES dgca_route_master(route_id)
);
CREATE TABLE national_apix (
    national_index_id TEXT PRIMARY KEY, index_date TEXT NOT NULL,
    index_value REAL NOT NULL, previous_index_value REAL,
    daily_change_pct REAL, weekly_change_pct REAL, monthly_change_pct REAL,
    route_count INTEGER, observation_count INTEGER, coverage_pct REAL,
    methodology TEXT, quality_flag TEXT
);
"""


def create_demo_database() -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(DEMO_SCHEMA)
    connection.executemany(
        "INSERT INTO dgca_route_master(route_id) VALUES (?)",
        [(route_id,) for route_id in DEMO_ROUTES],
    )
    connection.commit()
    return connection


def generate_synthetic_observations() -> dict[str, list[ComparableObservation]]:
    """Generate deterministic three-period, three-route, five-bucket data."""

    route_base = {
        "DEMO_DELHI_MUMBAI": 100,
        "DEMO_BENGALURU_DELHI": 140,
        "DEMO_MUMBAI_HYDERABAD": 180,
    }
    lead_factor = {1: 1.00, 7: 1.08, 15: 1.16, 30: 1.26, 45: 1.38}
    period_factor = {
        "P0": {route: Decimal("1.00") for route in DEMO_ROUTES},
        "P1": {
            "DEMO_DELHI_MUMBAI": Decimal("1.10"),
            "DEMO_BENGALURU_DELHI": Decimal("0.94"),
            "DEMO_MUMBAI_HYDERABAD": Decimal("1.05"),
        },
        "P2": {
            "DEMO_DELHI_MUMBAI": Decimal("1.18"),
            "DEMO_BENGALURU_DELHI": Decimal("0.90"),
            "DEMO_MUMBAI_HYDERABAD": Decimal("1.09"),
        },
    }
    current_weight = {
        "DEMO_DELHI_MUMBAI": Decimal("1.10"),
        "DEMO_BENGALURU_DELHI": Decimal("0.90"),
        "DEMO_MUMBAI_HYDERABAD": Decimal("1.20"),
    }

    periods = {period: [] for period in DEMO_PERIODS}
    for period in DEMO_PERIODS:
        for route_id in DEMO_ROUTES:
            for lead_days in DEMO_LEAD_TIMES:
                base_price = Decimal(str(route_base[route_id])) * Decimal(str(lead_factor[lead_days]))
                price = base_price * period_factor[period][route_id]
                periods[period].append(
                    ComparableObservation(
                        route_id=route_id,
                        target_lead_days=lead_days,
                        previous_price=price,
                        current_price=price,
                        base_weight=Decimal("1"),
                        current_weight=current_weight[route_id],
                    )
                )

    # Each period is represented by one level; pair generation below replaces
    # previous/current fields without changing the deterministic period prices.
    return periods


def _pair_observations(previous, current):
    return [
        ComparableObservation(
            route_id=now.route_id,
            target_lead_days=now.target_lead_days,
            previous_price=old.previous_price,
            current_price=now.previous_price,
            base_weight=old.base_weight,
            current_weight=now.current_weight,
        )
        for old, now in zip(previous, current)
    ]


def _route_robustness_rows(pair_observations, route_weights, period):
    rows = []
    for route_id in DEMO_ROUTES:
        route_rows = [item for item in pair_observations if item.route_id == route_id and item.target_lead_days == 1]
        route_input = RouteIndexInput(
            route_id=route_id,
            route_weight=route_weights[route_id],
            price_relatives=[item.current_price / item.previous_price for item in route_rows],
            base_prices=[item.previous_price for item in route_rows],
            current_prices=[item.current_price for item in route_rows],
            base_weights=[item.base_weight for item in route_rows],
            current_weights=[item.current_weight for item in route_rows],
        )
        for estimator in ("jevons", "laspeyres", "paasche", "fisher"):
            result = calculate_route_index(route_input, estimator)
            rows.append({
                "index_id": f"{period}-{route_id}-{estimator}",
                "route_id": route_id,
                "index_date": period,
                "lead_time_days": 1,
                "index_value": float(result.index) if result.index is not None else None,
                "observation_count": len(route_rows),
                "coverage_pct": 100.0,
                "methodology": estimator.upper(),
                "quality_flag": "OK" if result.valid else "NOT_CHECKABLE",
            })
    return rows


def run_demo(connection: sqlite3.Connection | None = None) -> dict[str, Any]:
    owns_connection = connection is None
    connection = connection or create_demo_database()
    periods = generate_synthetic_observations()
    route_weights = DEMO_ROUTES
    pair_reports = []
    route_rows = []
    lead_rows = []
    national_rows = []
    previous_national = None

    try:
        for previous_period, current_period in (("P0", "P1"), ("P1", "P2")):
            pairs = _pair_observations(periods[previous_period], periods[current_period])
            report = calculate_index(
                pairs,
                route_weights,
                previous_national_index=previous_national,
                national_lead_time=1,
            )
            assert report.status == "OK"
            assert report.national_result.valid
            pair_reports.append(report)
            previous_national = report.national_result.index_level

            route_rows.extend(_route_robustness_rows(pairs, route_weights, current_period))
            lead_rows.extend({
                "lead_time_index_id": f"{current_period}-{item.route_id}-T{item.lead_time_days}",
                "route_id": item.route_id,
                "index_date": current_period,
                "lead_time_days": item.lead_time_days,
                "index_value": float(item.index_level) if item.index_level is not None else None,
                "observation_count": 1,
                "coverage_pct": 100.0,
                "quality_flag": "OK" if item.valid else "NOT_CHECKABLE",
            } for item in report.lead_time_results)
            previous_index_value = None
            if report.inflation is not None and report.national_result.index_level is not None:
                previous_index_value = (
                    report.national_result.index_level
                    / (Decimal("1") + (Decimal(str(report.inflation)) / Decimal("100")))
                )

            national_rows.append({
                "national_index_id": f"national-{current_period}",
                "index_date": current_period,
                "index_value": float(report.national_result.index_level),
                "previous_index_value": float(previous_index_value) if previous_index_value is not None else None,
                "daily_change_pct": report.inflation,
                "route_count": report.coverage["usable_route_count"],
                "observation_count": report.coverage["usable_observation_count"],
                "coverage_pct": float(report.coverage["weight_coverage"] * 100),
                "methodology": "JEVONS",
                "quality_flag": "OK",
            })

        yoy = yoy_inflation_pct(
            pair_reports[-1].national_result.index_level,
            Decimal("100"),
        )
        assert yoy is not None

        route_persist = persist_route_indices(connection, route_rows)
        lead_persist = persist_lead_time_indices(connection, lead_rows)
        national_persist = [persist_national_index(connection, row) for row in national_rows]
        assert route_persist.status == "OK"
        assert lead_persist.status == "OK"
        assert all(result.status == "OK" for result in national_persist)

        counts = {
            "route_price_indices": connection.execute("SELECT COUNT(*) FROM route_price_indices").fetchone()[0],
            "lead_time_indices": connection.execute("SELECT COUNT(*) FROM lead_time_indices").fetchone()[0],
            "national_apix": connection.execute("SELECT COUNT(*) FROM national_apix").fetchone()[0],
        }
        assert counts["route_price_indices"] == len(route_rows)
        assert counts["lead_time_indices"] == len(lead_rows)
        assert counts["national_apix"] == len(national_rows)

        return {
            "status": "PASS",
            "demo_mode": "DETERMINISTIC_SYNTHETIC_IN_MEMORY",
            "observation_count": sum(len(items) for items in periods.values()),
            "period_count": len(periods),
            "route_count": len(DEMO_ROUTES),
            "lead_time_count": len(DEMO_LEAD_TIMES),
            "route_estimator_rows": route_rows,
            "lead_time_results": [asdict(item) for report in pair_reports for item in report.lead_time_results],
            "national_results": [asdict(report.national_result) for report in pair_reports],
            "inflation": [report.inflation for report in pair_reports],
            "yoy_inflation": yoy,
            "robustness": [asdict(report.robustness) for report in pair_reports],
            "persistence_counts": counts,
        }
    finally:
        if owns_connection:
            connection.close()


def print_report(result: dict[str, Any]) -> None:
    print("APIx INDEX ENGINE DEMO")
    print("Demo mode:", result["demo_mode"])
    print("Synthetic observations:", result["observation_count"])
    print("Synthetic periods:", result["period_count"])
    print("Synthetic routes:", result["route_count"])
    print("Lead-time buckets:", result["lead_time_count"])
    print("Route estimator rows:", len(result["route_estimator_rows"]))
    print("Lead-time results:", len(result["lead_time_results"]))
    print("National APIx:", result["national_results"])
    print("Inflation:", result["inflation"])
    print("YoY inflation:", result["yoy_inflation"])
    print("Robustness:", result["robustness"])
    print("Persistence verification:", result["persistence_counts"])
    print("INDEX ENGINE STATUS:", result["status"])


if __name__ == "__main__":
    print_report(run_demo())

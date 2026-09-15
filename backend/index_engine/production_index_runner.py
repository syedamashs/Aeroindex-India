from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
import argparse
import sqlite3
import sys
from typing import Any, Iterable, Mapping

BACKEND_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BACKEND_DIR / "data" / "apix.db"
SUPPORTED_LEAD_TIMES = (1, 7, 15, 30, 45)

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from index_engine.index_sampling import (
    DailySourceSample,
    construct_daily_source_samples,
    filter_eligible_observations,
)
from index_engine.index_sampling import _price as _sampling_price
from index_engine.index_sampling import _collection_date as _sampling_collection_date
from index_engine.jevons import calculate_jevons_index
from index_engine.price_relative import calculate_price_relative
from index_engine.route_index import RouteIndexInput, calculate_route_index


OBSERVATION_COLUMNS = (
    "observation_id, source, route_id, origin, destination, departure_datetime, "
    "arrival_datetime, flight_number, carrier_code, fare_product_class, "
    "fare_class, fare_family, fare_availability_key, source_offer_id, total_fare, "
    "search_timestamp, target_lead_days, is_sold"
)


def _normalized(value: Any) -> str:
    return "" if value is None else str(value).strip().casefold()


def _date(value: Any) -> date | None:
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
    except (TypeError, ValueError):
        return None


def _period_dates(first: str, second: str) -> tuple[str, ...]:
    first_date = _date(first)
    second_date = _date(second)
    if first_date is None or second_date is None or second_date <= first_date:
        return ()
    return tuple(
        (first_date + timedelta(days=offset)).isoformat()
        for offset in range(1, (second_date - first_date).days)
    )


def _sample_key(sample: DailySourceSample) -> tuple[str, str, int]:
    return (
        sample.collection_date,
        _normalized(sample.source),
        sample.target_lead_days,
    )


def _period_record(previous_date: str, current_date: str) -> dict[str, Any]:
    return {
        "previous_date": previous_date,
        "current_date": current_date,
        "gap_days": ((_date(current_date) - _date(previous_date)).days if _date(previous_date) and _date(current_date) else None),
        "missing_collection_dates": _period_dates(previous_date, current_date),
        "source_relatives": (),
        "daily_jevons_relative": None,
        "route_relative": None,
        "status": "MISSING_SOURCE_OVERLAP",
        "warnings": (),
    }


def _source_samples_for(
    observations: Iterable[Mapping[str, Any]],
    route_id: str,
    lead_time: int,
) -> tuple[DailySourceSample, ...]:
    selected = [
        observation
        for observation in observations
        if _normalized(observation.get("route_id")) == _normalized(route_id)
        and observation.get("target_lead_days") == lead_time
    ]
    return tuple(construct_daily_source_samples(selected))


def _daily_source_map(samples: Iterable[DailySourceSample]) -> dict[str, dict[str, DailySourceSample]]:
    by_date: dict[str, dict[str, DailySourceSample]] = defaultdict(dict)
    for sample in samples:
        by_date[sample.collection_date][_normalized(sample.source)] = sample
    return dict(by_date)


def calculate_production_route_index(
    observations: Iterable[Mapping[str, Any]],
    route_id: str,
    lead_time: int,
) -> dict[str, Any]:
    """Build a route/lead-time market index from daily sampled prices.

    Source is the elementary item. For each adjacent observed collection date,
    only sources with valid samples on both dates contribute. Missing dates and
    absent sources are retained as warnings; no price is imputed.
    """

    if lead_time not in SUPPORTED_LEAD_TIMES:
        raise ValueError(f"Unsupported lead time: {lead_time}")

    observations = [dict(observation) for observation in observations]
    raw_selected = [
        observation
        for observation in observations
        if _normalized(observation.get("route_id")) == _normalized(route_id)
        and observation.get("target_lead_days") == lead_time
    ]
    eligible, exclusions = filter_eligible_observations(raw_selected)
    samples = _source_samples_for(raw_selected, route_id, lead_time)
    by_date = _daily_source_map(samples)
    collection_dates = tuple(sorted(by_date))
    periods = []
    for previous_date, current_date in zip(collection_dates, collection_dates[1:]):
        period = _period_record(previous_date, current_date)
        previous_sources = by_date[previous_date]
        current_sources = by_date[current_date]
        common_sources = sorted(set(previous_sources) & set(current_sources))
        source_relatives = []
        warnings = list(period["warnings"])
        if set(previous_sources) != set(current_sources):
            warnings.append("source_coverage_changed")
        for source in common_sources:
            previous_price = previous_sources[source].representative_price
            current_price = current_sources[source].representative_price
            relative = calculate_price_relative(previous_price, current_price)
            source_relatives.append(
                {
                    "source": source,
                    "previous_price": previous_price,
                    "current_price": current_price,
                    "relative": relative.relative,
                    "valid": relative.valid,
                    "reason": relative.reason,
                }
            )
        valid_relatives = [item["relative"] for item in source_relatives if item["valid"]]
        jevons = calculate_jevons_index(valid_relatives)
        if not jevons.valid:
            warnings.append(jevons.reason)
            period["status"] = "NO_VALID_SOURCE_RELATIVE"
            period["warnings"] = tuple(warnings)
            period["source_relatives"] = tuple(source_relatives)
            periods.append(period)
            continue
        route_result = calculate_route_index(
            RouteIndexInput(
                route_id=route_id,
                route_weight=Decimal("1"),
                price_relatives=(jevons.relative,),
            ),
            "jevons",
        )
        period.update(
            {
                "source_relatives": tuple(source_relatives),
                "daily_jevons_relative": jevons.relative,
                "route_relative": route_result.relative,
                "status": "COMPARABLE",
                "warnings": tuple(warnings),
            }
        )
        periods.append(period)

    route_series = []
    current_index = None
    base_date = None
    for period in periods:
        if period["route_relative"] is not None:
            if current_index is None:
                current_index = Decimal("100")
                base_date = period["previous_date"]
            current_index *= period["route_relative"]
            index_value = current_index
        else:
            index_value = None
        route_series.append(
            {
                "date": period["current_date"],
                "index": index_value,
                "status": period["status"],
                "missing_collection_dates": period["missing_collection_dates"],
            }
        )

    source_names = sorted({sample.source for sample in samples}, key=str)
    if not raw_selected:
        readiness = "NO_DATA"
    elif not samples:
        readiness = "INSUFFICIENT_HISTORY"
    elif len(collection_dates) < 2:
        readiness = "INSUFFICIENT_HISTORY"
    elif not any(period["route_relative"] is not None for period in periods):
        readiness = "INSUFFICIENT_SOURCE_COVERAGE"
    elif any(period["status"] != "COMPARABLE" or period["warnings"] for period in periods) or exclusions:
        readiness = "INSUFFICIENT_SOURCE_COVERAGE"
    else:
        readiness = "READY"

    return {
        "route_id": route_id,
        "route": route_id,
        "lead_time": lead_time,
        "collection_dates": collection_dates,
        "source_count": len(source_names),
        "sources": tuple(source_names),
        "observations": tuple(sample.observation_ids for sample in samples),
        "sampled_items_used": sum(sample.unique_item_count for sample in samples),
        "comparable_daily_periods": sum(period["route_relative"] is not None for period in periods),
        "daily_source_price_relatives": tuple(
            item
            for period in periods
            for item in period["source_relatives"]
        ),
        "periods": tuple(periods),
        "route_index_series": tuple(route_series),
        "base_index_value": Decimal("100") if base_date is not None else None,
        "base_date": base_date,
        "final_index_value": current_index,
        "missing_date_information": tuple(
            {
                "previous_date": period["previous_date"],
                "current_date": period["current_date"],
                "missing_collection_dates": period["missing_collection_dates"],
            }
            for period in periods
            if period["missing_collection_dates"]
        ),
        "exclusions": tuple(exclusions),
        "warnings": tuple(
            sorted(
                set(
                    warning
                    for period in periods
                    for warning in period["warnings"]
                    if warning
                )
                | ({"sampling_exclusions"} if exclusions else set())
            )
        ),
        "readiness": readiness,
    }


def load_route_observations(connection: sqlite3.Connection, route_id: str) -> list[dict[str, Any]]:
    rows = connection.execute(
        f"SELECT {OBSERVATION_COLUMNS} FROM apix_observations WHERE route_id = ? ORDER BY search_timestamp, source, target_lead_days, observation_id",
        (route_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def run_from_database(
    connection: sqlite3.Connection,
    route_id: str,
    lead_time: int | None = None,
) -> tuple[dict[str, Any], ...]:
    observations = load_route_observations(connection, route_id)
    lead_times = (lead_time,) if lead_time is not None else SUPPORTED_LEAD_TIMES
    return tuple(
        calculate_production_route_index(observations, route_id, selected_lead_time)
        for selected_lead_time in lead_times
    )


def _print_result(result: Mapping[str, Any]) -> None:
    print(f"ROUTE {result['route_id']} | T+{result['lead_time']}")
    print(f"  dates: {result['collection_dates']}")
    print(f"  sources: {result['sources']} | sampled items: {result['sampled_items_used']}")
    print(f"  comparable periods: {result['comparable_daily_periods']}")
    print(f"  base/final index: {result['base_index_value']} -> {result['final_index_value']}")
    print(f"  readiness: {result['readiness']}")
    if result["warnings"]:
        print(f"  warnings: {result['warnings']}")
    for period in result["periods"]:
        print(
            f"  {period['previous_date']} -> {period['current_date']}: "
            f"relative={period['daily_jevons_relative']} status={period['status']}"
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--route-id", required=True)
    parser.add_argument("--lead-time", type=int, choices=SUPPORTED_LEAD_TIMES)
    args = parser.parse_args()
    connection = sqlite3.connect(f"file:{DB_PATH.as_posix()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        print("PRODUCTION INDEX RUNNER | READ ONLY")
        for result in run_from_database(connection, args.route_id, args.lead_time):
            _print_result(result)
    finally:
        connection.close()


if __name__ == "__main__":
    main()
from __future__ import annotations

from collections import Counter
from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
from decimal import Decimal
import json
from pathlib import Path
import sqlite3
import sys
from typing import Any, Callable, Iterable


DATA_QUALITY_DIR = Path(__file__).resolve().parent
BACKEND_DIR = DATA_QUALITY_DIR.parent
DB_PATH = BACKEND_DIR / "data" / "apix.db"
REPORT_DIR = DATA_QUALITY_DIR / "reports"

if str(DATA_QUALITY_DIR) not in sys.path:
    sys.path.insert(0, str(DATA_QUALITY_DIR))

from cross_source_validator import compare_observation_group
from duplicate_validator import find_duplicates
from fare_validator import validate_observations as validate_fare_observations
from flight_identity_validator import validate_observations as validate_identity_observations
from date_time_validator import validate_observations as validate_datetime_observations
from outlier_validator import validate_observations as validate_outlier_observations
from schema_validator import validate_observations as validate_schema_observations
from soldout_validator import validate_observations as validate_soldout_observations
from quality_scorer import DQE_SCORING_VERSION, score_quality


STEP_NAMES = {
    "schema_integrity": "Schema Integrity",
    "fare_arithmetic_integrity": "Fare Arithmetic",
    "date_time_integrity": "Date/Time Quality",
    "flight_identity_integrity": "Flight/Journey Identity",
    "duplicate_integrity": "Duplicate Integrity",
    "sold_out_handling": "Sold-out Handling",
    "outlier_quality": "Outlier Quality",
    "cross_source_consistency": "Cross-source Consistency",
}


def _json_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if is_dataclass(value):
        return {key: _json_value(item) for key, item in asdict(value).items()}
    if isinstance(value, dict):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_value(item) for item in value]
    return value


def load_observations(db_path: Path = DB_PATH) -> list[dict[str, Any]]:
    """Load observations using a query-only SQLite connection."""
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA query_only = ON")
        rows = connection.execute("SELECT * FROM apix_observations").fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()


def load_dataset_metadata(db_path: Path = DB_PATH) -> dict[str, Any]:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA query_only = ON")
        counts = {}
        for table in ("collection_runs", "collection_tasks"):
            counts[table] = connection.execute(f"SELECT COUNT(*) AS count FROM {table}").fetchone()["count"]
        return {"collection_run_count": counts["collection_runs"], "collection_task_count": counts["collection_tasks"]}
    finally:
        connection.close()


def _status_counts(results: Iterable[Any]) -> Counter:
    values = []
    for result in results:
        if isinstance(result, dict):
            values.append(result.get("status") or result.get("validation_status"))
        else:
            values.append(getattr(result, "status", None))
    return Counter(values)


def _warning_count(results: Iterable[Any]) -> int:
    total = 0
    for result in results:
        if isinstance(result, dict):
            warnings = result.get("warnings", [])
        else:
            warnings = getattr(result, "warnings", [])
        total += len(warnings or [])
    return total


def _row_aggregate(results: list[Any], hard_statuses: set[str], not_checkable_statuses: set[str] | None = None, flagged_statuses: set[str] | None = None) -> dict[str, Any]:
    not_checkable_statuses = not_checkable_statuses or {"NOT_CHECKABLE"}
    flagged_statuses = flagged_statuses or set()
    counts = _status_counts(results)
    hard_errors = sum(counts[status] for status in hard_statuses)
    not_checkable = sum(counts[status] for status in not_checkable_statuses)
    flagged = sum(counts[status] for status in flagged_statuses)
    warnings = _warning_count(results)
    return {
        "total": len(results),
        "hard_errors": hard_errors,
        "warnings": warnings,
        "not_checkable": not_checkable,
        "flagged": flagged,
        "status_counts": dict(counts),
        "warning_items": [],
        "limitations": [],
    }


def _exception_result(exc: Exception) -> dict[str, Any]:
    return {"status": "ERROR", "error_type": type(exc).__name__, "error_message": str(exc)}


def _run_step(name: str, function: Callable[[], Any]) -> tuple[dict[str, Any], Any, str | None]:
    started = datetime.now(timezone.utc).isoformat()
    try:
        raw = function()
        return {"step": name, "status": "COMPLETED", "started_at": started, "completed_at": datetime.now(timezone.utc).isoformat()}, raw, None
    except Exception as exc:
        return {"step": name, "status": "ERROR", "started_at": started, "completed_at": datetime.now(timezone.utc).isoformat(), "error": _exception_result(exc)}, None, str(exc)


def _broad_cross_groups(observations: list[dict[str, Any]]) -> dict[tuple[Any, ...], list[dict[str, Any]]]:
    groups: dict[tuple[Any, ...], list[dict[str, Any]]] = {}
    for observation in observations:
        departure = observation.get("departure_datetime")
        departure_date = str(departure).split("T")[0].split(" ")[0] if departure else None
        key = (observation.get("origin"), observation.get("destination"), departure_date)
        groups.setdefault(key, []).append(observation)
    return groups


def _dataset_summary(observations: list[dict[str, Any]]) -> dict[str, Any]:
    sources = Counter(str(row.get("source") or "UNKNOWN") for row in observations)
    routes = {(row.get("origin"), row.get("destination")) for row in observations}
    searches = sorted(str(row["search_timestamp"]) for row in observations if row.get("search_timestamp"))
    departures = sorted(str(row["departure_datetime"])[:10] for row in observations if row.get("departure_datetime"))
    return {
        "observation_count": len(observations),
        "source_count": len(sources),
        "source_breakdown": dict(sources),
        "route_count": len(routes),
        "earliest_search_timestamp": searches[0] if searches else None,
        "latest_search_timestamp": searches[-1] if searches else None,
        "earliest_departure_date": departures[0] if departures else None,
        "latest_departure_date": departures[-1] if departures else None,
    }


def _step_payload(metadata: dict[str, Any], aggregate: dict[str, Any], raw: Any) -> dict[str, Any]:
    payload = dict(metadata)
    payload["aggregate"] = _json_value(aggregate)
    if isinstance(raw, list):
        payload["result_count"] = len(raw)
        payload["sample_results"] = _json_value(raw[:50])
    elif isinstance(raw, dict):
        payload["result"] = _json_value(raw)
    else:
        payload["result"] = _json_value(raw)
    return payload


def run_dqe(db_path: Path = DB_PATH) -> dict[str, Any]:
    observations = load_observations(db_path)
    metadata = load_dataset_metadata(db_path)
    step_results: dict[str, dict[str, Any]] = {}
    aggregates: dict[str, dict[str, Any]] = {}
    runtime_errors: list[str] = []

    definitions: list[tuple[str, Callable[[], Any], Callable[[Any], dict[str, Any]]]] = [
        ("schema_integrity", lambda: validate_schema_observations(observations), lambda raw: _row_aggregate(raw, {"INVALID"})),
        ("fare_arithmetic_integrity", lambda: validate_fare_observations(observations), lambda raw: _row_aggregate(raw, {"INVALID_ARITHMETIC"})),
        ("date_time_integrity", lambda: validate_datetime_observations(observations), lambda raw: _row_aggregate(raw, {"INVALID"})),
        ("flight_identity_integrity", lambda: validate_identity_observations(observations), lambda raw: _row_aggregate(raw, {"INVALID"})),
        ("sold_out_handling", lambda: validate_soldout_observations(observations), lambda raw: _row_aggregate(raw, {"INVALID"}, flagged_statuses={"SOLD_OUT"})),
        ("outlier_quality", lambda: validate_outlier_observations(observations), lambda raw: _row_aggregate(raw, set(), flagged_statuses={"SUSPECT"})),
    ]

    for name, function, aggregate_function in definitions:
        step_meta, raw, error = _run_step(name, function)
        if error:
            runtime_errors.append(name)
            aggregate = {"total": len(observations), "hard_errors": 1, "warnings": 0, "not_checkable": 0, "flagged": 0, "warning_items": ["VALIDATOR_RUNTIME_ERROR"], "limitations": ["STEP_RUNTIME_ERROR"]}
        else:
            aggregate = aggregate_function(raw)
        aggregates[name] = aggregate
        step_results[name] = _step_payload(step_meta, aggregate, raw if raw is not None else _exception_result(Exception(error or "unknown error")))

    duplicate_meta, duplicate_raw, duplicate_error = _run_step("duplicate_integrity", lambda: find_duplicates(observations))
    if duplicate_error:
        runtime_errors.append("duplicate_integrity")
        duplicate_aggregate = {"total": len(observations), "hard_errors": 1, "warnings": 0, "not_checkable": 0, "flagged": 0, "warning_items": ["VALIDATOR_RUNTIME_ERROR"], "limitations": ["STEP_RUNTIME_ERROR"]}
    else:
        duplicate_aggregate = {
            "total": len(observations),
            "hard_errors": int(duplicate_raw.get("extra_duplicate_rows", 0)),
            "warnings": 0,
            "not_checkable": 0,
            "flagged": 0,
            "status_counts": {"DUPLICATE_GROUPS": duplicate_raw.get("duplicate_group_count", 0)},
            "warning_items": [],
            "limitations": [],
        }
    aggregates["duplicate_integrity"] = duplicate_aggregate
    step_results["duplicate_integrity"] = _step_payload(duplicate_meta, duplicate_aggregate, duplicate_raw if duplicate_raw is not None else _exception_result(Exception(duplicate_error or "unknown error")))

    cross_meta, cross_raw, cross_error = _run_step("cross_source_consistency", lambda: [result for group in _broad_cross_groups(observations).values() for result in compare_observation_group(group)])
    if cross_error:
        runtime_errors.append("cross_source_consistency")
        cross_aggregate = {"total": 0, "hard_errors": 1, "warnings": 0, "not_checkable": 0, "flagged": 0, "warning_items": ["VALIDATOR_RUNTIME_ERROR"], "limitations": ["STEP_RUNTIME_ERROR"]}
    else:
        cross_aggregate = _row_aggregate(cross_raw, set(), flagged_statuses={"DISCREPANT", "MINOR_DIFFERENCE"})
        cross_aggregate["limitations"] = ["CROSS_SOURCE_MATCHING_IS_RESTRICTED_TO_COMPARABLE_SCHEDULES"] if cross_aggregate["not_checkable"] else []
    aggregates["cross_source_consistency"] = cross_aggregate
    step_results["cross_source_consistency"] = _step_payload(cross_meta, cross_aggregate, cross_raw if cross_raw is not None else _exception_result(Exception(cross_error or "unknown error")))

    quality = score_quality(aggregates)
    if runtime_errors:
        quality["overall_status"] = "ERROR"
        quality["warnings"].append("VALIDATOR_RUNTIME_ERROR")

    audit_time = datetime.now(timezone.utc).isoformat()
    report = {
        "report_metadata": {"generated_at": audit_time, "database_path": str(db_path), "scoring_version": DQE_SCORING_VERSION},
        "dataset_summary": {**_dataset_summary(observations), **metadata},
        "step_results": step_results,
        "quality_scores": quality["dimensions"],
        "overall_score": quality["overall_score"],
        "overall_status": quality["overall_status"],
        "key_findings": [f"{name}: {data['aggregate']['status_counts']}" for name, data in step_results.items() if data.get("aggregate", {}).get("status_counts")],
        "warnings": quality["warnings"],
        "limitations": quality["limitations"],
        "audit_trail": {"run_at": audit_time, "database_path": str(db_path), "observation_count": len(observations), "steps_ran": list(step_results), "runtime_errors": runtime_errors, "scoring_version": DQE_SCORING_VERSION},
        "database_read_only": True,
    }
    return report


def save_report(report: dict[str, Any], report_dir: Path = REPORT_DIR) -> Path:
    report_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = report_dir / f"dqe_report_{timestamp}.json"
    path.write_text(json.dumps(_json_value(report), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def print_report(report: dict[str, Any], report_path: Path) -> None:
    print("=" * 64)
    print("APIx DATA QUALITY EVALUATION")
    print("=" * 64)
    summary = report["dataset_summary"]
    print(f"Observations: {summary['observation_count']}")
    print(f"Sources:      {summary['source_count']}")
    print(f"Routes:       {summary['route_count']}")
    print()
    print("DQE STEPS")
    for name, value in report["quality_scores"].items():
        print(f"{STEP_NAMES[name]:32} {value['score']:6.2f}  {value['status']}")
    print()
    print(f"OVERALL DQE SCORE: {report['overall_score']:.2f} / 100")
    print(f"STATUS:            {report['overall_status']}")
    print(f"Audit report:       {report_path}")
    print()
    print("DATABASE WAS READ ONLY — NO RECORDS WERE MODIFIED")


def main() -> int:
    try:
        report = run_dqe()
        report_path = save_report(report)
        print_report(report, report_path)
        return 0 if report["overall_status"] != "ERROR" else 1
    except Exception as exc:
        print(f"DQE ORCHESTRATOR ERROR: {type(exc).__name__}: {exc}")
        print("DATABASE WAS READ ONLY — NO RECORDS WERE MODIFIED")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

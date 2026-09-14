from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Mapping


DQE_SCORING_VERSION = "1.0"
DIMENSION_WEIGHTS = {
    "schema_integrity": 0.15,
    "fare_arithmetic_integrity": 0.15,
    "date_time_integrity": 0.12,
    "flight_identity_integrity": 0.12,
    "duplicate_integrity": 0.12,
    "sold_out_handling": 0.10,
    "outlier_quality": 0.12,
    "cross_source_consistency": 0.12,
}


@dataclass(frozen=True)
class DimensionScore:
    name: str
    score: float
    status: str
    weight: float
    numerator: int
    denominator: int
    hard_errors: int
    warnings: int
    not_checkable: int
    flagged: int
    scoring_explanation: str
    warnings_list: tuple[str, ...]
    limitations: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["warnings_list"] = list(self.warnings_list)
        value["limitations"] = list(self.limitations)
        return value


def _int_value(value: Any) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def _dimension_score(name: str, data: Mapping[str, Any], weight: float) -> DimensionScore:
    total = _int_value(data.get("total"))
    hard_errors = _int_value(data.get("hard_errors"))
    warnings = _int_value(data.get("warnings"))
    not_checkable = _int_value(data.get("not_checkable"))
    flagged = _int_value(data.get("flagged"))
    assessable = max(0, total - not_checkable)

    if assessable == 0:
        score = 100.0
        status = "PASS_WITH_WARNINGS" if total else "PASS"
        limitations = tuple(data.get("limitations") or ("NO_ASSESSABLE_RECORDS",))
        explanation = "No assessable records; NOT_CHECKABLE results were preserved and not treated as invalid."
    else:
        hard_penalty = 100.0 * min(hard_errors, assessable) / assessable
        warning_penalty = 20.0 * min(warnings, assessable) / assessable
        score = max(0.0, min(100.0, 100.0 - hard_penalty - warning_penalty))
        status = "FAIL" if hard_errors > 0 or score < 80.0 else ("PASS_WITH_WARNINGS" if warnings or flagged or not_checkable else "PASS")
        limitations = tuple(data.get("limitations") or ())
        explanation = "Score = 100 - 100*(hard_errors/assessable) - 20*(warnings/assessable); NOT_CHECKABLE is excluded from the penalty denominator."

    warning_items = tuple(data.get("warning_items") or ())
    if flagged and "FLAGGED_RESULTS_ARE_NOT_AUTOMATICALLY_INVALID" not in warning_items:
        warning_items += ("FLAGGED_RESULTS_ARE_NOT_AUTOMATICALLY_INVALID",)

    return DimensionScore(
        name=name,
        score=round(score, 2),
        status=status,
        weight=weight,
        numerator=max(0, assessable - hard_errors),
        denominator=assessable,
        hard_errors=hard_errors,
        warnings=warnings,
        not_checkable=not_checkable,
        flagged=flagged,
        scoring_explanation=explanation,
        warnings_list=warning_items,
        limitations=limitations,
    )


def score_quality(step_results: Mapping[str, Mapping[str, Any]]) -> dict[str, Any]:
    """Score normalized Step 1-8 aggregates without mutating the input."""
    missing = set(DIMENSION_WEIGHTS) - set(step_results)
    if missing:
        raise ValueError(f"Missing scoring dimensions: {sorted(missing)}")

    dimension_scores = {
        name: _dimension_score(name, step_results[name], weight)
        for name, weight in DIMENSION_WEIGHTS.items()
    }
    overall_score = round(sum(item.score * item.weight for item in dimension_scores.values()), 2)
    all_hard_errors = sum(item.hard_errors for item in dimension_scores.values())
    has_warnings = any(item.warnings or item.flagged or item.not_checkable for item in dimension_scores.values())
    overall_status = "FAIL" if all_hard_errors or overall_score < 80 else ("PASS_WITH_WARNINGS" if has_warnings else "PASS")

    return {
        "scoring_version": DQE_SCORING_VERSION,
        "weights": dict(DIMENSION_WEIGHTS),
        "dimensions": {name: score.to_dict() for name, score in dimension_scores.items()},
        "overall_score": overall_score,
        "overall_status": overall_status,
        "warnings": sorted({warning for item in dimension_scores.values() for warning in item.warnings_list}),
        "limitations": sorted({limitation for item in dimension_scores.values() for limitation in item.limitations}),
    }

from __future__ import annotations

import copy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_QUALITY = ROOT / "backend" / "data_quality"
if str(DATA_QUALITY) not in sys.path:
    sys.path.insert(0, str(DATA_QUALITY))

from quality_scorer import DIMENSION_WEIGHTS, score_quality


DIMENSIONS = tuple(DIMENSION_WEIGHTS)


def aggregate(**overrides):
    value = {
        "total": 10,
        "hard_errors": 0,
        "warnings": 0,
        "not_checkable": 0,
        "flagged": 0,
        "warning_items": [],
        "limitations": [],
    }
    value.update(overrides)
    return value


def dataset(**overrides):
    value = {name: aggregate() for name in DIMENSIONS}
    value.update(overrides)
    return value


def test_all_perfect_dataset_passes():
    result = score_quality(dataset())
    assert result["overall_score"] == 100.0
    assert result["overall_status"] == "PASS"


def test_hard_schema_failures_fail():
    result = score_quality(dataset(schema_integrity=aggregate(hard_errors=2)))
    assert result["dimensions"]["schema_integrity"]["score"] == 80.0
    assert result["overall_status"] == "FAIL"


def test_fare_arithmetic_failures_are_strongly_penalized():
    result = score_quality(dataset(fare_arithmetic_integrity=aggregate(hard_errors=10)))
    assert result["dimensions"]["fare_arithmetic_integrity"]["score"] == 0.0
    assert result["overall_status"] == "FAIL"


def test_date_time_failures_are_scored():
    result = score_quality(dataset(date_time_integrity=aggregate(hard_errors=1)))
    assert result["dimensions"]["date_time_integrity"]["status"] == "FAIL"


def test_identity_failures_are_scored():
    result = score_quality(dataset(flight_identity_integrity=aggregate(hard_errors=1)))
    assert result["dimensions"]["flight_identity_integrity"]["hard_errors"] == 1
    assert result["overall_status"] == "FAIL"


def test_duplicates_are_scored_as_hard_errors():
    result = score_quality(dataset(duplicate_integrity=aggregate(hard_errors=3)))
    assert result["dimensions"]["duplicate_integrity"]["status"] == "FAIL"


def test_sold_out_not_checkable_is_warning_not_invalid():
    result = score_quality(dataset(sold_out_handling=aggregate(not_checkable=10, limitations=["SOLD_STATUS_UNKNOWN"])))
    dimension = result["dimensions"]["sold_out_handling"]
    assert dimension["score"] == 100.0
    assert dimension["status"] == "PASS_WITH_WARNINGS"
    assert dimension["not_checkable"] == 10


def test_outlier_suspect_is_flagged_not_hard_failure():
    result = score_quality(dataset(outlier_quality=aggregate(flagged=2, warnings=2)))
    assert result["dimensions"]["outlier_quality"]["status"] == "PASS_WITH_WARNINGS"
    assert result["overall_status"] == "PASS_WITH_WARNINGS"


def test_cross_source_discrepancy_is_flagged_not_invalid():
    result = score_quality(dataset(cross_source_consistency=aggregate(flagged=4, warnings=4)))
    assert result["dimensions"]["cross_source_consistency"]["status"] == "PASS_WITH_WARNINGS"
    assert "FLAGGED_RESULTS_ARE_NOT_AUTOMATICALLY_INVALID" in result["warnings"]


def test_warning_only_dataset_has_warning_status():
    result = score_quality(dataset(schema_integrity=aggregate(warnings=2, warning_items=["MISSING_OPTIONAL_FIELDS"])))
    assert result["overall_status"] == "PASS_WITH_WARNINGS"
    assert "MISSING_OPTIONAL_FIELDS" in result["warnings"]


def test_score_boundary_below_eighty_fails():
    result = score_quality(dataset(schema_integrity=aggregate(hard_errors=3)))
    assert result["dimensions"]["schema_integrity"]["score"] == 70.0
    assert result["overall_status"] == "FAIL"


def test_weights_sum_to_one():
    assert sum(DIMENSION_WEIGHTS.values()) == 1.0


def test_scores_remain_between_zero_and_hundred():
    result = score_quality(dataset(schema_integrity=aggregate(hard_errors=100, warnings=100)))
    assert 0 <= result["overall_score"] <= 100
    assert all(0 <= item["score"] <= 100 for item in result["dimensions"].values())


def test_scoring_is_deterministic():
    value = dataset(schema_integrity=aggregate(hard_errors=1, warnings=1))
    assert score_quality(value) == score_quality(value)


def test_input_results_are_not_mutated():
    value = dataset(outlier_quality=aggregate(flagged=1, warnings=1))
    before = copy.deepcopy(value)
    score_quality(value)
    assert value == before


def test_missing_dimension_is_rejected():
    value = dataset()
    value.pop("schema_integrity")
    try:
        score_quality(value)
    except ValueError as exc:
        assert "schema_integrity" in str(exc)
    else:
        raise AssertionError("Expected missing dimension error")


def test_not_checkable_only_dimension_preserves_limitation():
    result = score_quality(dataset(outlier_quality=aggregate(total=10, not_checkable=10, limitations=["NO_COMPARABLE_GROUP"])))
    assert result["dimensions"]["outlier_quality"]["limitations"] == ["NO_COMPARABLE_GROUP"]
    assert "NO_COMPARABLE_GROUP" in result["limitations"]


if __name__ == "__main__":
    tests = [value for name, value in globals().items() if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"ALL QUALITY SCORER TESTS PASSED ({len(tests)} tests)")

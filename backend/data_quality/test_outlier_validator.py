from __future__ import annotations

import copy
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_QUALITY_DIR = PROJECT_ROOT / "backend" / "data_quality"
if str(DATA_QUALITY_DIR) not in sys.path:
    sys.path.insert(0, str(DATA_QUALITY_DIR))

from outlier_validator import validate_outlier


BASE_GROUP = {
    "route_id": "DEL_BOM",
    "origin": "DEL",
    "destination": "BOM",
    "departure_datetime": "2026-09-20T10:00:00",
    "target_lead_days": 7,
    "carrier_code": "AI",
    "is_sold": False,
}


def observation(observation_id: str, total_fare, **overrides):
    value = dict(BASE_GROUP)
    value.update({"observation_id": observation_id, "total_fare": total_fare})
    value.update(overrides)
    return value


def comparisons(values, **overrides):
    return [
        observation(f"comparison_{index}", value, **overrides)
        for index, value in enumerate(values)
    ]


def test_normal_distribution_is_normal():
    result = validate_outlier(
        observation("target", 3600),
        comparisons([3500, 3550, 3600, 3650, 3700]),
    )
    assert result.status == "NORMAL"
    assert result.reason == "ROBUST_DEVIATION_WITHIN_THRESHOLD"


def test_extreme_fare_is_suspect_not_invalid():
    result = validate_outlier(
        observation("target", 11000),
        comparisons([3500, 3600, 3650, 3700, 3800]),
    )
    assert result.status == "SUSPECT"
    assert result.reason == "ROBUST_DEVIATION_ABOVE_THRESHOLD"
    assert "STATISTICAL_SCREEN_ONLY" in result.warnings


def test_small_sample_is_not_checkable():
    result = validate_outlier(
        observation("target", 3600),
        comparisons([3500, 3600, 3700, 3800]),
    )
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "INSUFFICIENT_COMPARISON_SAMPLE"


def test_missing_fare_is_not_checkable():
    result = validate_outlier(observation("target", None), comparisons([3500] * 5))
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "MISSING_OR_NON_POSITIVE_TOTAL_FARE"


def test_zero_fare_is_not_checkable():
    result = validate_outlier(observation("target", 0), comparisons([3500] * 5))
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "MISSING_OR_NON_POSITIVE_TOTAL_FARE"


def test_negative_fare_is_not_checkable():
    result = validate_outlier(observation("target", -100), comparisons([3500] * 5))
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "MISSING_OR_NON_POSITIVE_TOTAL_FARE"


def test_mad_zero_is_safe_for_equal_fares():
    result = validate_outlier(
        observation("target", 4000),
        comparisons([4000, 4000, 4000, 4000, 4000]),
    )
    assert result.status == "NORMAL"
    assert result.mad == 0
    assert result.score == 0


def test_mad_zero_can_flag_different_target_without_z_score():
    result = validate_outlier(
        observation("target", 4500),
        comparisons([4000, 4000, 4000, 4000, 4000]),
    )
    assert result.status == "SUSPECT"
    assert result.score is None
    assert "ROBUST_Z_UNDEFINED_WHEN_MAD_ZERO" in result.warnings


def test_high_genuine_fare_is_flagged_only():
    target = observation("target", 11000)
    before = copy.deepcopy(target)
    result = validate_outlier(target, comparisons([3500, 3600, 3700, 3800, 3900]))
    assert result.status == "SUSPECT"
    assert target == before


def test_different_route_is_excluded():
    result = validate_outlier(
        observation("target", 3600),
        comparisons([3500, 3600, 3700, 3800, 3900], route_id="DEL_BLR", destination="BLR"),
    )
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "INSUFFICIENT_COMPARISON_SAMPLE"


def test_origin_destination_market_keys_take_precedence_over_route_id():
    result = validate_outlier(
        observation("target", 3600, route_id="MARKET_A"),
        comparisons([3500, 3600, 3700, 3800, 3900], route_id="MARKET_B"),
    )
    assert result.status == "NORMAL"
    assert result.comparison_count == 5


def test_different_departure_date_is_excluded():
    result = validate_outlier(
        observation("target", 3600),
        comparisons([3500, 3600, 3700, 3800, 3900], departure_datetime="2026-09-21T10:00:00"),
    )
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "INSUFFICIENT_COMPARISON_SAMPLE"


def test_missing_stored_lead_uses_calendar_derived_lead():
    target = observation(
        "target",
        3600,
        target_lead_days=None,
        actual_lead_days=None,
        search_timestamp="2026-09-13T08:00:00+00:00",
        departure_datetime="2026-09-20T10:00:00+05:30",
    )
    peers = comparisons(
        [3500, 3600, 3700, 3800, 3900],
        target_lead_days=None,
        actual_lead_days=None,
        search_timestamp="2026-09-13T12:00:00+00:00",
        departure_datetime="2026-09-20T18:00:00+05:30",
    )
    result = validate_outlier(target, peers)
    assert result.status == "NORMAL"
    assert result.comparison_count == 5


def test_different_derived_lead_is_excluded():
    target = observation(
        "target",
        3600,
        target_lead_days=None,
        actual_lead_days=None,
        search_timestamp="2026-09-13T08:00:00+00:00",
        departure_datetime="2026-09-20T10:00:00+05:30",
    )
    peers = comparisons(
        [3500, 3600, 3700, 3800, 3900],
        target_lead_days=None,
        actual_lead_days=None,
        search_timestamp="2026-09-12T12:00:00+00:00",
        departure_datetime="2026-09-20T18:00:00+05:30",
    )
    result = validate_outlier(target, peers)
    assert result.status == "NOT_CHECKABLE"
    assert result.reason == "INSUFFICIENT_COMPARISON_SAMPLE"


def test_different_carrier_uses_documented_fallback():
    same_carrier = comparisons([3500, 3600, 3700], carrier_code="AI")
    other_carrier = comparisons([3550, 3650, 3750], carrier_code="SG")
    result = validate_outlier(observation("target", 3650), same_carrier + other_carrier)
    assert result.status == "NORMAL"
    assert result.method == "MEDIAN_MAD_CARRIER_FALLBACK"
    assert result.comparison_count == 6


def test_sold_comparisons_are_excluded():
    available = comparisons([3500, 3600, 3700, 3800, 3900])
    sold = comparisons([100000] * 5, is_sold=True)
    result = validate_outlier(observation("target", 3600), available + sold)
    assert result.status == "NORMAL"
    assert result.comparison_count == 5


def test_unknown_sold_flag_can_remain_eligible():
    result = validate_outlier(
        observation("target", 3600),
        comparisons([3500, 3600, 3700, 3800, 3900], is_sold=None),
    )
    assert result.status == "NORMAL"


def test_validator_does_not_use_database():
    result = validate_outlier(
        observation("target", 3600),
        comparisons([3500, 3600, 3700, 3800, 3900]),
    )
    assert result.status == "NORMAL"


if __name__ == "__main__":
    tests = [
        value
        for name, value in globals().items()
        if name.startswith("test_") and callable(value)
    ]
    for test in tests:
        test()
    print(f"ALL OUTLIER VALIDATOR TESTS PASSED ({len(tests)} tests)")

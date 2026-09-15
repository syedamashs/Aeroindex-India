from __future__ import annotations

from typing import Any, Iterable, Mapping


CONFIDENCE_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}


def _number(value: Any, default: float | None = None) -> float | None:
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp_score(score: float) -> int:
    return max(0, min(100, int(round(score))))


def _movement_pct(index_relative: Any) -> float | None:
    relative = _number(index_relative)
    return (relative - 1.0) * 100.0 if relative is not None else None


def assess_index_confidence(metrics: Mapping[str, Any]) -> dict[str, Any]:
    """Assess comparability without changing the supplied index relative."""

    previous_count = _number(metrics.get("previous_eligible_item_count"), 0.0)
    current_count = _number(metrics.get("current_eligible_item_count"), 0.0)
    overlap_pct = _number(metrics.get("overlap_pct"))
    median_change_pct = _number(metrics.get("median_change_pct"))
    previous_iqr = _number(metrics.get("previous_iqr"))
    current_iqr = _number(metrics.get("current_iqr"))
    index_relative = metrics.get("index_relative")

    flags: list[str] = []
    reasons: list[str] = []
    score = 100.0

    if overlap_pct is None:
        flags.append("OVERLAP_UNKNOWN")
        reasons.append("overlap percentage is unavailable")
        score -= 40
    elif overlap_pct < 25:
        flags.append("LOW_OVERLAP")
        reasons.append("overlap is below 25%")
        score -= 40
    elif overlap_pct < 50:
        flags.append("MODERATE_OVERLAP")
        reasons.append("overlap is between 25% and 50%")
        score -= 20
    else:
        flags.append("HIGH_OVERLAP")

    minimum_count = min(previous_count or 0.0, current_count or 0.0)
    if minimum_count < 10:
        flags.append("LOW_SAMPLE")
        reasons.append("one or both eligible sample counts are below 10")
        score -= 30
    if minimum_count < 5:
        flags.append("VERY_LOW_SAMPLE")
        reasons.append("one or both eligible sample counts are below 5")
        score -= 20

    absolute_median_change = abs(median_change_pct) if median_change_pct is not None else None
    if absolute_median_change is None:
        flags.append("MEDIAN_CHANGE_UNKNOWN")
        reasons.append("median percentage change is unavailable")
    elif absolute_median_change > 50:
        flags.extend(("LARGE_MEDIAN_CHANGE", "VERY_LARGE_MEDIAN_CHANGE"))
        reasons.append("absolute median change is above 50%")
        score -= 30
    elif absolute_median_change > 20:
        flags.append("LARGE_MEDIAN_CHANGE")
        reasons.append("absolute median change is above 20%")
        score -= 10

    if previous_iqr is not None and current_iqr is not None and previous_iqr != 0:
        iqr_change = abs((current_iqr / previous_iqr) - 1.0) * 100.0
        if iqr_change > 50:
            flags.append("DISTRIBUTION_SHIFT")
            reasons.append("IQR changed by more than 50%")

    score = _clamp_score(score)
    clearly_low = (
        overlap_pct is None
        or overlap_pct < 25
        or minimum_count < 10
        or absolute_median_change is None
        or absolute_median_change > 50
    )
    clearly_high = (
        overlap_pct is not None
        and overlap_pct >= 50
        and minimum_count >= 10
        and absolute_median_change is not None
        and absolute_median_change <= 20
    )
    if clearly_low:
        confidence_level = "LOW"
    elif clearly_high:
        confidence_level = "HIGH"
    elif overlap_pct is not None and overlap_pct >= 25 and minimum_count >= 10:
        confidence_level = "MEDIUM"
    else:
        confidence_level = "LOW"

    if confidence_level == "HIGH":
        warning = None
        publishability = "publishable"
    elif confidence_level == "MEDIUM":
        warning = "Publishable with a comparability warning."
        publishability = "publishable_with_warning"
    else:
        warning = "Low comparability confidence; publish only with an explicit warning."
        publishability = "publishable_with_warning"

    return {
        "route_id": metrics.get("route_id"),
        "lead_time": metrics.get("lead_time"),
        "source": metrics.get("source"),
        "confidence_level": confidence_level,
        "confidence_score": score,
        "flags": tuple(dict.fromkeys(flags)),
        "reasons": tuple(dict.fromkeys(reasons)),
        "overlap_pct": metrics.get("overlap_pct"),
        "previous_eligible_item_count": metrics.get("previous_eligible_item_count"),
        "current_eligible_item_count": metrics.get("current_eligible_item_count"),
        "median_change_pct": metrics.get("median_change_pct"),
        "previous_iqr": metrics.get("previous_iqr"),
        "current_iqr": metrics.get("current_iqr"),
        "index_relative": index_relative,
        "index_movement_pct": _movement_pct(index_relative),
        "is_publishable": True,
        "publishability": publishability,
        "warning": warning,
    }


def aggregate_index_confidence(
    source_results: Iterable[Mapping[str, Any]],
) -> dict[str, Any]:
    """Aggregate source confidence conservatively by the weakest source."""

    ordered_results = tuple(
        sorted(source_results, key=lambda result: str(result.get("source", "")))
    )
    if not ordered_results:
        return {
            "route_id": None,
            "lead_time": None,
            "overall_confidence": "LOW",
            "source_results": (),
            "low_confidence_sources": (),
            "average_confidence_score": 0.0,
            "minimum_confidence_score": 0,
            "overall_flags": ("NO_CONTRIBUTING_SOURCES",),
        }

    weakest = min(
        ordered_results,
        key=lambda result: CONFIDENCE_ORDER.get(result.get("confidence_level"), -1),
    )
    scores = [float(result.get("confidence_score", 0)) for result in ordered_results]
    low_sources = tuple(
        result.get("source")
        for result in ordered_results
        if result.get("confidence_level") == "LOW"
    )
    flags = tuple(dict.fromkeys(
        flag
        for result in ordered_results
        for flag in result.get("flags", ())
    ))
    return {
        "route_id": weakest.get("route_id"),
        "lead_time": weakest.get("lead_time"),
        "overall_confidence": weakest.get("confidence_level"),
        "source_results": ordered_results,
        "low_confidence_sources": low_sources,
        "average_confidence_score": sum(scores) / len(scores),
        "minimum_confidence_score": min(scores),
        "overall_flags": flags,
    }
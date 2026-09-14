from __future__ import annotations

from collections import Counter
from typing import Any, Iterable


# Fields that define the economic/observational identity
# of one fare observation.
DUPLICATE_FIELDS = (
    "source",
    "search_timestamp",
    "origin",
    "destination",
    "departure_datetime",
    "arrival_datetime",
    "carrier_code",
    "flight_number",
    "flight_id",
    "journey_id",
    "source_offer_id",
    "fare_availability_key",
    "fare_product_class",
    "fare_class",
    "fare_family",
    "base_fare",
    "taxes",
    "total_fees",
    "total_fare",
    "is_sold",
)


def _normalize(value: Any) -> str:
    if value is None:
        return ""

    return str(value).strip().casefold()


def build_duplicate_key(observation: dict[str, Any]) -> tuple:
    """
    Build a deterministic key representing the full
    observational/economic identity of a fare observation.
    """

    return tuple(
        _normalize(observation.get(field))
        for field in DUPLICATE_FIELDS
    )


def find_duplicates(
    observations: Iterable[dict[str, Any]],
) -> dict[str, Any]:
    observations = list(observations)

    key_to_observations: dict[tuple, list[dict[str, Any]]] = {}

    for observation in observations:
        key = build_duplicate_key(observation)

        key_to_observations.setdefault(key, []).append(observation)

    duplicate_groups = []

    for key, rows in key_to_observations.items():
        if len(rows) > 1:
            duplicate_groups.append(
                {
                    "key": key,
                    "count": len(rows),
                    "observation_ids": [
                        row.get("observation_id")
                        for row in rows
                    ],
                }
            )

    duplicate_rows = sum(
        group["count"]
        for group in duplicate_groups
    )

    extra_duplicate_rows = sum(
        group["count"] - 1
        for group in duplicate_groups
    )

    return {
        "total_observations": len(observations),
        "unique_keys": len(key_to_observations),
        "duplicate_groups": duplicate_groups,
        "duplicate_group_count": len(duplicate_groups),
        "duplicate_rows": duplicate_rows,
        "extra_duplicate_rows": extra_duplicate_rows,
    }


def summarize_by_source(
    observations: Iterable[dict[str, Any]],
) -> dict[str, dict[str, int]]:
    observations = list(observations)

    source_keys: dict[str, Counter] = {}

    for observation in observations:
        source = (
            str(observation.get("source") or "UNKNOWN")
            .strip()
            .casefold()
        )

        key = build_duplicate_key(observation)

        if source not in source_keys:
            source_keys[source] = Counter()

        source_keys[source][key] += 1

    summary = {}

    for source, counts in source_keys.items():
        duplicate_groups = sum(
            1 for count in counts.values()
            if count > 1
        )

        duplicate_rows = sum(
            count for count in counts.values()
            if count > 1
        )

        extra_rows = sum(
            count - 1
            for count in counts.values()
            if count > 1
        )

        summary[source] = {
            "observations": sum(counts.values()),
            "unique_keys": len(counts),
            "duplicate_groups": duplicate_groups,
            "duplicate_rows": duplicate_rows,
            "extra_duplicate_rows": extra_rows,
        }

    return summary
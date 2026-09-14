from __future__ import annotations

import sqlite3
from collections import Counter, defaultdict
from pathlib import Path

from outlier_validator import validate_observations


DB_PATH = Path(__file__).resolve().parents[1] / "data" / "apix.db"


def load_observations():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    try:
        rows = conn.execute(
            """
            SELECT *
            FROM apix_observations
            ORDER BY source, departure_datetime, observation_id
            """
        ).fetchall()
    finally:
        conn.close()

    return [dict(row) for row in rows]


def group_key(obs):
    """
    Primary comparison group:
        route + departure date + actual lead time + carrier

    The validator itself handles the fallback across carriers.
    """
    departure = obs.get("departure_datetime")
    departure_date = str(departure).split("T")[0] if departure else None

    return (
        obs.get("origin"),
        obs.get("destination"),
        departure_date,
        obs.get("actual_lead_days"),
        obs.get("carrier_code") or obs.get("source"),
    )


def build_groups(observations):
    groups = defaultdict(list)

    for obs in observations:
        groups[group_key(obs)].append(obs)

    return groups


def main():
    print(f"Database: {DB_PATH}")

    observations = load_observations()

    print(f"Observations loaded: {len(observations)}")

    if not observations:
        print("No observations found.")
        return

    status_counts = Counter()
    reason_counts = Counter()

    source_counts = defaultdict(Counter)
    route_counts = defaultdict(Counter)

    suspect_rows = []

    results = validate_observations(observations)
    observations_by_id = {
        observation.get("observation_id"): observation
        for observation in observations
    }

    for result in results:
        observation = observations_by_id.get(result.observation_id, {})
        status = result.status
        reason = result.reason

        status_counts[status] += 1

        if reason:
            reason_counts[reason] += 1

        source = observation.get("source", "UNKNOWN")
        source_counts[source][status] += 1

        route = (
            f"{observation.get('origin', '?')}"
            f" -> "
            f"{observation.get('destination', '?')}"
        )
        route_counts[route][status] += 1

        if status == "SUSPECT":
            suspect_rows.append((result, observation))

    print()
    print("OUTLIER DQE RESULT")
    print("-" * 60)

    print(f"NORMAL:         {status_counts['NORMAL']}")
    print(f"SUSPECT:        {status_counts['SUSPECT']}")
    print(f"NOT_CHECKABLE:  {status_counts['NOT_CHECKABLE']}")

    print()
    print("REASONS")
    print("-" * 60)

    for reason, count in sorted(reason_counts.items()):
        print(f"{reason}: {count}")

    print()
    print("SOURCE BREAKDOWN")
    print("-" * 60)

    for source in sorted(source_counts):
        counts = source_counts[source]
        print(source)
        print(f"  NORMAL:        {counts['NORMAL']}")
        print(f"  SUSPECT:       {counts['SUSPECT']}")
        print(f"  NOT_CHECKABLE: {counts['NOT_CHECKABLE']}")

    print()
    print("ROUTE BREAKDOWN")
    print("-" * 60)

    for route in sorted(route_counts):
        counts = route_counts[route]

        if counts["SUSPECT"] > 0 or counts["NOT_CHECKABLE"] > 0:
            print(route)
            print(f"  NORMAL:        {counts['NORMAL']}")
            print(f"  SUSPECT:       {counts['SUSPECT']}")
            print(f"  NOT_CHECKABLE: {counts['NOT_CHECKABLE']}")

    print()
    print("SUSPECT OBSERVATIONS")
    print("-" * 60)

    if not suspect_rows:
        print("No suspect outliers found.")
    else:
        for result, obs in suspect_rows[:50]:

            print(
                f"{obs.get('observation_id')} | "
                f"{obs.get('source')} | "
                f"{obs.get('origin')}->{obs.get('destination')} | "
                f"{obs.get('departure_datetime')} | "
                f"fare={obs.get('total_fare')} | "
                f"reason={result.reason}"
            )

        if len(suspect_rows) > 50:
            print(f"... {len(suspect_rows) - 50} more suspect observations")

    print()
    print("DQE STEP 7 DATABASE CHECK COMPLETE ✓")
    print("DATABASE WAS READ ONLY — NO RECORDS WERE MODIFIED")


if __name__ == "__main__":
    main()
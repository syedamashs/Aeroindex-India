from pathlib import Path
import sqlite3
import sys

BACKEND_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BACKEND_DIR / "data" / "apix.db"

sys.path.insert(0, str(BACKEND_DIR))

from run_transition_readiness import (
    get_latest_two_successful_runs,
    load_observations,
)

from transition_readiness import match_repeated_snapshots
from transition_engine import (
    build_transition,
    summarize_transitions,
)


def main():
    print("=" * 68)
    print("FARE-STATE TRANSITION ENGINE — REAL DB ANALYSIS")
    print("=" * 68)
    print(f"Database: {DB_PATH}")
    print("Mode    : READ ONLY")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    try:
        previous_run, current_run = get_latest_two_successful_runs(conn)

        print()
        print(f"Previous run: {previous_run['run_id']}")
        print(f"Newest run  : {current_run['run_id']}")

        previous_obs = load_observations(
            conn,
            previous_run["run_id"],
        )

        current_obs = load_observations(
            conn,
            current_run["run_id"],
        )

        print()
        print("-" * 68)
        print("OBSERVATIONS")
        print("-" * 68)
        print(f"Previous observations : {len(previous_obs)}")
        print(f"Newest observations   : {len(current_obs)}")

        match_result = match_repeated_snapshots(
            previous_obs,
            current_obs,
        )

        previous_by_id = {
            observation.observation_id: observation
            for observation in previous_obs
        }
        current_by_id = {
            observation.observation_id: observation
            for observation in current_obs
        }

        transitions = [
            build_transition(
                previous_by_id[comparison["old_observation_id"]],
                current_by_id[comparison["new_observation_id"]],
            )
            for comparison in match_result["comparisons"]
        ]

        summary = summarize_transitions(transitions)

        print()
        print("-" * 68)
        print("TRANSITION RESULTS")
        print("-" * 68)

        print(
            f"Comparable transitions : "
            f"{summary['total_transitions']}"
        )

        for transition_type, count in sorted(
            summary["counts"].items()
        ):
            print(f"{transition_type:<24} {count}")

        print()
        print("-" * 68)
        print("FARE ESCALATION PRESSURE")
        print("-" * 68)

        fep = summary["fare_escalation_pressure"]

        if fep is None:
            print("FEP : NOT CALCULABLE")
        else:
            print(f"FEP : {fep:.6f}")
            print(f"FEP%: {fep * 100:.2f}%")

        print()
        print("-" * 68)
        print("SAMPLE TRANSITIONS")
        print("-" * 68)

        for transition in transitions[:10]:
            print(
                f"{transition.source} "
                f"{transition.origin}->{transition.destination} | "
                f"{transition.flight_number or '-'} | "
                f"{transition.fare_family or '-'} | "
                f"{transition.previous_total_fare} -> "
                f"{transition.current_total_fare} | "
                f"{transition.transition_type}"
            )

        print()
        print("=" * 68)
        print("DATABASE WAS READ ONLY — NO RECORDS WERE MODIFIED")
        print("=" * 68)

    finally:
        conn.close()


if __name__ == "__main__":
    main()
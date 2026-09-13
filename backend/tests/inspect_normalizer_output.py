from __future__ import annotations

import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


from normalizers.airindia_normalizer import normalize_airindia
from normalizers.indigo_normalizer import normalize_indigo
from normalizers.spicejet_normalizer import normalize_spicejet


RAW_FILES = {
    "airindia": PROJECT_ROOT
    / "data"
    / "raw"
    / "airindia"
    / "20260913_174523_325967_DELHI_MUMBAI_2026-09-20_task_d8e33501a1c1.json",

    "indigo": PROJECT_ROOT
    / "data"
    / "raw"
    / "indigo"
    / "20260913_173605_285140_DELHI_MUMBAI_2026-09-20_task_3417e0dfe5f2.json",

    "spicejet": PROJECT_ROOT
    / "data"
    / "raw"
    / "spicejet"
    / "20260913_173619_542218_DELHI_MUMBAI_2026-09-20_task_9efde1dbeaec.json",
}


TASKS = {
    "airindia": {
        "run_id": "AUDIT_RUN",
        "task_id": "AUDIT_AI_001",
        "route_id": "DELHI_MUMBAI",
        "origin": "DEL",
        "destination": "BOM",
        "departure_date": "2026-09-20",
        "target_lead_days": 7,
    },

    "indigo": {
        "run_id": "AUDIT_RUN",
        "task_id": "AUDIT_6E_001",
        "route_id": "DELHI_MUMBAI",
        "origin": "DEL",
        "destination": "BOM",
        "departure_date": "2026-09-20",
        "target_lead_days": 7,
    },

    "spicejet": {
        "run_id": "AUDIT_RUN",
        "task_id": "AUDIT_SG_001",
        "route_id": "DELHI_MUMBAI",
        "origin": "DEL",
        "destination": "BOM",
        "departure_date": "2026-09-20",
        "target_lead_days": 7,
    },
}


NORMALIZERS = {
    "airindia": normalize_airindia,
    "indigo": normalize_indigo,
    "spicejet": normalize_spicejet,
}


def main():
    print()
    print("=" * 70)
    print("APIx NORMALIZER OUTPUT DIAGNOSTIC")
    print("=" * 70)

    for source in (
        "airindia",
        "indigo",
        "spicejet",
    ):
        print()
        print("=" * 70)
        print(source.upper())
        print("=" * 70)

        raw_path = RAW_FILES[source]
        task = TASKS[source]
        normalizer = NORMALIZERS[source]

        with raw_path.open(
            "r",
            encoding="utf-8",
        ) as f:
            raw_json = json.load(f)

        result = normalizer(
            raw_json,
            task,
        )

        print()
        print("Return type:")
        print(
            type(result)
        )

        print()
        print("Representation:")
        print(
            repr(result)[:5000]
        )

        if isinstance(result, dict):
            print()
            print("Dictionary keys:")
            print(
                list(result.keys())
            )

        elif isinstance(result, tuple):
            print()
            print("Tuple length:")
            print(
                len(result)
            )

            for i, item in enumerate(result):
                print()
                print(
                    f"Tuple item {i}:"
                )
                print(
                    f"  type = {type(item)}"
                )
                print(
                    f"  repr = {repr(item)[:2000]}"
                )

        elif hasattr(result, "columns"):
            print()
            print("DataFrame-like columns:")
            print(
                list(result.columns)
            )

        print()


if __name__ == "__main__":
    main()
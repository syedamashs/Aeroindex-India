from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path
from typing import Any, Iterable

# Allow direct execution from backend/storage as well as package imports.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database.connection import get_connection


# ============================================================
# APIx CANONICAL SCHEMA
# ============================================================

APIX_COLUMNS = (
    "observation_id",
    "source",
    "source_url",
    "search_timestamp",
    "extraction_status",
    "currency",
    "origin",
    "destination",
    "origin_city",
    "destination_city",
    "departure_datetime",
    "arrival_datetime",
    "departure_utc",
    "arrival_utc",
    "duration_minutes",
    "flight_number",
    "carrier_code",
    "marketing_airline",
    "operating_airline",
    "flight_id",
    "journey_id",
    "aircraft_code",
    "stops",
    "flight_type",
    "departure_terminal",
    "arrival_terminal",
    "code_share_indicator",
    "schedule_service_type",
    "fare_product_class",
    "fare_class",
    "fare_family",
    "source_offer_id",
    "fare_availability_key",
    "base_fare",
    "taxes",
    "total_fees",
    "total_fare",
    "is_cheapest_offer",
    "is_sold",
    "filling_fast",
    "service_charges",
    "original_fare_amount",
    "original_published_amount",
    "original_total_discount",
    "passenger_type",
)


# ============================================================
# SOURCE-SPECIFIC COLUMNS
# ============================================================

AIRINDIA_DETAIL_COLUMNS = (
    "observation_id",
    "air_bound_id",
    "air_offer_id",
    "fare_info_id",
    "fare_family_hierarchy",
    "commercial_fare_family",
    "fare_type",
    "booking_class",
    "quota",
    "status_code",
    "baggage_kg",
    "change_fee",
    "cancel_refund_fee",
    "service_ids",
    "raw_fare_payload",
)


INDIGO_DETAIL_COLUMNS = (
    "observation_id",
    "product_class",
    "fare_availability_key",
    "fare_class",
    "passenger_fare_index",
    "total_fare_amount",
    "total_publish_fare",
    "total_tax",
    "service_charges_json",
    "journey_key",
    "segment_count",
    "raw_fare_payload",
)


SPICEJET_DETAIL_COLUMNS = (
    "observation_id",
    "fare_code",
    "class_of_service",
    "fare_sequence",
    "fare_status",
    "segment_key",
    "operating_flight_number",
    "capacity",
    "adjusted_capacity",
    "sold",
    "unit_sold",
    "lid",
    "prbc_code",
    "ticket_codes",
    "travel_class_code",
    "raw_fare_payload",
)


SUPPORTED_SOURCES = {
    "airindia",
    "indigo",
    "spicejet",
}


# ============================================================
# VALIDATION
# ============================================================

def validate_observation(observation: dict[str, Any]) -> None:
    """
    Validate one canonical observation before database insertion.
    """

    missing = [
        column
        for column in APIX_COLUMNS
        if column not in observation
    ]

    if missing:
        raise ValueError(
            "Observation is missing canonical fields: "
            + ", ".join(missing)
        )

    observation_id = observation.get("observation_id")

    if not observation_id:
        raise ValueError(
            "observation_id cannot be empty."
        )

    source = str(
        observation.get("source", "")
    ).strip().lower()

    if source not in SUPPORTED_SOURCES:
        raise ValueError(
            f"Unsupported source: {source}"
        )

    origin = observation.get("origin")
    destination = observation.get("destination")

    if not origin or not destination:
        raise ValueError(
            "origin and destination are required."
        )

    total_fare = observation.get("total_fare")

    if total_fare is not None:
        try:
            float(total_fare)
        except (TypeError, ValueError):
            raise ValueError(
                f"Invalid total_fare: {total_fare}"
            )


# ============================================================
# VALUE SERIALIZATION
# ============================================================

def serialize_value(value: Any) -> Any:
    """
    Convert Python values into SQLite-compatible values.

    Dictionaries/lists are stored as JSON strings.
    """

    if value is None:
        return None

    if isinstance(value, (dict, list, tuple)):
        return json.dumps(
            value,
            ensure_ascii=False,
            separators=(",", ":"),
        )

    if isinstance(value, bool):
        return int(value)

    return value


# ============================================================
# CANONICAL OBSERVATION INSERT
# ============================================================

def insert_observation(
    observation: dict[str, Any],
) -> bool:
    """
    Insert one canonical observation.

    Returns:
        True  -> inserted
        False -> already existed
    """

    validate_observation(observation)

    values = [
        serialize_value(
            observation.get(column)
        )
        for column in APIX_COLUMNS
    ]

    placeholders = ", ".join(
        ["?"] * len(APIX_COLUMNS)
    )

    columns_sql = ", ".join(APIX_COLUMNS)

    sql = f"""
        INSERT OR IGNORE INTO apix_observations (
            {columns_sql}
        )
        VALUES (
            {placeholders}
        )
    """

    with get_connection() as connection:

        cursor = connection.execute(
            sql,
            values,
        )

        connection.commit()

        return cursor.rowcount == 1


# ============================================================
# MULTIPLE OBSERVATIONS
# ============================================================

def insert_observations(
    observations: Iterable[dict[str, Any]],
) -> int:
    """
    Insert multiple canonical observations in one transaction.

    Returns:
        Number of newly inserted observations.
    """

    observations = list(observations)

    if not observations:
        return 0

    for observation in observations:
        validate_observation(observation)

    columns_sql = ", ".join(APIX_COLUMNS)

    placeholders = ", ".join(
        ["?"] * len(APIX_COLUMNS)
    )

    sql = f"""
        INSERT OR IGNORE INTO apix_observations (
            {columns_sql}
        )
        VALUES (
            {placeholders}
        )
    """

    inserted_count = 0

    with get_connection() as connection:

        try:

            for observation in observations:

                values = [
                    serialize_value(
                        observation.get(column)
                    )
                    for column in APIX_COLUMNS
                ]

                cursor = connection.execute(
                    sql,
                    values,
                )

                inserted_count += cursor.rowcount

            connection.commit()

        except Exception:
            connection.rollback()
            raise

    return inserted_count


# ============================================================
# AIR INDIA DETAILS
# ============================================================

def insert_airindia_details(
    details: dict[str, Any],
) -> bool:
    """
    Insert Air India source-specific details.

    The corresponding canonical observation must already exist.
    """

    observation_id = details.get(
        "observation_id"
    )

    if not observation_id:
        raise ValueError(
            "Air India details require observation_id."
        )

    values = [
        serialize_value(
            details.get(column)
        )
        for column in AIRINDIA_DETAIL_COLUMNS
    ]

    columns_sql = ", ".join(
        AIRINDIA_DETAIL_COLUMNS
    )

    placeholders = ", ".join(
        ["?"] * len(AIRINDIA_DETAIL_COLUMNS)
    )

    sql = f"""
        INSERT OR REPLACE INTO airindia_details (
            {columns_sql}
        )
        VALUES (
            {placeholders}
        )
    """

    with get_connection() as connection:

        cursor = connection.execute(
            sql,
            values,
        )

        connection.commit()

        return cursor.rowcount == 1


# ============================================================
# INDIGO DETAILS
# ============================================================

def insert_indigo_details(
    details: dict[str, Any],
) -> bool:
    """
    Insert IndiGo source-specific details.
    """

    observation_id = details.get(
        "observation_id"
    )

    if not observation_id:
        raise ValueError(
            "IndiGo details require observation_id."
        )

    values = [
        serialize_value(
            details.get(column)
        )
        for column in INDIGO_DETAIL_COLUMNS
    ]

    columns_sql = ", ".join(
        INDIGO_DETAIL_COLUMNS
    )

    placeholders = ", ".join(
        ["?"] * len(INDIGO_DETAIL_COLUMNS)
    )

    sql = f"""
        INSERT OR REPLACE INTO indigo_details (
            {columns_sql}
        )
        VALUES (
            {placeholders}
        )
    """

    with get_connection() as connection:

        cursor = connection.execute(
            sql,
            values,
        )

        connection.commit()

        return cursor.rowcount == 1


# ============================================================
# SPICEJET DETAILS
# ============================================================

def insert_spicejet_details(
    details: dict[str, Any],
) -> bool:
    """
    Insert SpiceJet source-specific details.
    """

    observation_id = details.get(
        "observation_id"
    )

    if not observation_id:
        raise ValueError(
            "SpiceJet details require observation_id."
        )

    values = [
        serialize_value(
            details.get(column)
        )
        for column in SPICEJET_DETAIL_COLUMNS
    ]

    columns_sql = ", ".join(
        SPICEJET_DETAIL_COLUMNS
    )

    placeholders = ", ".join(
        ["?"] * len(SPICEJET_DETAIL_COLUMNS)
    )

    sql = f"""
        INSERT OR REPLACE INTO spicejet_details (
            {columns_sql}
        )
        VALUES (
            {placeholders}
        )
    """

    with get_connection() as connection:

        cursor = connection.execute(
            sql,
            values,
        )

        connection.commit()

        return cursor.rowcount == 1


# ============================================================
# COMPLETE SOURCE INSERT
# ============================================================

def insert_source_data(
    observations: Iterable[dict[str, Any]],
    details: Iterable[dict[str, Any]] | None = None,
) -> dict[str, int]:
    """
    Insert canonical observations and optional source-specific
    details inside one database transaction.

    Parameters
    ----------
    observations:
        Iterable of canonical 45-field observations.

    details:
        Optional iterable containing source-specific dictionaries.

        Each detail dictionary must contain:
            source
            observation_id

    Returns
    -------
    dict:
        {
            "observations_inserted": int,
            "details_inserted": int
        }
    """

    observations = list(observations)

    if not observations:
        return {
            "observations_inserted": 0,
            "details_inserted": 0,
        }

    if details is None:
        details = []

    details = list(details)

    for observation in observations:
        validate_observation(observation)

    observation_sql = f"""
        INSERT OR IGNORE INTO apix_observations (
            {", ".join(APIX_COLUMNS)}
        )
        VALUES (
            {", ".join(["?"] * len(APIX_COLUMNS))}
        )
    """

    detail_sql = {
        "airindia": f"""
            INSERT OR REPLACE INTO airindia_details (
                {", ".join(AIRINDIA_DETAIL_COLUMNS)}
            )
            VALUES (
                {", ".join(["?"] * len(AIRINDIA_DETAIL_COLUMNS))}
            )
        """,

        "indigo": f"""
            INSERT OR REPLACE INTO indigo_details (
                {", ".join(INDIGO_DETAIL_COLUMNS)}
            )
            VALUES (
                {", ".join(["?"] * len(INDIGO_DETAIL_COLUMNS))}
            )
        """,

        "spicejet": f"""
            INSERT OR REPLACE INTO spicejet_details (
                {", ".join(SPICEJET_DETAIL_COLUMNS)}
            )
            VALUES (
                {", ".join(["?"] * len(SPICEJET_DETAIL_COLUMNS))}
            )
        """,
    }

    inserted_observations = 0
    inserted_details = 0

    with get_connection() as connection:

        try:

            # ------------------------------------------------
            # Canonical observations
            # ------------------------------------------------

            for observation in observations:

                values = [
                    serialize_value(
                        observation.get(column)
                    )
                    for column in APIX_COLUMNS
                ]

                cursor = connection.execute(
                    observation_sql,
                    values,
                )

                inserted_observations += cursor.rowcount

            # ------------------------------------------------
            # Source-specific details
            # ------------------------------------------------

            for detail in details:

                source = str(
                    detail.get("source", "")
                ).strip().lower()

                observation_id = detail.get(
                    "observation_id"
                )

                if source not in detail_sql:
                    raise ValueError(
                        f"Unsupported detail source: {source}"
                    )

                if not observation_id:
                    raise ValueError(
                        "Source-specific detail requires "
                        "observation_id."
                    )

                # Verify parent observation exists.
                parent = connection.execute(
                    """
                    SELECT 1
                    FROM apix_observations
                    WHERE observation_id = ?
                    """,
                    (observation_id,),
                ).fetchone()

                if parent is None:
                    raise ValueError(
                        "Cannot insert source-specific details "
                        f"for missing observation: {observation_id}"
                    )

                if source == "airindia":
                    columns = AIRINDIA_DETAIL_COLUMNS

                elif source == "indigo":
                    columns = INDIGO_DETAIL_COLUMNS

                else:
                    columns = SPICEJET_DETAIL_COLUMNS

                values = [
                    serialize_value(
                        detail.get(column)
                    )
                    for column in columns
                ]

                cursor = connection.execute(
                    detail_sql[source],
                    values,
                )

                inserted_details += cursor.rowcount

            connection.commit()

        except Exception:
            connection.rollback()
            raise

    return {
        "observations_inserted": inserted_observations,
        "details_inserted": inserted_details,
    }


# ============================================================
# READ FUNCTIONS
# ============================================================

def get_observation(
    observation_id: str,
) -> dict[str, Any] | None:
    """
    Retrieve one canonical observation by ID.
    """

    with get_connection() as connection:

        row = connection.execute(
            """
            SELECT *
            FROM apix_observations
            WHERE observation_id = ?
            """,
            (observation_id,),
        ).fetchone()

    if row is None:
        return None

    return dict(row)


def count_observations(
    source: str | None = None,
) -> int:
    """
    Count canonical observations.

    If source is supplied, count only that source.
    """

    with get_connection() as connection:

        if source is None:

            row = connection.execute(
                """
                SELECT COUNT(*) AS count
                FROM apix_observations
                """
            ).fetchone()

        else:

            row = connection.execute(
                """
                SELECT COUNT(*) AS count
                FROM apix_observations
                WHERE source = ?
                """,
                (source.lower(),),
            ).fetchone()

    return int(row["count"])


# ============================================================
# DATABASE SUMMARY
# ============================================================

def get_storage_summary() -> dict[str, int]:
    """
    Return observation counts by airline.
    """

    with get_connection() as connection:

        rows = connection.execute(
            """
            SELECT
                source,
                COUNT(*) AS count
            FROM apix_observations
            GROUP BY source
            ORDER BY source
            """
        ).fetchall()

    summary = {
        "airindia": 0,
        "indigo": 0,
        "spicejet": 0,
    }

    for row in rows:
        source = row["source"]

        if source in summary:
            summary[source] = int(
                row["count"]
            )

    return summary


# ============================================================
# MODULE TEST
# ============================================================

if __name__ == "__main__":

    print("=" * 60)
    print("APIx OBSERVATION STORAGE MODULE")
    print("=" * 60)

    print()
    print("Storage module loaded successfully.")

    print()
    print("Supported sources:")

    for source in sorted(SUPPORTED_SOURCES):
        print(f"  ✓ {source}")

    print()
    print("Current database observations:")

    summary = get_storage_summary()

    for source, count in summary.items():
        print(f"  {source}: {count}")

    print()
    print("Storage module check completed.")
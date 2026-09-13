from __future__ import annotations

import sqlite3
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATABASE_PATH = PROJECT_ROOT / "data" / "apix.db"

COLUMNS = (
    "observation_id",
    "source",
    "origin",
    "destination",
    "flight_number",
    "departure_datetime",
    "total_fare",
)


def print_last_observations(limit: int = 20) -> None:
    """Print the latest observations as an aligned table."""

    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            f"""
            SELECT {", ".join(COLUMNS)}
            FROM apix_observations
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    if not rows:
        print("No observations found.")
        return

    values = [
        [str(row[column] if row[column] is not None else "") for column in COLUMNS]
        for row in rows
    ]
    widths = [
        max(len(column), *(len(row[index]) for row in values))
        for index, column in enumerate(COLUMNS)
    ]
    separator = "-+-".join("-" * width for width in widths)

    print(" | ".join(column.ljust(widths[index]) for index, column in enumerate(COLUMNS)))
    print(separator)
    for row in values:
        print(" | ".join(value.ljust(widths[index]) for index, value in enumerate(row)))


if __name__ == "__main__":
    print_last_observations()

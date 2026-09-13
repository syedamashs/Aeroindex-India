from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


# ============================================================
# PATHS
# ============================================================

# database/connection.py
# parents[1] = APIx/
PROJECT_ROOT = Path(__file__).resolve().parents[1]

DATA_DIR = PROJECT_ROOT / "data"
DATABASE_PATH = DATA_DIR / "apix.db"
SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"


# ============================================================
# DIRECTORY SETUP
# ============================================================

def ensure_database_directory() -> None:
    """Create the data directory if it does not already exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# CONNECTION
# ============================================================

def get_connection() -> sqlite3.Connection:
    """
    Create and return a configured SQLite connection.

    Foreign-key enforcement is enabled for every connection.
    Row factory allows rows to be accessed by column name.
    """

    ensure_database_directory()

    connection = sqlite3.connect(
        DATABASE_PATH,
        timeout=30,
    )

    connection.row_factory = sqlite3.Row

    # Enable foreign-key constraints.
    connection.execute("PRAGMA foreign_keys = ON;")

    return connection


# ============================================================
# SCHEMA INITIALIZATION
# ============================================================

def initialize_database() -> None:
    """
    Create all APIx database tables and indexes defined
    in schema.sql.
    """

    if not SCHEMA_PATH.exists():
        raise FileNotFoundError(
            f"Database schema not found: {SCHEMA_PATH}"
        )

    ensure_database_directory()

    schema_sql = SCHEMA_PATH.read_text(
        encoding="utf-8"
    )

    with get_connection() as connection:
        connection.executescript(schema_sql)
        connection.commit()


# ============================================================
# DATABASE HEALTH CHECK
# ============================================================

def database_exists() -> bool:
    """Return True if the SQLite database file exists."""
    return DATABASE_PATH.exists()


def get_table_names() -> list[str]:
    """Return all user-created tables in the database."""

    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
              AND name NOT LIKE 'sqlite_%'
            ORDER BY name;
            """
        ).fetchall()

    return [row["name"] for row in rows]


# ============================================================
# SIMPLE QUERY HELPER
# ============================================================

def execute(
    sql: str,
    parameters: tuple | list = (),
) -> sqlite3.Cursor:
    """
    Execute a single SQL statement and commit it.

    Intended for simple database operations.
    More complex transactions should use get_connection()
    directly.
    """

    connection = get_connection()

    try:
        cursor = connection.execute(
            sql,
            parameters,
        )

        connection.commit()

        return cursor

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


# ============================================================
# CONTEXT MANAGER
# ============================================================

@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    """
    Context-manager-style helper for database operations.

    Example:

        with connection() as conn:
            conn.execute(...)
            conn.commit()
    """

    conn = get_connection()

    try:
        yield conn
    finally:
        conn.close()


# ============================================================
# COMMAND-LINE DATABASE INITIALIZATION
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("APIx DATABASE INITIALIZATION")
    print("=" * 60)

    initialize_database()

    print(f"Database: {DATABASE_PATH}")
    print()

    tables = get_table_names()

    print(f"Tables created: {len(tables)}")
    print()

    for table in tables:
        print(f"  ✓ {table}")

    print()
    print("Database initialization completed successfully.")
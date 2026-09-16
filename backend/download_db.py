from __future__ import annotations

import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


DATABASE_URL = "https://huggingface.co/datasets/amashtce/aeroindex-db/resolve/main/apix.db"
BACKEND_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BACKEND_DIR / "data" / "apix.db"


def download_database() -> Path:
    refresh = os.getenv("APIX_DB_REFRESH", "false").lower() == "true"
    if DATABASE_PATH.exists() and not refresh:
        print(f"SQLite database already exists: {DATABASE_PATH}")
        return DATABASE_PATH

    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = DATABASE_PATH.with_suffix(".db.download")
    try:
        print(f"Downloading SQLite database from {DATABASE_URL}")
        with urlopen(DATABASE_URL, timeout=300) as response, temporary_path.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
        if temporary_path.stat().st_size == 0:
            raise RuntimeError("Downloaded database file is empty")
        temporary_path.replace(DATABASE_PATH)
        print(f"SQLite database ready: {DATABASE_PATH}")
        return DATABASE_PATH
    except (HTTPError, URLError, OSError, RuntimeError) as error:
        temporary_path.unlink(missing_ok=True)
        raise RuntimeError(f"Failed to download SQLite database: {error}") from error


if __name__ == "__main__":
    download_database()
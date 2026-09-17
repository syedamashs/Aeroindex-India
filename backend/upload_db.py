from __future__ import annotations

import os
from pathlib import Path

from huggingface_hub import HfApi
from database.connection import DATABASE_PATH


DATASET_REPOSITORY = "amashtce/aeroindex-db"


def load_local_env() -> None:
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.is_file():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def upload_database() -> str:
    load_local_env()
    token = os.getenv("HF_TOKEN")
    if not token:
        raise RuntimeError("HF_TOKEN is required to upload the updated database")
    if not DATABASE_PATH.is_file():
        raise FileNotFoundError(f"SQLite database not found: {DATABASE_PATH}")

    api = HfApi(token=token)
    return api.upload_file(
        path_or_fileobj=str(DATABASE_PATH),
        path_in_repo="apix.db",
        repo_id=DATASET_REPOSITORY,
        repo_type="dataset",
        commit_message="Update airfare database",
    )
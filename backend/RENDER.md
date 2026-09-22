# Render Backend Deployment

The Render service should use `backend` as its root directory.

Use Node.js 22.5.0 or newer. The API uses Node's built-in `node:sqlite` module.

Render Free has no persistent disk, so the database is downloaded from the
Hugging Face dataset during every build. The scheduler uploads a successful
updated database back to the same dataset.

## Commands

Build command:

```text
mkdir -p data && python download_db.py && pip install -r requirements.txt && python -m playwright install --with-deps chromium && npm install
```

Start command:

```text
npm run start
```

Both `npm run start` and `npm run dev` automatically fetch and update `data/apix.db`
from Hugging Face before starting the API. This ensures both local and deployed environments
always run with the latest dataset. If offline, the app falls back to the existing local database.

The backend listens on Render's `PORT` and binds to `0.0.0.0`. Locally it falls back to port `4002`.

## Environment variables

Set these in Render when needed:

```text
APIX_HEADLESS=true
APIX_BROWSER_TIMEOUT_MS=120000
APIX_DB_PATH=./data/apix.db
HF_TOKEN=
```

`APIX_BROWSER_CHANNEL` should normally be unset. When it is unset, the scrapers use the Chromium browser installed by the build command. `APIX_DB_PATH` may remain unset for local development, where it defaults to `backend/data/apix.db`.

`HF_TOKEN` must be a Hugging Face token with permission to write to the
`amashtce/aeroindex-db` dataset. Configure it in Render's secret environment
variables; never commit it to GitHub.

Set `APIX_DB_REFRESH=true` only when a build must explicitly replace an
existing local database download.

## SQLite requirement

`backend/data/apix.db` is approximately 254 MB locally and is ignored by Git.
`download_db.py` downloads it from:

`https://huggingface.co/datasets/amashtce/aeroindex-db/resolve/main/apix.db`

The download uses a temporary file and replaces the local database only after
the download completes. If the download fails, the build fails and the server
does not start with a missing database.

The Render filesystem is ephemeral. A successful scheduler run calls
`upload_db.upload_database()`, which uploads `data/apix.db` to the dataset as
`apix.db` with the commit message `Update airfare database`. If scraping fails,
the upload is skipped. If the upload fails, the local SQLite file is retained
and a clear error is logged.

## Local verification

Create `backend/.env` from `backend/.env.example` and set `HF_TOKEN` to a
write-enabled Hugging Face token. This file is ignored by Git and must never be
committed.

From the repository root:

```powershell
python -m pip install -r backend/requirements.txt
Push-Location backend
python download_db.py
npm install
npm run start
Pop-Location
```

In a second terminal, check `http://localhost:4002/api/health`.

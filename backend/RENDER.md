# Render Backend Deployment

The Render service should use `backend` as its root directory.

Use Node.js 22.5.0 or newer. The API uses Node's built-in `node:sqlite` module.

## Commands

Build command:

```text
pip install -r requirements.txt && python -m playwright install --with-deps chromium && npm install
```

Start command:

```text
npm run start
```

The backend listens on Render's `PORT` and binds to `0.0.0.0`. Locally it falls back to port `4002`.

## Environment variables

Set these in Render when needed:

```text
APIX_HEADLESS=true
APIX_BROWSER_TIMEOUT_MS=120000
APIX_DB_PATH=/var/data/apix.db
```

`APIX_BROWSER_CHANNEL` should normally be unset. When it is unset, the scrapers use the Chromium browser installed by the build command. `APIX_DB_PATH` may remain unset for local development, where it defaults to `backend/data/apix.db`.

No secrets are required by the current backend configuration. Do not put credentials or API keys in `.env.example` or in the repository.

## SQLite requirement

`backend/data/apix.db` is approximately 254 MB locally and is ignored by Git. It must not be assumed to be present in a fresh Render checkout. The database contains the application's runtime observations and must be supplied separately before the service starts.

For a persistent SQLite deployment:

1. Attach a Render persistent disk mounted at `/var/data`.
2. Copy the approved `apix.db` file to `/var/data/apix.db`.
3. Set `APIX_DB_PATH=/var/data/apix.db`.
4. Confirm `/api/health` and the dashboard endpoints after deployment.

Without a persistent disk, scheduler writes and generated raw files can be lost when the service restarts or is redeployed. Review the database contents for sensitive data before transferring it to Render. The database is intentionally not added to GitHub.

## Local verification

From the repository root:

```powershell
python -m pip install -r backend/requirements.txt
Push-Location backend
npm install
npm run start
Pop-Location
```

In a second terminal, check `http://localhost:4002/api/health`.

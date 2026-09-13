# APIx Production Scrapers

These collectors are **task-driven**. They do not contain a production route,
departure date, lead-time bucket, DGCA route, or user-specific Windows path.

## Flow

`DGCA route master -> scheduler -> task -> airline collector -> raw JSON -> source extraction -> result -> canonical normalizer/storage`

## Task contract

Every task must provide:

- `run_id`
- `task_id`
- `route_id`
- `origin` — IATA airport code
- `destination` — IATA airport code
- `departure_date` — ISO `YYYY-MM-DD`
- `target_lead_days`

The scheduler may also provide:

- `origin_query` / `destination_query` — display values used by the airline UI
- `profile_dir`
- `output_dir`
- `source_url`
- `headless`
- `timeout_ms`

The collectors never calculate a production route list and never choose a
production departure date.

## Dispatcher

```python
from dispatcher import run_task

result = run_task(source, task)
```

Here `source` and `task` come from the scheduler/database. Do not replace them
with route/date constants inside an airline scraper.

## Storage

Raw responses are written under:

`<output_dir>/raw/<source>/`

The returned result contains the raw file path and extracted source records.
The canonical normalizer should convert those records to the frozen 45-field
APIx observation schema.

## Important

Selectors and source endpoints are source-specific technical dependencies;
they are not route/date data. They should be changed only when the airline
website changes.

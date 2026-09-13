"""Task dispatcher for APIx airline collectors.

The scheduler supplies all route/date/runtime values. Collectors contain only
source-specific browser/API mechanics.
"""

from importlib import import_module

COLLECTOR_MODULES = {
    "airindia": "airindia_scraper",
    "indigo": "indigo_scraper",
    "spicejet": "spicejet_scraper",
}

REQUIRED_TASK_FIELDS = (
    "run_id",
    "task_id",
    "route_id",
    "origin",
    "destination",
    "departure_date",
    "target_lead_days",
)


def validate_task(task):
    if not isinstance(task, dict):
        raise TypeError("task must be a dictionary")
    missing = [
        key for key in REQUIRED_TASK_FIELDS
        if key not in task or task[key] in (None, "")
    ]
    if missing:
        raise ValueError(f"Missing task fields: {missing}")


def run_task(source, task):
    validate_task(task)
    source_key = str(source).strip().lower()
    module_name = COLLECTOR_MODULES.get(source_key)
    if not module_name:
        raise ValueError(f"Unsupported source: {source}")
    module = import_module(
        f".{module_name}",
        package=__package__,
    )
    return module.run(task)

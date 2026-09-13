from datetime import date, timedelta
from pathlib import Path
import csv
import uuid


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ROUTES_FILE = PROJECT_ROOT / "config" / "routes.csv"
AIRPORT_MASTER_FILE = PROJECT_ROOT / "config" / "airport_city_master.csv"


# ============================================================
# DEFAULT COLLECTION CONFIGURATION
# ============================================================

AIRLINES = (
    "airindia",
    "indigo",
    "spicejet",
)

LEAD_TIME_DAYS = (
    1,
    7,
    15,
    30,
    45,
)


# ============================================================
# ROUTE LOADER
# ============================================================

def load_routes(routes_file=ROUTES_FILE):
    """
    Load the DGCA route basket from routes.csv.

    Expected columns:

        route_id
        rank
        city1
        city2
        route_traffic
        route_weight_pct
        cumulative_coverage_pct

    The route CSV remains the authoritative DGCA basket.
    """

    routes_file = Path(routes_file)

    if not routes_file.exists():
        raise FileNotFoundError(
            f"Routes file not found: {routes_file}"
        )

    routes = []

    with routes_file.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as file:

        reader = csv.DictReader(file)

        if reader.fieldnames is None:
            raise ValueError(
                "routes.csv does not contain a header."
            )

        required_columns = {
            "route_id",
            "city1",
            "city2",
        }

        missing = required_columns - set(reader.fieldnames)

        if missing:
            raise ValueError(
                f"routes.csv is missing columns: {sorted(missing)}"
            )

        for row in reader:

            route_id = str(
                row["route_id"]
            ).strip()

            city1 = str(
                row["city1"]
            ).strip()

            city2 = str(
                row["city2"]
            ).strip()

            if not route_id:
                raise ValueError(
                    "Found route with empty route_id."
                )

            if not city1 or not city2:
                raise ValueError(
                    f"Route {route_id} has empty city1/city2."
                )

            routes.append(row)

    if not routes:
        raise ValueError(
            "routes.csv contains no routes."
        )

    return routes


def load_airport_master(airport_master_file=AIRPORT_MASTER_FILE):
    """Load the city-to-airport mapping used to create scraper tasks."""
    airport_master_file = Path(airport_master_file)
    if not airport_master_file.exists():
        raise FileNotFoundError(
            f"Airport master file not found: {airport_master_file}"
        )

    airports = {}
    with airport_master_file.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        reader = csv.DictReader(file)
        required_columns = {
            "airport_code",
            "city_name",
        }
        missing = required_columns - set(reader.fieldnames or ())
        if missing:
            raise ValueError(
                f"airport_city_master.csv is missing columns: {sorted(missing)}"
            )

        for row in reader:
            city_name = row["city_name"].strip()
            airport_code = row["airport_code"].strip().upper()
            if not city_name or not airport_code:
                continue

            city_key = city_name.casefold()
            if city_key in airports:
                raise ValueError(
                    f"Multiple airports mapped to exact city '{city_name}'."
                )
            airports[city_key] = row

    if not airports:
        raise ValueError("airport_city_master.csv contains no airport mappings.")
    return airports


# ============================================================
# TASK ID
# ============================================================

def make_task_id():
    """
    Generate a unique collection task ID.
    """

    return f"task_{uuid.uuid4().hex[:12]}"


# ============================================================
# RUN ID
# ============================================================

def make_run_id():
    """
    Generate a unique collection run ID.
    """

    timestamp = (
        date.today()
        .strftime("%Y%m%d")
    )

    return f"run_{timestamp}_{uuid.uuid4().hex[:8]}"


# ============================================================
# TASK BUILDER
# ============================================================

def build_tasks(
    routes,
    airlines=AIRLINES,
    lead_times=LEAD_TIME_DAYS,
    collection_date=None,
    airport_master=None,
):
    """
    Build airline collection tasks.

    For every route:

        route
          × airline
          × lead-time window

    Example:

        DELHI_MUMBAI
        × airindia
        × T+7

    becomes one collection task.
    """

    if collection_date is None:
        collection_date = date.today()

    if isinstance(collection_date, str):
        collection_date = date.fromisoformat(
            collection_date
        )

    run_id = make_run_id()
    airport_master = airport_master or load_airport_master()

    tasks = []

    for route in routes:

        route_id = str(
            route["route_id"]
        ).strip()

        city1 = str(
            route["city1"]
        ).strip()

        city2 = str(
            route["city2"]
        ).strip()

        origin_airport = airport_master.get(city1.casefold())
        destination_airport = airport_master.get(city2.casefold())
        if not origin_airport or not destination_airport:
            missing_city = city1 if not origin_airport else city2
            raise ValueError(
                f"No exact airport mapping found for route {route_id}: {missing_city}"
            )

        origin_code = origin_airport["airport_code"].strip().upper()
        destination_code = destination_airport["airport_code"].strip().upper()

        for airline in airlines:

            airline = str(
                airline
            ).strip().lower()

            for lead_days in lead_times:

                lead_days = int(
                    lead_days
                )

                departure_date = (
                    collection_date
                    + timedelta(
                        days=lead_days
                    )
                )

                task = {
                    "run_id": run_id,

                    "task_id": make_task_id(),

                    "route_id": route_id,

                    "source": airline,

                    "origin": origin_code,

                    "destination": destination_code,

                    "origin_query": city1,

                    "destination_query": city2,

                    "departure_date":
                        departure_date.isoformat(),

                    "target_lead_days":
                        lead_days,

                    "collection_date":
                        collection_date.isoformat(),
                }

                tasks.append(task)

    return tasks


# ============================================================
# SIMPLE TEST / DEMO
# ============================================================

if __name__ == "__main__":

    routes = load_routes()

    print(
        f"Loaded routes: {len(routes)}"
    )

    tasks = build_tasks(
        routes=routes,
    )

    print(
        f"Generated tasks: {len(tasks)}"
    )

    print("\nFirst 10 tasks:\n")

    for task in tasks[:10]:
        print(task)
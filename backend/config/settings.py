from pathlib import Path
import os


# ============================================================
# PROJECT PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[1]

CONFIG_DIR = PROJECT_ROOT / "config"
DATA_DIR = PROJECT_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
NORMALIZED_DATA_DIR = DATA_DIR / "normalized"
LOG_DIR = PROJECT_ROOT / "logs"

ROUTES_FILE = CONFIG_DIR / "routes.csv"


# ============================================================
# AIRLINES
# ============================================================

AIRLINES = (
    "airindia",
    "indigo",
    "spicejet",
)


# ============================================================
# LEAD-TIME WINDOWS
# ============================================================
#
# T+1, T+7, T+15, T+30, T+45
#
# The actual lead time of an observation will still be
# calculated from the search date and departure date.
# These are the target collection horizons.

LEAD_TIME_DAYS = (
    1,
    7,
    15,
    30,
    45,
)


# ============================================================
# COLLECTION SETTINGS
# ============================================================

DEFAULT_CURRENCY = "INR"

BROWSER_HEADLESS = os.getenv(
    "APIX_HEADLESS",
    "true" if os.name != "nt" else "false",
).lower() == "true"

BROWSER_TIMEOUT_MS = int(
    os.getenv(
        "APIX_BROWSER_TIMEOUT_MS",
        "60000",
    )
)


# ============================================================
# STORAGE SETTINGS
# ============================================================

SAVE_RAW_RESPONSES = True
SAVE_NORMALIZED_DATA = True


# ============================================================
# HELPER
# ============================================================

def ensure_directories():
    """
    Create required APIx directories if they do not exist.
    """
    directories = (
        DATA_DIR,
        RAW_DATA_DIR,
        NORMALIZED_DATA_DIR,
        LOG_DIR,
    )

    for directory in directories:
        directory.mkdir(
            parents=True,
            exist_ok=True,
        )
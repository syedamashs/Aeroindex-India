"""Production IndiGo collector for APIx.

This module is task-driven: route, departure date, lead-time bucket, output
location and browser profile are supplied by the scheduler/task contract.
No route or departure date is embedded in the collector.
"""

import csv
import json
import os
from datetime import date, datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

# ============================================================
# FUNCTION: SELECT AIRPORT
# ============================================================

def select_airport(page, field_name, city_name):

    print(f"\nSelecting {field_name}: {city_name}")

    field = page.locator(
        ".booking-widget-field"
    ).filter(
        has=page.locator(
            ".label_top",
            has_text=field_name
        )
    ).filter(
        has=page.locator(
            'input[placeholder="Start typing.."]'
        )
    ).first

    if field.count() == 0:
        raise Exception(f"{field_name} field not found")

    field.click(force=True)
    page.wait_for_timeout(500)

    input_box = field.locator(
        'input[placeholder="Start typing.."]'
    )

    input_box.fill(city_name)

    page.wait_for_timeout(1500)

    city = page.locator(
        "div.skyplus-text.body-medium-regular"
    ).filter(
        has_text=city_name
    ).first

    if city.count() == 0:
        raise Exception(
            f"Autocomplete city not found: {city_name}"
        )

    clickable = city.locator("..").locator("..")

    clickable.click(force=True)

    page.wait_for_timeout(500)

    print(
        field_name,
        "selected:",
        input_box.input_value()
    )

    print(
        field_name,
        "ARIA:",
        field.get_attribute("aria-label")
    )


# ============================================================
# FUNCTION: SELECT DEPARTURE DATE
# ============================================================

def advance_calendar_to_date(page, departure_date):
    date_cell = page.locator(
        f'[role="gridcell"][data-date="{departure_date}"]'
    ).filter(
        has=page.locator("span.date")
    ).first

    target = date.fromisoformat(str(departure_date))
    today = date.today()
    month_distance = (target.year - today.year) * 12 + target.month - today.month
    clicks_needed = max(0, month_distance - 1)
    if clicks_needed == 0:
        return date_cell

    for _ in range(clicks_needed):
        next_buttons = page.locator(
            'button[aria-label*="next month" i], '
            'button[aria-label*="next" i][aria-label*="calendar" i], '
            'button[title*="next" i], '
            'button[data-testid*="next" i], '
            '[data-testid*="next" i][data-testid*="month" i], '
            'button:has-text(">"), '
            'button:has-text("›")'
        )
        clicked = False
        for index in range(next_buttons.count()):
            button = next_buttons.nth(index)
            if button.is_visible() and button.is_enabled():
                button.click(force=True)
                page.wait_for_timeout(300)
                clicked = True
                break
        if not clicked:
            break

    return date_cell

def select_departure_date(page, departure_date):

    print("\n========== SELECTING DEPARTURE DATE ==========")

    departure_field = page.locator(
        ".booking-widget-field"
    ).filter(
        has=page.locator(
            ".label_top",
            has_text="Departure"
        )
    ).filter(
        has=page.locator(
            'input[placeholder="Start typing.."]'
        )
    ).first

    if departure_field.count() == 0:
        raise Exception(
            "Departure field not found"
        )

    print(
        "Current:",
        departure_field.get_attribute("aria-label")
    )

    current_label = (departure_field.get_attribute("aria-label") or "").casefold()
    try:
        target_date = datetime.strptime(departure_date, "%Y-%m-%d")
        target_label = f"{target_date.day} {target_date.strftime('%B %Y')}".casefold()
    except ValueError:
        target_label = ""
    if target_label and target_label in current_label:
        print("Departure date already selected:", departure_date)
        return

    departure_field.click(force=True)

    page.wait_for_timeout(1000)

    date_cell = advance_calendar_to_date(page, departure_date)

    print(
        "Target date:",
        departure_date
    )

    print(
        "Matching date cells:",
        date_cell.count()
    )

    if date_cell.count() == 0:
        raise Exception(
            f"Date not found: {departure_date}"
        )

    date_cell.click(force=True)

    page.wait_for_timeout(1000)

    print(
        "Selected:",
        departure_field.get_attribute("aria-label")
    )


# ============================================================
# HELPER: SAFE NUMBER
# ============================================================

def safe_number(value):

    try:
        if value is None:
            return None

        return float(value)

    except:
        return None


# ============================================================
# FUNCTION: EXTRACT INDIGO FARES
# ============================================================

def extract_indigo_fares(
    response_data,
    origin,
    destination,
    departure_date,
    collection_timestamp
):

    rows = []

    data = response_data.get("data", {})

    trips = data.get("trips", [])

    print("\n========== EXTRACTING FARES ==========")

    print(
        "Trips received:",
        len(trips)
    )

    for trip_index, trip in enumerate(trips):

        trip_origin = trip.get("origin")
        trip_destination = trip.get("destination")

        # ----------------------------------------------------
        # IMPORTANT:
        # IndiGo response can contain other routes.
        # Keep only requested route.
        # ----------------------------------------------------

        requested_origin = (
            origin.upper()
            if len(origin) == 3
            else None
        )

        requested_destination = (
            destination.upper()
            if len(destination) == 3
            else None
        )

        requested_origin = str(origin).upper()
        requested_destination = str(destination).upper()
        if trip_origin != requested_origin or trip_destination != requested_destination:
            continue

        journeys = trip.get(
            "journeysAvailable",
            []
        )

        print(
            f"Trip {trip_index + 1}: "
            f"{trip_origin} -> {trip_destination}"
        )

        print(
            "Journeys:",
            len(journeys)
        )

        # ====================================================
        # JOURNEYS
        # ====================================================

        for journey_index, journey in enumerate(journeys):

            designator = journey.get(
                "designator",
                {}
            )

            # ------------------------------------------------
            # FLIGHT NUMBER
            # ------------------------------------------------

            flight_number = designator.get(
                "flightNumber"
            )

            if not flight_number:

                segments = journey.get(
                    "segments",
                    []
                )

                if segments:

                    identifier = segments[0].get(
                        "identifier",
                        {}
                    )

                    carrier_code = identifier.get(
                        "carrierCode"
                    )

                    identifier_number = identifier.get(
                        "identifier"
                    )

                    if carrier_code and identifier_number:

                        flight_number = (
                            f"{carrier_code} "
                            f"{identifier_number}"
                        )

            # ------------------------------------------------
            # STOPS
            # ------------------------------------------------

            stops = journey.get(
                "stops"
            )

            # ------------------------------------------------
            # FLIGHT TYPE
            # ------------------------------------------------

            flight_type = journey.get(
                "flightType"
            )

            # ------------------------------------------------
            # SOLD / FILLING FAST
            # ------------------------------------------------

            is_sold = journey.get(
                "isSold"
            )

            filling_fast = journey.get(
                "fillingFast"
            )

            # ------------------------------------------------
            # JOURNEY KEY
            # ------------------------------------------------

            journey_key = journey.get(
                "journeyKey"
            )

            # =================================================
            # SEGMENT INFORMATION
            # =================================================

            segments = journey.get(
                "segments",
                []
            )

            departure_time = None
            arrival_time = None
            duration = None
            aircraft = None
            departure_terminal = None
            arrival_terminal = None

            if segments:

                segment = segments[0]

                # ---------------------------------------------
                # DESIGNATOR
                # ---------------------------------------------

                segment_designator = segment.get(
                    "designator",
                    {}
                )

                departure_time = (
                    segment_designator.get(
                        "departure"
                    )
                    or segment.get(
                        "departure"
                    )
                )

                arrival_time = (
                    segment_designator.get(
                        "arrival"
                    )
                    or segment.get(
                        "arrival"
                    )
                )

                duration = segment.get(
                    "duration"
                )

                # ---------------------------------------------
                # IDENTIFIER
                # ---------------------------------------------

                identifier = segment.get(
                    "identifier",
                    {}
                )

                if not flight_number:

                    carrier_code = identifier.get(
                        "carrierCode"
                    )

                    identifier_number = identifier.get(
                        "identifier"
                    )

                    if carrier_code and identifier_number:

                        flight_number = (
                            f"{carrier_code} "
                            f"{identifier_number}"
                        )

                # ---------------------------------------------
                # LEG INFO
                # ---------------------------------------------

                leg_info = segment.get(
                    "legInfo",
                    {}
                )

                aircraft = (
                    leg_info.get(
                        "equipmentType"
                    )
                    or segment.get(
                        "equipmentType"
                    )
                )

                departure_terminal = (
                    leg_info.get(
                        "departureTerminal"
                    )
                )

                arrival_terminal = (
                    leg_info.get(
                        "arrivalTerminal"
                    )
                )

            # =================================================
            # PASSENGER FARES
            # =================================================

            passenger_fares = journey.get(
                "passengerFares",
                []
            )

            print(
                f"\nJourney {journey_index + 1}:",
                flight_number,
                "| Fare options:",
                len(passenger_fares)
            )

            # =================================================
            # EACH FARE FAMILY / PRODUCT CLASS
            # =================================================

            for fare in passenger_fares:

                if not fare.get(
                    "isActive",
                    True
                ):
                    continue

                product_class = fare.get(
                    "productClass"
                )

                fare_availability_key = fare.get(
                    "fareAvailabilityKey"
                )

                fare_class = fare.get(
                    "FareClass"
                )

                total_fare = safe_number(
                    fare.get(
                        "totalFareAmount"
                    )
                )

                total_publish_fare = safe_number(
                    fare.get(
                        "totalPublishFare"
                    )
                )

                total_tax = safe_number(
                    fare.get(
                        "totalTax"
                    )
                )

                # =================================================
                # ADULT PASSENGER FARE
                # =================================================

                pax_fares = fare.get(
                    "paxFares",
                    []
                )

                adult_fare = None

                for pax in pax_fares:

                    pax_type = str(
                        pax.get("paxType", "")
                    ).upper()

                    if pax_type in (
                        "ADT",
                        "ADULT",
                        "1"
                    ):

                        adult_fare = pax
                        break

                # Sometimes ADT is the first item
                if adult_fare is None and pax_fares:

                    adult_fare = pax_fares[0]

                base_fare = None

                if adult_fare:

                    base_fare = safe_number(
                        adult_fare.get(
                            "fareAmount"
                        )
                    )

                    # -----------------------------------------
                    # SERVICE CHARGES
                    # -----------------------------------------

                    service_charges = adult_fare.get(
                        "serviceCharges",
                        []
                    )

                    service_tax = 0
                    service_base = None

                    for charge in service_charges:

                        amount = safe_number(
                            charge.get("amount")
                        )

                        if amount is None:
                            continue

                        detail = str(
                            charge.get("detail") or ""
                        )

                        charge_type = charge.get(
                            "type"
                        )

                        # Tax
                        if (
                            "Tax" in detail
                            or charge_type == 5
                        ):

                            service_tax += amount

                        # Base fare
                        elif (
                            charge.get("code") is None
                            and charge_type == 0
                        ):

                            if service_base is None:
                                service_base = amount

                    if service_base is not None:
                        base_fare = service_base

                    if total_tax is None and service_tax:
                        total_tax = service_tax

                # =================================================
                # AVAILABILITY
                # =================================================

                availability = fare.get(
                    "availableCount"
                )

                if availability is None:

                    availability = fare.get(
                        "availability"
                    )

                # =================================================
                # CREATE NORMALIZED ROW
                # =================================================

                row = {

                    "collection_timestamp":
                        collection_timestamp,

                    "airline":
                        "IndiGo",

                    "origin":
                        trip_origin,

                    "destination":
                        trip_destination,

                    "departure_date":
                        departure_date,

                    "flight_number":
                        flight_number,

                    "departure_time":
                        departure_time,

                    "arrival_time":
                        arrival_time,

                    "duration":
                        duration,

                    "stops":
                        stops,

                    "flight_type":
                        flight_type,

                    "aircraft":
                        aircraft,

                    "departure_terminal":
                        departure_terminal,

                    "arrival_terminal":
                        arrival_terminal,

                    "fare_class":
                        fare_class,

                    "product_class":
                        product_class,

                    "fare_availability_key":
                        fare_availability_key,

                    "availability":
                        availability,

                    "base_fare":
                        base_fare,

                    "tax":
                        total_tax,

                    "total_publish_fare":
                        total_publish_fare,

                    "total_fare":
                        total_fare,

                    "is_sold":
                        is_sold,

                    "filling_fast":
                        filling_fast,

                    "journey_key":
                        journey_key
                }

                rows.append(row)

    print(
        "\nTotal normalized fare rows:",
        len(rows)
    )

    return rows


# ============================================================
# FUNCTION: SAVE CSV
# ============================================================

def save_csv(rows, output_file):

    if not rows:
        print(
            "\nNo fare rows to save."
        )
        return

    fieldnames = list(
        rows[0].keys()
    )

    with open(
        output_file,
        "w",
        newline="",
        encoding="utf-8-sig"
    ) as f:

        writer = csv.DictWriter(
            f,
            fieldnames=fieldnames
        )

        writer.writeheader()

        writer.writerows(rows)

    print(
        "\nCSV saved:"
    )

    print(
        output_file
    )


# ============================================================
# PRODUCTION ENTRY POINT
# ============================================================

def run(task):
    """Collect one IndiGo task and return a structured result."""
    required = (
        "run_id", "task_id", "route_id", "origin", "destination",
        "departure_date", "target_lead_days",
    )
    missing = [key for key in required if key not in task or task[key] in (None, "")]
    if missing:
        raise ValueError(f"Missing task fields: {missing}")

    run_id = str(task["run_id"])
    task_id = str(task["task_id"])
    route_id = str(task["route_id"])
    origin = str(task["origin"]).upper()
    destination = str(task["destination"]).upper()
    departure_date = str(task["departure_date"])
    target_lead_days = int(task["target_lead_days"])
    default_headless = "true" if os.name != "nt" else "false"
    headless = str(task.get("headless", os.getenv("APIX_HEADLESS", default_headless))).lower() == "true"

    origin_query = str(task.get("origin_query") or origin)
    destination_query = str(task.get("destination_query") or destination)
    default_profile_dir = (
        Path(__file__).resolve().parents[1] / "data" / "indigo_profile_test"
        if os.name == "nt" and not headless
        else Path.home() / ".apix" / "profiles" / "indigo"
    )
    profile_dir = Path(task.get("profile_dir") or default_profile_dir)
    output_dir = Path(task.get("output_dir") or (Path(__file__).resolve().parents[1] / "data"))
    raw_dir = output_dir / "raw" / "indigo"
    raw_dir.mkdir(parents=True, exist_ok=True)
    profile_dir.parent.mkdir(parents=True, exist_ok=True)

    source_url = str(task.get("source_url") or os.getenv("APIX_INDIGO_URL", "https://www.goindigo.in/"))
    timeout_ms = int(task.get("timeout_ms") or os.getenv("APIX_BROWSER_TIMEOUT_MS", "120000"))
    collection_timestamp = datetime.now().isoformat(timespec="seconds")

    result = {
        "run_id": run_id, "task_id": task_id, "route_id": route_id,
        "source": "IndiGo", "origin": origin, "destination": destination,
        "departure_date": departure_date, "target_lead_days": target_lead_days,
        "collection_timestamp": collection_timestamp, "status": "FAILED",
        "raw_file": None, "records": [], "error": None,
    }

    try:
        with sync_playwright() as p:
            browserless_token = os.getenv("BROWSERLESS_TOKEN")
            if browserless_token:
                print("[indigo] Using Browserless cloud browser")
                _browser = p.chromium.connect_over_cdp(
                    f"wss://chrome.browserless.io?token={browserless_token}&timeout=120000"
                )
                context = _browser.new_context(
                    viewport={"width": 1400, "height": 900},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                )
            else:
                browser_options = {
                    "user_data_dir": str(profile_dir),
                    "headless": headless,
                    "viewport": {"width": 1400, "height": 900},
                    "args": [
                        "--disable-blink-features=AutomationControlled",
                        "--disable-features=IsolateOrigins,site-per-process",
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                        "--no-first-run",
                    ],
                }
                browser_channel = os.getenv("APIX_BROWSER_CHANNEL")
                if browser_channel:
                    browser_options["channel"] = browser_channel
                elif os.name == "nt" and not headless:
                    browser_options["channel"] = "chrome"
                context = p.chromium.launch_persistent_context(**browser_options)
            try:
                page = context.pages[0] if context.pages else context.new_page()
                page.goto(source_url, wait_until="domcontentloaded", timeout=timeout_ms)
                page.wait_for_timeout(10000)

                select_airport(page, "From", origin_query)
                select_airport(page, "To", destination_query)
                select_departure_date(page, departure_date)

                search_button = page.get_by_role("button", name="Search").first
                if search_button.count() == 0:
                    raise RuntimeError("IndiGo Search button not found")

                with page.expect_response(
                    lambda response: "/v2/flight/search" in response.url and response.status == 200,
                    timeout=timeout_ms,
                ) as response_info:
                    search_button.click()

                response = response_info.value
                response_data = response.json()
                raw_file = raw_dir / f"{datetime.now():%Y%m%d_%H%M%S_%f}_{route_id}_{departure_date}_{task_id}.json"
                raw_file.write_text(json.dumps(response_data, indent=2, ensure_ascii=False), encoding="utf-8")

                collection_timestamp = datetime.now().isoformat(timespec="seconds")
                records = extract_indigo_fares(
                    response_data, origin, destination, departure_date, collection_timestamp
                )
                for record in records:
                    record.update({
                        "run_id": run_id, "task_id": task_id, "route_id": route_id,
                        "target_lead_days": target_lead_days, "raw_file": str(raw_file),
                    })

                result.update({
                    "status": "SUCCESS", "raw_file": str(raw_file),
                    "records": records, "collection_timestamp": collection_timestamp,
                })
                return result
            finally:
                context.close()
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
        return result


if __name__ == "__main__":
    raise SystemExit("IndiGo scraper is task-driven. Use run(task) from the scheduler.")

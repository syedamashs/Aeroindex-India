"""Production SpiceJet collector for APIx.

Route/date values are supplied by the scheduler task.
"""

import json
import os
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

def extract_availability_records(response_data, requested_origin, requested_destination, collection_timestamp):
    """
    Extract flight-level fare observations from SpiceJet's availability JSON.

    Relationship:
        journeysAvailable[].fares
            -> fareAvailabilityKey
            -> data.faresAvailable[key]
            -> passengerFares[ADT]
            -> serviceCharges
    """
    data = response_data.get("data", {})
    trips = data.get("trips", [])
    fares_available = data.get("faresAvailable", {})
    currency = data.get("currencyCode", "INR")

    records = []
    for trip in trips:
        origin = trip.get("origin")
        destination = trip.get("destination")

        if str(origin).upper() != str(requested_origin).upper() or str(destination).upper() != str(requested_destination).upper():
            continue

        for journey in trip.get("journeysAvailable", []):
            designator = journey.get("designator", {})
            stops = journey.get("stops")

            flight_number = ""
            carrier = "SG"

            segments = journey.get("segments", [])
            if segments:
                identifier = segments[0].get("identifier", {})
                flight_number = identifier.get("identifier", "")
                carrier = identifier.get("carrierCode") or "SG"

            flight_id = f"{carrier} {flight_number}".strip()

            # Extra flight information from the first segment/leg.
            segment = segments[0] if segments else {}
            legs = segment.get("legs", [])
            leg = legs[0] if legs else {}
            leg_info = leg.get("legInfo", {})

            # Every fare shown for this journey points to a key in
            # data.faresAvailable.
            for journey_fare in (journey.get("fares") or {}).values():
                fare_key = journey_fare.get("fareAvailabilityKey")
                if not fare_key:
                    continue

                fare = fares_available.get(fare_key)
                if not fare:
                    print(f"Fare definition not found: {fare_key}")
                    continue

                fare_code = fare.get("fareCode", "")
                class_of_service = fare.get("classOfService", "")
                product_class = fare.get("productClass", "")

                passenger_fare = None
                for pf in fare.get("passengerFares", []):
                    if pf.get("passengerType") == "ADT":
                        passenger_fare = pf
                        break

                if not passenger_fare:
                    continue

                base_fare = passenger_fare.get("revenueFare")
                published_fare = passenger_fare.get("publishedFare")
                total_fare = passenger_fare.get("fareAmount")

                # SpiceJet provides a TaxSum service charge (type 5).
                # The remaining named service charges are retained as
                # fees/other charges for the normalized dataset.
                taxes = 0
                fees = 0

                for charge in passenger_fare.get("serviceCharges", []):
                    amount = charge.get("amount") or 0
                    detail = charge.get("detail")
                    charge_type = charge.get("type")

                    if detail == "TaxSum" or charge_type == 5:
                        taxes += amount
                    else:
                        # The first service charge is the base/revenue fare.
                        # Do not count it again as a fee.
                        if amount != base_fare or charge.get("code") is not None:
                            fees += amount

                # Prefer the published/revenue fare as the base fare.
                # If unavailable, fall back to the first service-charge amount.
                if base_fare is None:
                    base_fare = published_fare

                if total_fare is None:
                    total_fare = (base_fare or 0) + taxes + fees

                records.append({
                    "search_timestamp": collection_timestamp,
                    "departure_date": designator.get("departure", "")[:10],
                    "origin": origin,
                    "destination": destination,
                    "carrier": carrier,
                    "flight_id": flight_id,
                    "departure_time": designator.get("departure", ""),
                    "arrival_time": designator.get("arrival", ""),
                    "flight_duration": journey.get("flightDuration", ""),
                    "stops": stops,
                    "fare_name": fare_code,       # Network response gives fareCode.
                    "fare_code": fare_code,
                    "fare_class": class_of_service,
                    "product_class": product_class,
                    "available_count": journey_fare.get("availableCount"),
                    "capacity": leg_info.get("capacity"),
                    "sold": leg_info.get("sold"),
                    "aircraft": leg_info.get("equipmentType"),
                    "departure_terminal": leg_info.get("departureTerminal"),
                    "arrival_terminal": leg_info.get("arrivalTerminal"),
                    "base_fare": base_fare,
                    "taxes": taxes,
                    "fees": fees,
                    "total_fare": total_fare,
                    "currency": currency,
                    "source": "SpiceJet-availability",
                })

    return records


# ============================================================
# PRODUCTION ENTRY POINT
# ============================================================

def run(task):
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
    output_dir = Path(task.get("output_dir") or (Path(__file__).resolve().parents[1] / "data"))
    raw_dir = output_dir / "raw" / "spicejet"
    raw_dir.mkdir(parents=True, exist_ok=True)
    profile_dir = Path(task.get("profile_dir") or (Path.home() / ".apix" / "profiles" / "spicejet"))
    profile_dir.parent.mkdir(parents=True, exist_ok=True)

    source_url = str(task.get("source_url") or os.getenv("APIX_SPICEJET_URL", "https://www.spicejet.com/"))
    headless = str(task.get("headless", os.getenv("APIX_HEADLESS", "false"))).lower() == "true"
    timeout_ms = int(task.get("timeout_ms") or os.getenv("APIX_BROWSER_TIMEOUT_MS", "120000"))
    collection_timestamp = datetime.now().isoformat(timespec="seconds")
    result = {
        "run_id": run_id, "task_id": task_id, "route_id": route_id,
        "source": "SpiceJet", "origin": origin, "destination": destination,
        "departure_date": departure_date, "target_lead_days": target_lead_days,
        "collection_timestamp": collection_timestamp, "status": "FAILED",
        "raw_file": None, "records": [], "error": None,
    }

    try:
        with sync_playwright() as playwright:
            browser_options = {"headless": headless}
            browser_channel = os.getenv("APIX_BROWSER_CHANNEL")
            if browser_channel:
                browser_options["channel"] = browser_channel
            browser = playwright.chromium.launch(**browser_options)
            page = browser.new_page(viewport={"width": 1400, "height": 900})
            try:
                page.goto(source_url, wait_until="domcontentloaded", timeout=timeout_ms)
                page.wait_for_timeout(3000)

                origin_field = page.locator('[data-testid="to-testID-origin"] input')
                origin_field.focus()
                origin_field.fill(origin)
                page.wait_for_timeout(2000)
                print(f"\nSelecting From: {origin}")
                print(f"From selected: {origin}")

                destination_field = page.locator('[data-testid="to-testID-destination"] input')
                destination_field.focus()
                destination_field.fill(destination)
                page.wait_for_timeout(5000)
                print(f"\nSelecting To: {destination}")
                print(f"To selected: {destination}")

                departure_day = str(int(departure_date.split("-")[2]))
                print("\n========== SELECTING DEPARTURE DATE ==========")
                print(f"Target date: {departure_date}")
                calendar_days = page.locator(f'[data-testid="undefined-calendar-day-{departure_day}"]')
                selected_day = False
                for index in range(calendar_days.count()):
                    candidate = calendar_days.nth(index)
                    if candidate.is_visible():
                        candidate.click(force=True)
                        selected_day = True
                        break
                if not selected_day:
                    raise RuntimeError(f"Visible departure date was not found: {departure_date}")
                print(f"Selected departure date: {departure_date}")

                search_control = page.locator("text=Search Flight").first
                search_control.wait_for(state="visible", timeout=10000)
                box = search_control.bounding_box()
                if not box:
                    raise RuntimeError("SpiceJet Search Flight control is not visible")

                with page.expect_response(
                    lambda response: "availability" in response.url.lower() and response.status == 200,
                    timeout=timeout_ms,
                ) as response_info:
                    page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)

                response = response_info.value
                response_data = response.json()
                print("\n========== EXTRACTING FARES ==========")
                trips = response_data.get("data", {}).get("trips", [])
                journeys = [
                    journey
                    for trip in trips
                    for journey in trip.get("journeysAvailable", [])
                ]
                print(f"Trips received: {len(trips)}")
                print(f"Journeys received: {len(journeys)}")
                raw_file = raw_dir / f"{datetime.now():%Y%m%d_%H%M%S_%f}_{route_id}_{departure_date}_{task_id}.json"
                raw_file.write_text(json.dumps(response_data, indent=2, ensure_ascii=False), encoding="utf-8")

                collection_timestamp = datetime.now().isoformat(timespec="seconds")
                records = extract_availability_records(
                    response_data, origin, destination, collection_timestamp
                )
                for record in records:
                    record.update({
                        "run_id": run_id, "task_id": task_id, "route_id": route_id,
                        "target_lead_days": target_lead_days, "raw_file": str(raw_file),
                    })
                print(f"Total normalized fare rows: {len(records)}")
                result.update({
                    "status": "SUCCESS", "raw_file": str(raw_file),
                    "records": records, "collection_timestamp": collection_timestamp,
                })
                return result
            finally:
                browser.close()
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
        return result


if __name__ == "__main__":
    raise SystemExit("SpiceJet scraper is task-driven. Use run(task) from the scheduler.")

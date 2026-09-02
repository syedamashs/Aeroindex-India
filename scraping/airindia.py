import json
import csv
import time
import re
from datetime import datetime, date
from pathlib import Path

from playwright.sync_api import sync_playwright


######################################
# CONFIGURATION
######################################

PROJECT_ROOT = Path(__file__).resolve().parent.parent

PROFILE_DIR = PROJECT_ROOT / ".airindia_playwright_profile"

OUTPUT_DIR = PROJECT_ROOT / "scraped_output"

ORIGIN = "Madurai"
DESTINATION = "Chennai"

DEPARTURE_DATE = "2026-09-04"

OUTPUT_DIR.mkdir(
    parents=True,
    exist_ok=True
)


######################################
# CLOSE POPUPS
######################################

def close_popups(page):

    print("\nChecking for popups...")

    popup_texts = [
        "Close",
        "Maybe Later",
        "Not Now",
        "No Thanks",
        "Skip",
    ]

    for text in popup_texts:

        try:

            elements = page.get_by_text(
                text,
                exact=True
            )

            for i in range(elements.count()):

                try:

                    element = elements.nth(i)

                    if element.is_visible():

                        element.click(
                            timeout=1500
                        )

                        print(
                            f"Closed popup using: {text}"
                        )

                        page.wait_for_timeout(500)

                        return

                except Exception:
                    pass

        except Exception:
            pass

    try:

        close_buttons = page.locator(
            'button[aria-label*="Close" i]'
        )

        for i in range(
            close_buttons.count()
        ):

            try:

                button = close_buttons.nth(i)

                if button.is_visible():

                    button.click(
                        timeout=1500
                    )

                    print(
                        "Closed popup using Close button."
                    )

                    page.wait_for_timeout(500)

                    return

            except Exception:
                pass

    except Exception:
        pass

    print(
        "No dismissible popup found."
    )


######################################
# EXTRACT CARRIER
######################################

def extract_carrier(flight_id):

    if not flight_id:

        return ""

    match = re.search(
        r"SEG-([A-Z0-9]{2})",
        flight_id
    )

    if match:

        return match.group(1)

    return ""


######################################
# SAFE NUMBER
######################################

def safe_number(value):

    try:

        if value is None:

            return 0

        if isinstance(
            value,
            (int, float)
        ):

            return value

        value = str(value)

        value = value.replace(
            ",",
            ""
        )

        return float(value)

    except Exception:

        return 0


######################################
# EXTRACT PRICE FROM AIRBOUND
######################################

def extract_price(air_bound):

    """
    Air India can expose the same fare price
    in multiple locations.

    Priority:

    1. airOffer.totalPrice
    2. airOffer.prices.totalPrices
    3. airBound.prices.totalPrices
    4. airOffer.prices.unitPrices
    5. airBound.prices.unitPrices
    6. aiUnitPrice
    """

    ######################################
    # DEFAULT VALUES
    ######################################

    base_fare = 0

    taxes = 0

    total_fare = 0

    total_fees = 0

    currency = "INR"

    price_source = ""

    ######################################
    # AIR OFFER
    ######################################

    air_offer = air_bound.get(
        "airOffer",
        {}
    )

    if not isinstance(
        air_offer,
        dict
    ):

        air_offer = {}

    ######################################
    # 1. AIR OFFER TOTAL PRICE
    ######################################

    air_offer_total_price = (
        air_offer.get(
            "totalPrice",
            {}
        )
    )

    if isinstance(
        air_offer_total_price,
        dict
    ):

        offer_value = safe_number(
            air_offer_total_price.get(
                "value",
                0
            )
        )

        offer_currency = (
            air_offer_total_price.get(
                "currencyCode",
                "INR"
            )
        )

        if offer_value > 0:

            total_fare = offer_value

            currency = offer_currency

            price_source = (
                "airOffer.totalPrice"
            )

    ######################################
    # 2. AIR OFFER PRICES
    ######################################

    air_offer_prices = (
        air_offer.get(
            "prices",
            {}
        )
    )

    if not isinstance(
        air_offer_prices,
        dict
    ):

        air_offer_prices = {}

    ######################################
    # AIR OFFER TOTAL PRICES
    ######################################

    air_offer_total_prices = (
        air_offer_prices.get(
            "totalPrices",
            []
        )
    )

    if (
        isinstance(
            air_offer_total_prices,
            list
        )
        and
        len(air_offer_total_prices) > 0
    ):

        price = air_offer_total_prices[0]

        if isinstance(
            price,
            dict
        ):

            candidate_base = safe_number(
                price.get(
                    "base",
                    0
                )
            )

            candidate_total = safe_number(
                price.get(
                    "total",
                    0
                )
            )

            candidate_taxes = safe_number(
                price.get(
                    "totalTaxes",
                    0
                )
            )

            candidate_fees = safe_number(
                price.get(
                    "totalFees",
                    0
                )
            )

            candidate_currency = (
                price.get(
                    "currencyCode",
                    "INR"
                )
            )

            if candidate_base > 0:

                base_fare = candidate_base

            if candidate_taxes > 0:

                taxes = candidate_taxes

            if candidate_total > 0:

                total_fare = candidate_total

            if candidate_fees > 0:

                total_fees = candidate_fees

            currency = candidate_currency

            if not price_source:

                price_source = (
                    "airOffer.prices.totalPrices"
                )

    ######################################
    # AIR OFFER UNIT PRICES
    ######################################

    if (
        base_fare == 0
        or
        total_fare == 0
        or
        taxes == 0
    ):

        air_offer_unit_prices = (
            air_offer_prices.get(
                "unitPrices",
                []
            )
        )

        if (
            isinstance(
                air_offer_unit_prices,
                list
            )
            and
            len(air_offer_unit_prices) > 0
        ):

            unit = air_offer_unit_prices[0]

            if isinstance(
                unit,
                dict
            ):

                unit_price_list = (
                    unit.get(
                        "prices",
                        []
                    )
                )

                if (
                    isinstance(
                        unit_price_list,
                        list
                    )
                    and
                    len(unit_price_list) > 0
                ):

                    price = unit_price_list[0]

                    if isinstance(
                        price,
                        dict
                    ):

                        candidate_base = safe_number(
                            price.get(
                                "base",
                                0
                            )
                        )

                        candidate_total = safe_number(
                            price.get(
                                "total",
                                0
                            )
                        )

                        candidate_taxes = safe_number(
                            price.get(
                                "totalTaxes",
                                0
                            )
                        )

                        candidate_currency = (
                            price.get(
                                "currencyCode",
                                "INR"
                            )
                        )

                        if base_fare == 0:

                            base_fare = (
                                candidate_base
                            )

                        if total_fare == 0:

                            total_fare = (
                                candidate_total
                            )

                        if taxes == 0:

                            taxes = (
                                candidate_taxes
                            )

                        currency = (
                            candidate_currency
                        )

                        if not price_source:

                            price_source = (
                                "airOffer.prices.unitPrices"
                            )

    ######################################
    # 3. AIRBOUND PRICES
    ######################################

    air_bound_prices = air_bound.get(
        "prices",
        {}
    )

    if not isinstance(
        air_bound_prices,
        dict
    ):

        air_bound_prices = {}

    ######################################
    # AIRBOUND TOTAL PRICES
    ######################################

    air_bound_total_prices = (
        air_bound_prices.get(
            "totalPrices",
            []
        )
    )

    if (
        isinstance(
            air_bound_total_prices,
            list
        )
        and
        len(air_bound_total_prices) > 0
    ):

        price = air_bound_total_prices[0]

        if isinstance(
            price,
            dict
        ):

            candidate_base = safe_number(
                price.get(
                    "base",
                    0
                )
            )

            candidate_total = safe_number(
                price.get(
                    "total",
                    0
                )
            )

            candidate_taxes = safe_number(
                price.get(
                    "totalTaxes",
                    0
                )
            )

            candidate_fees = safe_number(
                price.get(
                    "totalFees",
                    0
                )
            )

            candidate_currency = (
                price.get(
                    "currencyCode",
                    "INR"
                )
            )

            if base_fare == 0:

                base_fare = candidate_base

            if total_fare == 0:

                total_fare = candidate_total

            if taxes == 0:

                taxes = candidate_taxes

            if total_fees == 0:

                total_fees = candidate_fees

            currency = candidate_currency

            if not price_source:

                price_source = (
                    "airBound.prices.totalPrices"
                )

    ######################################
    # AIRBOUND UNIT PRICES
    ######################################

    if (
        base_fare == 0
        or
        total_fare == 0
        or
        taxes == 0
    ):

        air_bound_unit_prices = (
            air_bound_prices.get(
                "unitPrices",
                []
            )
        )

        if (
            isinstance(
                air_bound_unit_prices,
                list
            )
            and
            len(air_bound_unit_prices) > 0
        ):

            unit = air_bound_unit_prices[0]

            if isinstance(
                unit,
                dict
            ):

                unit_price_list = (
                    unit.get(
                        "prices",
                        []
                    )
                )

                if (
                    isinstance(
                        unit_price_list,
                        list
                    )
                    and
                    len(unit_price_list) > 0
                ):

                    price = unit_price_list[0]

                    if isinstance(
                        price,
                        dict
                    ):

                        candidate_base = safe_number(
                            price.get(
                                "base",
                                0
                            )
                        )

                        candidate_total = safe_number(
                            price.get(
                                "total",
                                0
                            )
                        )

                        candidate_taxes = safe_number(
                            price.get(
                                "totalTaxes",
                                0
                            )
                        )

                        candidate_currency = (
                            price.get(
                                "currencyCode",
                                "INR"
                            )
                        )

                        if base_fare == 0:

                            base_fare = (
                                candidate_base
                            )

                        if total_fare == 0:

                            total_fare = (
                                candidate_total
                            )

                        if taxes == 0:

                            taxes = (
                                candidate_taxes
                            )

                        currency = (
                            candidate_currency
                        )

                        if not price_source:

                            price_source = (
                                "airBound.prices.unitPrices"
                            )

    ######################################
    # 4. AI UNIT PRICE
    ######################################

    ai_unit_price = air_bound.get(
        "aiUnitPrice",
        {}
    )

    if not isinstance(
        ai_unit_price,
        dict
    ):

        ai_unit_price = {}

    ai_value = safe_number(
        ai_unit_price.get(
            "value",
            0
        )
    )

    ai_currency = (
        ai_unit_price.get(
            "currencyCode",
            "INR"
        )
    )

    ######################################
    # AI UNIT PRICE AS FALLBACK
    ######################################

    if total_fare == 0:

        if ai_value > 0:

            total_fare = ai_value

            currency = ai_currency

            price_source = (
                "aiUnitPrice"
            )

    ######################################
    # TAX FALLBACK FROM TAX ARRAY
    ######################################

    if taxes == 0:

        possible_prices = []

        possible_prices.extend(
            air_bound_total_prices
        )

        possible_prices.extend(
            air_offer_total_prices
        )

        for price in possible_prices:

            if not isinstance(
                price,
                dict
            ):

                continue

            tax_list = price.get(
                "taxes",
                []
            )

            if not isinstance(
                tax_list,
                list
            ):

                continue

            calculated_taxes = 0

            for tax in tax_list:

                if isinstance(
                    tax,
                    dict
                ):

                    calculated_taxes += safe_number(
                        tax.get(
                            "value",
                            0
                        )
                    )

            if calculated_taxes > 0:

                taxes = calculated_taxes

                break

    ######################################
    # FINAL PRICE VALIDATION
    ######################################

    return {

        "base_fare":
            base_fare,

        "taxes":
            taxes,

        "total_fare":
            total_fare,

        "total_fees":
            total_fees,

        "currency":
            currency,

        "price_source":
            price_source
    }


######################################
# EXTRACT FARES
######################################

def extract_fares(
    response_data,
    search_timestamp,
    departure_date
):

    records = []

    response_payload = response_data.get(
        "responsePayload",
        []
    )

    print(
        f"\nResponse payload groups: "
        f"{len(response_payload)}"
    )

    for payload in response_payload:

        air_bound_groups = payload.get(
            "airBoundGroups",
            []
        )

        for group in air_bound_groups:

            bound_details = group.get(
                "boundDetails",
                {}
            )

            origin = bound_details.get(
                "originLocationCode",
                ""
            )

            destination = bound_details.get(
                "destinationLocationCode",
                ""
            )

            segments = bound_details.get(
                "segments",
                []
            )

            group_flight_id = ""

            if segments:

                group_flight_id = segments[0].get(
                    "flightId",
                    ""
                )

            air_bounds = group.get(
                "airBounds",
                []
            )

            print(
                f"\nRoute: {origin} -> {destination}, "
                f"Air bounds: {len(air_bounds)}"
            )

            for air_bound in air_bounds:

                ######################################
                # BASIC INFORMATION
                ######################################

                air_bound_id = air_bound.get(
                    "airBoundId",
                    ""
                )

                fare_family = air_bound.get(
                    "fareFamilyCode",
                    ""
                )

                ######################################
                # AVAILABILITY
                ######################################

                availability_details = (
                    air_bound.get(
                        "availabilityDetails",
                        []
                    )
                )

                flight_id = group_flight_id

                cabin = ""

                booking_class = ""

                status_code = ""

                quota = ""

                if availability_details:

                    availability = (
                        availability_details[0]
                    )

                    flight_id = availability.get(
                        "flightId",
                        flight_id
                    )

                    cabin = availability.get(
                        "cabin",
                        ""
                    )

                    booking_class = availability.get(
                        "bookingClass",
                        ""
                    )

                    status_code = availability.get(
                        "statusCode",
                        ""
                    )

                    quota = availability.get(
                        "quota",
                        ""
                    )

                ######################################
                # FARE INFORMATION
                ######################################

                fare_infos = air_bound.get(
                    "fareInfos",
                    []
                )

                fare_class = ""

                fare_type = ""

                if fare_infos:

                    fare_info = fare_infos[0]

                    fare_class = fare_info.get(
                        "fareClass",
                        ""
                    )

                    fare_type = fare_info.get(
                        "fareType",
                        ""
                    )

                ######################################
                # EXTRACT PRICE
                ######################################

                price_data = extract_price(
                    air_bound
                )

                base_fare = price_data[
                    "base_fare"
                ]

                taxes = price_data[
                    "taxes"
                ]

                total_fare = price_data[
                    "total_fare"
                ]

                total_fees = price_data[
                    "total_fees"
                ]

                currency = price_data[
                    "currency"
                ]

                price_source = price_data[
                    "price_source"
                ]

                ######################################
                # CARRIER
                ######################################

                carrier = extract_carrier(
                    flight_id
                )

                ######################################
                # ADVANCE PURCHASE
                ######################################

                try:

                    search_date = datetime.strptime(
                        search_timestamp[:10],
                        "%Y-%m-%d"
                    ).date()

                    departure_dt = datetime.strptime(
                        departure_date,
                        "%Y-%m-%d"
                    ).date()

                    advance_purchase_window = (
                        departure_dt - search_date
                    ).days

                except Exception:

                    advance_purchase_window = ""

                ######################################
                # RECORD
                ######################################

                record = {

                    "search_timestamp":
                        search_timestamp,

                    "departure_date":
                        departure_date,

                    "origin":
                        origin,

                    "destination":
                        destination,

                    "carrier":
                        carrier,

                    "flight_id":
                        flight_id,

                    "air_bound_id":
                        air_bound_id,

                    "cabin":
                        cabin,

                    "booking_class":
                        booking_class,

                    "fare_class":
                        fare_class,

                    "fare_family":
                        fare_family,

                    "fare_type":
                        fare_type,

                    "status_code":
                        status_code,

                    "quota":
                        quota,

                    "base_fare":
                        base_fare,

                    "taxes":
                        taxes,

                    "total_fees":
                        total_fees,

                    "total_fare":
                        total_fare,

                    "currency":
                        currency,

                    "price_source":
                        price_source,

                    "advance_purchase_window":
                        advance_purchase_window
                }

                records.append(
                    record
                )

    ######################################
    # REMOVE DUPLICATES
    ######################################

    unique_records = []

    seen = set()

    for record in records:

        key = (

            record["origin"],

            record["destination"],

            record["departure_date"],

            record["flight_id"],

            record["fare_class"],

            record["booking_class"],

            record["total_fare"]
        )

        if key not in seen:

            seen.add(key)

            unique_records.append(
                record
            )

    print(
        f"\nUnique fare records: "
        f"{len(unique_records)}"
    )

    return unique_records


######################################
# SAVE CSV
######################################

def save_csv(
    records,
    output_file
):

    if not records:

        print(
            "No records to save."
        )

        return

    fieldnames = [
        "search_timestamp",
        "departure_date",
        "origin",
        "destination",
        "carrier",
        "flight_id",
        "air_bound_id",
        "cabin",
        "booking_class",
        "fare_class",
        "fare_family",
        "fare_type",
        "status_code",
        "quota",
        "base_fare",
        "taxes",
        "total_fees",
        "total_fare",
        "currency",
        "price_source",
        "advance_purchase_window",
    ]

    with open(
        output_file,
        "w",
        newline="",
        encoding="utf-8-sig"
    ) as file:

        writer = csv.DictWriter(
            file,
            fieldnames=fieldnames
        )

        writer.writeheader()

        writer.writerows(
            records
        )

    print(
        "\nCSV saved successfully:"
    )

    print(
        output_file
    )


######################################
# MAIN
######################################

print(
    "\n"
    "######################################\n"
    "# STARTING AIR INDIA SCRAPER\n"
    "######################################"
)


with sync_playwright() as p:

    ######################################
    # LAUNCH CHROME
    ######################################

    context = p.chromium.launch_persistent_context(

        user_data_dir=PROFILE_DIR,

        channel="chrome",

        headless=False,

        args=[
            "--disable-blink-features=AutomationControlled",
            "--disable-web-security",
        ],

        viewport={
            "width": 1400,
            "height": 900
        }
    )

    page = (
        context.pages[0]
        if context.pages
        else context.new_page()
    )

    ######################################
    # REQUEST HANDLER
    ######################################

    def handle_request(request):

        if "air-bounds" in request.url:

            print(
                "\n"
                "######################################\n"
                "# AIR-BOUNDS REQUEST\n"
                "######################################"
            )

            print(
                "Method:",
                request.method
            )

            print(
                "URL:",
                request.url
            )

            try:

                print(
                    "\nPOST DATA:"
                )

                print(
                    request.post_data
                )

            except Exception:
                pass

            print(
                "\nRequest headers "
                "(Authorization/Cookie redacted)"
            )

            try:

                headers = dict(
                    request.headers
                )

                safe_headers = {}

                for key, value in headers.items():

                    if key.lower() in [
                        "authorization",
                        "cookie"
                    ]:

                        safe_headers[key] = (
                            "[REDACTED]"
                        )

                    else:

                        safe_headers[key] = value

                print(
                    json.dumps(
                        safe_headers,
                        indent=2
                    )
                )

            except Exception:
                pass

    ######################################
    # RESPONSE HANDLER
    ######################################

    def handle_response(response):

        if "air-bounds" in response.url:

            print(
                "\n"
                "######################################\n"
                "# AIR-BOUNDS RESPONSE\n"
                "######################################"
            )

            print(
                "Status:",
                response.status
            )

            print(
                "URL:",
                response.url
            )

            if response.status == 200:

                print(
                    "\nAir-bounds JSON captured successfully!"
                )

    ######################################
    # FAILED REQUEST
    ######################################

    def handle_failed_request(request):

        if "air-bounds" in request.url:

            print(
                "\nAIR-BOUNDS REQUEST FAILED:"
            )

            print(
                request.failure
            )

    ######################################
    # CONSOLE
    ######################################

    def handle_console(message):

        text = message.text

        if (
            "Geolocation" in text
            or
            "GSI_LOGGER" in text
        ):

            print(
                "Browser console:",
                text
            )

    page.on(
        "request",
        handle_request
    )

    page.on(
        "response",
        handle_response
    )

    page.on(
        "requestfailed",
        handle_failed_request
    )

    page.on(
        "console",
        handle_console
    )

    ######################################
    # OPEN AIR INDIA
    ######################################

    print(
        "\nOpening Air India..."
    )

    page.goto(
        "https://www.airindia.com/",
        wait_until="domcontentloaded",
        timeout=120000
    )

    page.wait_for_timeout(
        5000
    )

    print(
        "Air India opened."
    )

    ######################################
    # COOKIE / POPUPS
    ######################################

    close_popups(page)

    ######################################
    # AIRPORT INPUTS
    ######################################

    airports = page.locator(
        'input[aria-label="Select origin airport"]'
    )

    print(
        "\nAirport input count:",
        airports.count()
    )

    ######################################
    # ORIGIN
    ######################################

    origin = airports.nth(0)

    origin.click()

    page.wait_for_timeout(
        500
    )

    origin.fill(
        ORIGIN
    )

    page.wait_for_timeout(
        1500
    )

    delhi_elements = page.get_by_text(
        ORIGIN,
        exact=False
    )

    origin_selected = False

    for i in range(
        delhi_elements.count()
    ):

        try:

            element = delhi_elements.nth(i)

            if not element.is_visible():

                continue

            text = (
                element.inner_text()
                .strip()
            )

            if "delhi" in text.lower():

                element.click(
                    timeout=3000
                )

                origin_selected = True

                print(
                    "Origin selected:",
                    text
                )

                break

        except Exception:
            pass

    if not origin_selected:

        print(
            "WARNING: Origin selection failed."
        )

    ######################################
    # DESTINATION
    ######################################

    destination = airports.nth(1)

    destination.click()

    page.wait_for_timeout(
        500
    )

    destination.fill(
        DESTINATION
    )

    page.wait_for_timeout(
        1500
    )

    mumbai_elements = page.get_by_text(
        DESTINATION,
        exact=False
    )

    destination_selected = False

    for i in range(
        mumbai_elements.count()
    ):

        try:

            element = mumbai_elements.nth(i)

            if not element.is_visible():

                continue

            text = (
                element.inner_text()
                .strip()
            )

            if (
                "mumbai" in text.lower()
                and
                "navi mumbai"
                not in text.lower()
            ):

                element.click(
                    timeout=3000
                )

                destination_selected = True

                print(
                    "Destination selected:",
                    text
                )

                break

        except Exception:
            pass

    if not destination_selected:

        print(
            "WARNING: Destination selection failed."
        )

    ######################################
    # DATE PICKER
    ######################################

    date_picker_button = page.get_by_role(
        "button",
        name="Open date picker"
    )

    date_picker_button.click()

    print(
        "\nDate picker opened."
    )

    page.wait_for_timeout(
        1000
    )

    ######################################
    # DATE PICKER ONE WAY
    ######################################

    one_way_checkbox = page.locator(
        'input[name="isOneWay"]'
    )

    print(
        "One Way checkbox count:",
        one_way_checkbox.count()
    )

    if one_way_checkbox.count() > 0:

        checkbox = one_way_checkbox.first

        try:

            if not checkbox.is_checked():

                parent = checkbox.locator(
                    "xpath=.."
                )

                parent.click()

                print(
                    "One Way selected."
                )

            else:

                print(
                    "One Way already selected."
                )

        except Exception as e:

            print(
                "One Way error:",
                e
            )

    ######################################
    # SELECT SEPTEMBER 3
    ######################################

    departure_day = str(int(DEPARTURE_DATE.split("-")[2]))

    dates = page.get_by_text(departure_day, exact=True)

    selected_date = False

    for i in range(
        dates.count()
    ):

        try:

            element = dates.nth(i)

            if not element.is_visible():

                continue

            try:

                element.click(
                    timeout=3000
                )

                selected_date = True

                print(f"{DEPARTURE_DATE} selected.")

                break

            except Exception:
                pass

            try:

                button = element.locator(
                    "xpath=ancestor::button[1]"
                )

                if (
                    button.count() > 0
                    and
                    button.first.is_visible()
                ):

                    button.first.click(
                        timeout=3000
                    )

                    selected_date = True

                    print(
                        "September 3 selected "
                        "through button."
                    )

                    break

            except Exception:
                pass

        except Exception:
            pass

    if not selected_date:

        print(
            "WARNING: September 3 "
            "was not selected."
        )

    ######################################
    # WAIT
    ######################################

    page.wait_for_timeout(
        1000
    )

    ######################################
    # SEARCH BUTTON
    ######################################

    search_button = page.get_by_role(
        "button",
        name=re.compile(
            r"Search",
            re.IGNORECASE
        )
    )

    print(
        "\nSearch button count:",
        search_button.count()
    )

    try:

        print(
            "Search enabled:",
            search_button.first.is_enabled()
        )

    except Exception:
        pass

    ######################################
    # SEARCH + RESPONSE CAPTURE
    ######################################

    print(
        "\nClicking Search..."
    )

    with page.expect_response(
        lambda response:
            "air-bounds" in response.url,
        timeout=120000
    ) as response_info:

        search_button.first.click()

    air_bounds_response = (
        response_info.value
    )

    print(
        "\n"
        "######################################\n"
        "# AIR-BOUNDS RESPONSE RECEIVED!\n"
        "######################################"
    )

    print(
        "Status:",
        air_bounds_response.status
    )

    ######################################
    # PARSE JSON
    ######################################

    response_data = (
        air_bounds_response.json()
    )

    print(
        "\nAir-bounds JSON parsed successfully!"
    )

    print(
        "\nRESPONSE READY FOR PROCESSING"
    )

    print(
        "Response type:",
        type(response_data).__name__
    )

    print(
        "Top-level keys:",
        list(response_data.keys())
    )

    ######################################
    # SAVE RAW JSON
    ######################################

    timestamp = datetime.now().strftime(
        "%Y%m%d_%H%M%S"
    )

    raw_file = (
        OUTPUT_DIR
        /
        f"airindia_raw_{timestamp}.json"
    )

    with open(
        raw_file,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            response_data,
            file,
            indent=2,
            ensure_ascii=False
        )

    print(
        "\nRaw JSON saved:"
    )

    print(
        raw_file
    )

    ######################################
    # SEARCH TIMESTAMP
    ######################################

    search_timestamp = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    ######################################
    # EXTRACT FARES
    ######################################

    fare_records = extract_fares(
        response_data,
        search_timestamp,
        DEPARTURE_DATE
    )

    print(
        "\nFare records extracted:",
        len(fare_records)
    )

    ######################################
    # PRICE CHECK
    ######################################

    non_zero_prices = 0

    zero_prices = 0

    for record in fare_records:

        if record["total_fare"] > 0:

            non_zero_prices += 1

        else:

            zero_prices += 1

    print(
        "\n"
        "######################################\n"
        "# PRICE EXTRACTION CHECK\n"
        "######################################"
    )

    print(
        "Total fare records:",
        len(fare_records)
    )

    print(
        "Non-zero prices:",
        non_zero_prices
    )

    print(
        "Zero prices:",
        zero_prices
    )

    ######################################
    # PREVIEW
    ######################################

    print(
        "\n"
        "######################################\n"
        "# FARE PREVIEW\n"
        "######################################"
    )

    for index, record in enumerate(
        fare_records[:10],
        start=1
    ):

        print(
            f"\nFare {index}"
        )

        print(
            "Route:",
            record["origin"],
            "->",
            record["destination"]
        )

        print(
            "Flight:",
            record["flight_id"]
        )

        print(
            "Fare class:",
            record["fare_class"]
        )

        print(
            "Base:",
            record["base_fare"],
            record["currency"]
        )

        print(
            "Taxes:",
            record["taxes"]
        )

        print(
            "Fees:",
            record["total_fees"]
        )

        print(
            "Total:",
            record["total_fare"],
            record["currency"]
        )

        print(
            "Cabin:",
            record["cabin"]
        )

        print(
            "Booking class:",
            record["booking_class"]
        )

        print(
            "Price source:",
            record["price_source"]
        )

    ######################################
    # SAVE CSV
    ######################################

    csv_file = (
        OUTPUT_DIR
        /
        f"airindia_fares_{timestamp}.csv"
    )

    save_csv(
        fare_records,
        csv_file
    )

    ######################################
    # DONE
    ######################################

    print(
        "\n"
        "######################################\n"
        "# SCRAPING COMPLETED\n"
        "######################################"
    )

    print(
        "\nBrowser will remain open."
    )

    print(
        "Press ENTER to close..."
    )

    input()

    context.close()
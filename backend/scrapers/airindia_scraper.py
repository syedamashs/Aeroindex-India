import json
import csv
import os
import time
import re
from datetime import datetime, date, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright


######################################
# CLOSE POPUPS
######################################

def close_popups(page):

    # Handle Air India's OneTrust cookie overlay before touching the booking form.
    try:
        consent_selectors = [
            "#onetrust-accept-btn-handler",
            'button:has-text("Accept All Cookies")',
            'button:has-text("Accept All")',
            'button:has-text("Allow All")',
            'button:has-text("I Agree")',
        ]

        consent_done = False

        for selector in consent_selectors:
            try:
                buttons = page.locator(selector)
                for i in range(buttons.count()):
                    button = buttons.nth(i)
                    if button.is_visible():
                        button.click(timeout=3000)
                        print("Accepted cookie consent.")
                        page.wait_for_timeout(1000)
                        consent_done = True
                        break
                if consent_done:
                    break
            except Exception:
                pass

        if not consent_done:
            for consent_text in [
                "Accept All Cookies",
                "Accept All",
                "Allow All",
                "I Agree",
            ]:
                try:
                    elements = page.get_by_text(
                        consent_text,
                        exact=True
                    )
                    for i in range(elements.count()):
                        element = elements.nth(i)
                        if element.is_visible():
                            element.click(timeout=3000)
                            print(
                                f"Accepted cookie consent using: {consent_text}"
                            )
                            page.wait_for_timeout(1000)
                            consent_done = True
                            break
                    if consent_done:
                        break
                except Exception:
                    pass
    except Exception:
        pass


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

def advance_calendar_to_date(page, departure_date):
    date_locator = page.locator(f'[data-date="{departure_date}"]')
    target = date.fromisoformat(str(departure_date))
    today = date.today()
    month_distance = (target.year - today.year) * 12 + target.month - today.month
    clicks_needed = max(0, month_distance - 1)
    if clicks_needed == 0:
        return

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
            return

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
# EXTRACT FLIGHT DETAILS
######################################

def extract_flight_details(response_data, flight_id):
    """
    Extract detailed flight information from Air India's dictionaries.
    """

    result = {
        "marketing_airline": "",
        "operating_airline": "",
        "flight_number": "",
        "departure_datetime": "",
        "arrival_datetime": "",
        "duration_minutes": "",
        "aircraft_code": "",
        "connection_time_minutes": "",
    }

    dictionaries = response_data.get(
        "dictionaries",
        {}
    )

    flights = dictionaries.get(
        "flight",
        {}
    )

    flight = flights.get(
        flight_id,
        {}
    )

    if not isinstance(flight, dict):
        return result

    result["marketing_airline"] = flight.get(
        "marketingAirlineCode",
        ""
    )

    result["operating_airline"] = flight.get(
        "operatingAirlineCode",
        ""
    )

    result["flight_number"] = flight.get(
        "marketingFlightNumber",
        ""
    )

    departure = flight.get(
        "departure",
        {}
    )

    arrival = flight.get(
        "arrival",
        {}
    )

    if isinstance(departure, dict):
        result["departure_datetime"] = departure.get(
            "dateTime",
            ""
        )

    if isinstance(arrival, dict):
        result["arrival_datetime"] = arrival.get(
            "dateTime",
            ""
        )

    duration_seconds = safe_number(
        flight.get(
            "duration",
            0
        )
    )

    if duration_seconds > 0:
        result["duration_minutes"] = round(
            duration_seconds / 60,
            2
        )

    result["aircraft_code"] = flight.get(
        "aircraftCode",
        ""
    )

    connection_seconds = safe_number(
        flight.get(
            "connectionTime",
            0
        )
    )

    if connection_seconds > 0:
        result["connection_time_minutes"] = round(
            connection_seconds / 60,
            2
        )
    else:
        result["connection_time_minutes"] = 0

    return result


######################################
# EXTRACT FARE FAMILY DETAILS
######################################

def extract_fare_family_details(
    response_data,
    fare_family
):
    """
    Extract fare-family metadata from Air India's dictionaries.
    """

    result = {
        "fare_family_name": "",
        "fare_family_hierarchy": "",
        "commercial_fare_family": "",
        "fare_cabin_name": "",
        "change_fee": "",
        "cancel_refund_fee": "",
    }

    dictionaries = response_data.get(
        "dictionaries",
        {}
    )

    fare_families = dictionaries.get(
        "fareFamilyWithServices",
        {}
    )

    details = fare_families.get(
        fare_family,
        {}
    )

    if not isinstance(details, dict):
        return result

    result["fare_family_name"] = details.get(
        "aiFareFamilyName",
        ""
    )

    result["fare_family_hierarchy"] = details.get(
        "hierarchy",
        ""
    )

    result["commercial_fare_family"] = details.get(
        "commercialFareFamily",
        ""
    )

    result["fare_cabin_name"] = details.get(
        "aiCabinName",
        ""
    )

    result["change_fee"] = details.get(
        "aiChangeFee",
        ""
    )

    result["cancel_refund_fee"] = details.get(
        "aiCancelRefundFee",
        ""
    )

    return result


######################################
# EXTRACT BAGGAGE
######################################

def extract_baggage_kg(
    response_data,
    air_bound
):
    """
    Extract free checked baggage associated with the fare.
    """

    dictionaries = response_data.get(
        "dictionaries",
        {}
    )

    services_dictionary = dictionaries.get(
        "service",
        {}
    )

    services = air_bound.get(
        "services",
        []
    )

    if not isinstance(services, list):
        return ""

    baggage_values = []

    for service in services:

        if not isinstance(service, dict):
            continue

        service_code = service.get(
            "serviceCode",
            ""
        )

        service_details = services_dictionary.get(
            service_code,
            {}
        )

        if not isinstance(service_details, dict):
            continue

        if service_details.get(
            "serviceType",
            ""
        ) != "freeCheckedBaggage":
            continue

        descriptions = service_details.get(
            "baggagePolicyDescriptions",
            []
        )

        if not isinstance(descriptions, list):
            continue

        for description in descriptions:

            if not isinstance(description, dict):
                continue

            if description.get(
                "type",
                ""
            ) != "weight":
                continue

            unit = description.get(
                "weightUnit",
                ""
            )

            quantity = safe_number(
                description.get(
                    "quantity",
                    0
                )
            )

            if (
                unit.lower() == "kilogram"
                and quantity > 0
            ):
                baggage_values.append(
                    quantity
                )

    if baggage_values:
        return max(baggage_values)

    return ""
######################################
# EXTRACT FARES
######################################

######################################
# EXTRACT FARES
######################################

def extract_fares(
    response_data,
    search_timestamp,
    departure_date,
    requested_origin,
    requested_destination,
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

            ######################################
            # BOUND DETAILS
            ######################################

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

            if (
                origin.upper() != requested_origin.upper()
                or destination.upper() != requested_destination.upper()
            ):
                print(
                    f"Skipping non-requested route: "
                    f"{origin} -> {destination}"
                )
                continue

            ######################################
            # EACH FARE OPTION
            ######################################

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

                availability_details = air_bound.get(
                    "availabilityDetails",
                    []
                )

                flight_id = group_flight_id

                cabin = ""
                booking_class = ""
                status_code = ""
                quota = ""

                if availability_details:

                    availability = availability_details[0]

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
                # PRICE
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
                # FLIGHT DETAILS
                ######################################

                flight_details = extract_flight_details(
                    response_data,
                    flight_id
                )

                ######################################
                # FARE FAMILY DETAILS
                ######################################

                fare_family_details = (
                    extract_fare_family_details(
                        response_data,
                        fare_family
                    )
                )

                ######################################
                # BAGGAGE
                ######################################

                baggage_kg = extract_baggage_kg(
                    response_data,
                    air_bound
                )

                ######################################
                # CARRIER
                ######################################

                carrier = extract_carrier(
                    flight_id
                )

                ######################################
                # ADVANCE PURCHASE WINDOW
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
                # ACTUAL DEPARTURE DATE
                ######################################

                actual_departure_date = (
                    flight_details[
                        "departure_datetime"
                    ][:10]
                    if flight_details[
                        "departure_datetime"
                    ]
                    else departure_date
                )

                ######################################
                # IS CHEAPEST OFFER
                ######################################

                is_cheapest_offer = air_bound.get(
                    "isCheapestOffer",
                    False
                )

                ######################################
                # RECORD
                ######################################

                record = {

                    # ------------------------------
                    # COLLECTION
                    # ------------------------------

                    "search_timestamp":
                        search_timestamp,

                    "requested_departure_date":
                        departure_date,

                    "actual_departure_date":
                        actual_departure_date,

                    "advance_purchase_days":
                        advance_purchase_window,

                    # ------------------------------
                    # ROUTE
                    # ------------------------------

                    "origin":
                        origin,

                    "destination":
                        destination,

                    # ------------------------------
                    # FLIGHT
                    # ------------------------------

                    "carrier":
                        carrier,

                    "marketing_airline":
                        flight_details[
                            "marketing_airline"
                        ],

                    "operating_airline":
                        flight_details[
                            "operating_airline"
                        ],

                    "flight_number":
                        flight_details[
                            "flight_number"
                        ],

                    "flight_id":
                        flight_id,

                    "air_bound_id":
                        air_bound_id,

                    "departure_datetime":
                        flight_details[
                            "departure_datetime"
                        ],

                    "arrival_datetime":
                        flight_details[
                            "arrival_datetime"
                        ],

                    "duration_minutes":
                        flight_details[
                            "duration_minutes"
                        ],

                    "aircraft_code":
                        flight_details[
                            "aircraft_code"
                        ],

                    "connection_time_minutes":
                        flight_details[
                            "connection_time_minutes"
                        ],

                    # ------------------------------
                    # FARE PRODUCT
                    # ------------------------------

                    "cabin":
                        cabin,

                    "fare_cabin_name":
                        fare_family_details[
                            "fare_cabin_name"
                        ],

                    "booking_class":
                        booking_class,

                    "fare_class":
                        fare_class,

                    "fare_family":
                        fare_family,

                    "fare_family_name":
                        fare_family_details[
                            "fare_family_name"
                        ],

                    "fare_family_hierarchy":
                        fare_family_details[
                            "fare_family_hierarchy"
                        ],

                    "commercial_fare_family":
                        fare_family_details[
                            "commercial_fare_family"
                        ],

                    "fare_type":
                        fare_type,

                    # ------------------------------
                    # AVAILABILITY
                    # ------------------------------

                    "status_code":
                        status_code,

                    "quota":
                        quota,

                    "is_cheapest_offer":
                        is_cheapest_offer,

                    # ------------------------------
                    # PRICE
                    # ------------------------------

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

                    # ------------------------------
                    # PRODUCT ATTRIBUTES
                    # ------------------------------

                    "baggage_kg":
                        baggage_kg,

                    "change_fee":
                        fare_family_details[
                            "change_fee"
                        ],

                    "cancel_refund_fee":
                        fare_family_details[
                            "cancel_refund_fee"
                        ]
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

            record["actual_departure_date"],

            record["flight_id"],

            record["fare_family"],

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

    fieldnames = list(
        records[0].keys()
    )

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
# SELECT AIRPORT
######################################

def select_airport(page, airport_input, city_name, airport_code):
    """
    Select the exact airport code from Air India's autocomplete dropdown.
    """

    airport_code = str(airport_code).upper()
    print(f"\nSelecting airport: {city_name} ({airport_code})")

    airport_input.click()

    airport_input.fill("")

    airport_input.fill(city_name)

    page.wait_for_timeout(1500)

    print(f"Typed: {city_name}")

    # Do not select the first suggestion: DEL can match ADL, and Mumbai can
    # match multiple airports. Select only an option containing the required
    # IATA code.
    option = None
    for selector in (
        '[role="option"]:visible',
        'li:visible',
    ):
        options = page.locator(selector)
        for index in range(options.count()):
            candidate = options.nth(index)
            text = candidate.inner_text().upper()
            if airport_code in text:
                option = candidate
                break
        if option is not None:
            break

    if option is None:
        raise RuntimeError(
            f"Air India airport option {airport_code} was not found for {city_name}"
        )

    option.click()
    page.wait_for_timeout(1000)

    # Air India may replace the city name with its IATA code
    # e.g. Madurai -> IXM
    selected_value = airport_input.input_value()

    print(f"Selected airport value: {selected_value}")

    if not selected_value.strip():
        print(
            f"WARNING: Airport selection is empty for {city_name}"
        )
        return False

    print(
        f"Successfully selected {city_name} "
        f"(Air India value: {selected_value})"
    )

    return True

######################################
# MAIN
######################################


# ============================================================
# PRODUCTION ENTRY POINT
# ============================================================

def run(task):
    """Run one Air India collection task.

    Expected task keys:
        run_id, task_id, route_id, origin, destination,
        departure_date, target_lead_days

    Optional:
        origin_query, destination_query, profile_dir, output_dir
    """
    required = [
        "run_id", "task_id", "route_id", "origin", "destination",
        "departure_date", "target_lead_days"
    ]
    missing = [k for k in required if k not in task]
    if missing:
        raise ValueError(f"Missing task fields: {missing}")

    run_id = str(task["run_id"])
    task_id = str(task["task_id"])
    route_id = str(task["route_id"])
    origin_code = str(task["origin"]).upper()
    destination_code = str(task["destination"]).upper()
    departure_date = str(task["departure_date"])
    target_lead_days = int(task["target_lead_days"])

    # Search by code so a city with multiple airports cannot select the wrong
    # autocomplete result, such as NMI instead of BOM for Mumbai.
    origin_query = str(task.get("origin_query") or origin_code)
    destination_query = str(task.get("destination_query") or destination_code)

    output_dir = Path(task.get("output_dir") or Path(__file__).resolve().parents[1] / "data")
    raw_dir = output_dir / "raw" / "airindia"
    raw_dir.mkdir(parents=True, exist_ok=True)

    profile_dir = str(task.get("profile_dir") or (Path.home() / ".apix" / "profiles" / "airindia"))

    collection_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    result = {
        "run_id": run_id,
        "task_id": task_id,
        "route_id": route_id,
        "source": "Air India",
        "origin": origin_code,
        "destination": destination_code,
        "departure_date": departure_date,
        "target_lead_days": target_lead_days,
        "collection_timestamp": collection_timestamp,
        "status": "FAILED",
        "raw_file": None,
        "records": [],
        "error": None,
    }

    try:
        print("\n######################################")
        print("# AIR INDIA PRODUCTION TASK")
        print("######################################")
        print(f"run_id: {run_id}")
        print(f"task_id: {task_id}")
        print(f"route: {origin_code} -> {destination_code}")
        print(f"departure: {departure_date}")
        print(f"target lead: T+{target_lead_days}")

        with sync_playwright() as p:
            browser_options = {
                "user_data_dir": profile_dir,
                "headless": str(os.getenv("APIX_HEADLESS", "false")).lower() == "true",
                "args": [
                    "--disable-blink-features=AutomationControlled",
                    "--disable-web-security",
                ],
                "viewport": {"width": 1400, "height": 900},
            }
            browser_channel = os.getenv("APIX_BROWSER_CHANNEL")
            if browser_channel:
                browser_options["channel"] = browser_channel
            context = p.chromium.launch_persistent_context(**browser_options)

            page = context.pages[0] if context.pages else context.new_page()

            # Keep the existing network diagnostics from the validated scraper,
            # but do not print credentials/cookies.
            def handle_request(request):
                if "air-bounds" in request.url:
                    print(f"Air-bounds request: {request.method} {request.url}")

            def handle_response(response):
                if "air-bounds" in response.url:
                    print(f"Air-bounds response: {response.status} {response.url}")

            def handle_failed_request(request):
                if "air-bounds" in request.url:
                    print(f"Air-bounds request failed: {request.failure}")

            page.on("request", handle_request)
            page.on("response", handle_response)
            page.on("requestfailed", handle_failed_request)

            try:
                page.goto(
                    "https://www.airindia.com/",
                    wait_until="domcontentloaded",
                    timeout=120000,
                )
                page.wait_for_timeout(5000)
                close_popups(page)

                airports = page.locator('input[aria-label="Select origin airport"]')
                if airports.count() < 2:
                    raise RuntimeError("Could not find both Air India airport inputs")

                if not select_airport(page, airports.nth(0), origin_query, origin_code):
                    raise RuntimeError(f"Failed to select origin: {origin_query}")

                if not select_airport(page, airports.nth(1), destination_query, destination_code):
                    raise RuntimeError(f"Failed to select destination: {destination_query}")

                date_picker_button = page.get_by_role("button", name="Open date picker")
                date_picker_button.click()
                page.wait_for_timeout(1000)

                one_way_checkbox = page.locator('input[name="isOneWay"]')
                if one_way_checkbox.count() > 0:
                    checkbox = one_way_checkbox.first
                    try:
                        if not checkbox.is_checked():
                            checkbox.locator("xpath=..").click()
                    except Exception:
                        pass

                advance_calendar_to_date(page, departure_date)
                departure_day = str(int(departure_date.split("-")[2]))
                dates = page.locator(f'[data-date="{departure_date}"]')
                if dates.count() == 0:
                    dates = page.get_by_text(departure_day, exact=True)
                selected_date = False

                for i in range(dates.count()):
                    element = dates.nth(i)
                    if not element.is_visible():
                        continue
                    try:
                        element.click(timeout=3000)
                        selected_date = True
                        break
                    except Exception:
                        try:
                            button = element.locator("xpath=ancestor::button[1]")
                            if button.count() > 0 and button.first.is_visible():
                                button.first.click(timeout=3000)
                                selected_date = True
                                break
                        except Exception:
                            pass

                if not selected_date:
                    visible_date_buttons = page.locator(
                        'button[aria-label*="2026"], '
                        'button[data-date*="2026"]'
                    )
                    for i in range(visible_date_buttons.count()):
                        element = visible_date_buttons.nth(i)
                        if not element.is_visible():
                            continue
                        if departure_date in (element.get_attribute("aria-label") or "") or departure_date == element.get_attribute("data-date"):
                            element.click(timeout=3000)
                            selected_date = True
                            break

                if not selected_date:
                    raise RuntimeError(f"Departure date not selected: {departure_date}")

                page.wait_for_timeout(1000)

                search_button = None
                search_candidates = (
                    page.get_by_role("button", name=re.compile(r"Search", re.IGNORECASE)),
                    page.get_by_text(re.compile(r"^Search(?: Flight| Flights)?$", re.IGNORECASE)),
                    page.locator('[data-testid*="search" i]'),
                    page.locator('button:has-text("Search")'),
                    page.locator('[role="button"]:has-text("Search")'),
                    page.locator('.ai-button__label'),
                )
                for candidates in search_candidates:
                    for index in range(candidates.count()):
                        candidate = candidates.nth(index)
                        if candidate.is_visible() and candidate.is_enabled():
                            parent_button = candidate.locator(
                                "xpath=ancestor::*[self::button or @role='button'][1]"
                            )
                            search_button = (
                                parent_button.first
                                if parent_button.count() > 0 and parent_button.first.is_visible()
                                else candidate
                            )
                            break
                    if search_button is not None:
                        break

                if search_button is None:
                    raise RuntimeError("Air India Search button not found")

                with page.expect_response(
                    lambda response: "air-bounds" in response.url,
                    timeout=120000,
                ) as response_info:
                    search_button.click(force=True)

                air_bounds_response = response_info.value
                if air_bounds_response.status != 200:
                    raise RuntimeError(
                        f"Air India air-bounds returned HTTP {air_bounds_response.status}"
                    )

                response_data = air_bounds_response.json()

                raw_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                raw_file = raw_dir / (
                    f"{raw_timestamp}_{route_id}_{departure_date}_{task_id}.json"
                )
                with raw_file.open("w", encoding="utf-8") as file:
                    json.dump(response_data, file, indent=2, ensure_ascii=False)

                search_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                fare_records = extract_fares(
                    response_data,
                    search_timestamp,
                    departure_date,
                    origin_code,
                    destination_code,
                )

                # Attach orchestration metadata without changing the validated
                # source-specific extraction fields.
                for record in fare_records:
                    record["run_id"] = run_id
                    record["task_id"] = task_id
                    record["route_id"] = route_id
                    record["target_lead_days"] = target_lead_days
                    record["raw_file"] = str(raw_file)

                result["status"] = "SUCCESS"
                result["raw_file"] = str(raw_file)
                result["records"] = fare_records
                result["collection_timestamp"] = search_timestamp

                print(f"Air India task successful: {len(fare_records)} fare records")

            finally:
                context.close()

    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
        print(f"Air India task FAILED: {result['error']}")

    return result


if __name__ == "__main__":
    raise SystemExit(
        "Air India scraper is task-driven. Use run(task) from the scheduler."
    )

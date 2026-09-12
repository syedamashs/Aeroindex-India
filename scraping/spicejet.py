import csv
import json
import re
from datetime import date, datetime, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright


FARE_NAMES = ("SpiceSaver", "SpiceFlex", "SpiceMax")
FROM_AIRPORT = "DEL"
TO_AIRPORT = "BOM"
DEPARTURE_DATE = date.today() + timedelta(days=7)
OUTPUT_DIR = Path(__file__).resolve().parent / "scraped_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def first_visible(locator):
	for index in range(locator.count()):
		candidate = locator.nth(index)
		if candidate.is_visible():
			return candidate
	return None


def extract_fare_cards(page, flight_label, next_flight_y=None):
	"""Extract the visible SpiceJet fare columns from the rendered result."""
	labels = {
		name: first_visible(page.get_by_text(name, exact=True))
		for name in FARE_NAMES
	}
	if any(label is None for label in labels.values()):
		missing = [name for name, label in labels.items() if label is None]
		print(f"Fare headings not found: {', '.join(missing)}")
		return []

	section = labels[FARE_NAMES[0]]
	assert section is not None
	for _ in range(10):
		section = section.locator("..")
		section_text = section.inner_text()
		if all(name in section_text for name in FARE_NAMES) and "₹" in section_text:
			break
	else:
		print("Fare headings were found, but their fare section was not identified")
		return []

	flight_box = flight_label.bounding_box()
	section_box = section.bounding_box()
	if not flight_box or not section_box:
		return []
	flight_y = flight_box["y"] + flight_box["height"] / 2
	upper_y = next_flight_y or section_box["y"] + section_box["height"]

	cards = []
	for name in FARE_NAMES:
		label = first_visible(section.get_by_text(name, exact=True))
		if label is None:
			continue

		label_box = label.bounding_box()
		if not label_box:
			continue

		price_candidates = []
		for index in range(section.get_by_text(re.compile(r"₹\s*[\d,]+"), exact=False).count()):
			price_element = section.get_by_text(
				re.compile(r"₹\s*[\d,]+"), exact=False
			).nth(index)
			if not price_element.is_visible():
				continue
			price_box = price_element.bounding_box()
			if not price_box:
				continue
			price_y = price_box["y"] + price_box["height"] / 2
			if price_y < flight_y - 20 or price_y >= upper_y - 20:
				continue
			price_text = price_element.inner_text()
			price_match = re.search(r"₹\s*([\d,]+)", price_text)
			if price_match:
				price_candidates.append((
					abs((price_box["x"] + price_box["width"] / 2) -
						(label_box["x"] + label_box["width"] / 2)),
					price_element,
					price_match.group(1),
				))

		if not price_candidates:
			print(f"No price found for {name}")
			continue

		_, price_element, price_value = min(price_candidates, key=lambda item: item[0])
		card_text = price_element.locator("..").inner_text()
		points_match = re.search(r"Earn\s+([\d,]+)", card_text, re.IGNORECASE)
		cards.append({
			"fare_name": name,
			"price": int(price_value.replace(",", "")),
			"points": int(points_match.group(1).replace(",", "")) if points_match else None,
			"text": card_text.strip(),
		})

	return cards


def save_records(records):
	if not records:
		return

	timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
	json_file = OUTPUT_DIR / f"spicejet_fares_{timestamp}.json"
	csv_file = OUTPUT_DIR / f"spicejet_fares_{timestamp}.csv"

	with json_file.open("w", encoding="utf-8") as file:
		json.dump(records, file, indent=2, ensure_ascii=False)

	with csv_file.open("w", newline="", encoding="utf-8-sig") as file:
		writer = csv.DictWriter(file, fieldnames=list(records[0].keys()))
		writer.writeheader()
		writer.writerows(records)

	print(f"JSON saved successfully:\n{json_file}")
	print(f"CSV saved successfully:\n{csv_file}")


def append_first_observation(record):
	observations_file = Path(__file__).resolve().parent.parent / "datasets" / "observations.json"
	with observations_file.open("r", encoding="utf-8") as file:
		observations = json.load(file)

	last_id = max(
		[int(observation["id"].split("-")[1]) for observation in observations],
		default=0
	)
	observation = {
		"id": f"OBS-{last_id + 1:06d}",
		"collectionDate": record["search_timestamp"][:10],
		"origin": record["origin"],
		"destination": record["destination"],
		"airline": record["carrier"],
		"travelDate": record["departure_date"],
		"bookingWindow": (date.today() + timedelta(days=7) - date.today()).days,
		"travelClass": "Economy",
		"baseFare": record["base_fare"],
		"taxes": 0,
		"fees": 0,
		"totalFare": record["total_fare"],
		"currency": record["currency"],
		"source": record["source"],
		"status": "valid",
	}
	observations.append(observation)

	with observations_file.open("w", encoding="utf-8") as file:
		json.dump(observations, file, indent=2, ensure_ascii=False)

	print(f"[SUCCESS] Added {observation['id']} to observations.json")


with sync_playwright() as playwright:
	browser = playwright.chromium.launch(channel="chrome", headless=False)
	page = browser.new_page(viewport={"width": 1400, "height": 900})

	print("Opening SpiceJet...")
	page.goto("https://www.spicejet.com/", wait_until="domcontentloaded", timeout=60000)
	page.wait_for_timeout(3000)

	print(f"Typing {FROM_AIRPORT} in From...")
	origin_field = page.locator('[data-testid="to-testID-origin"] input')
	origin_field.focus()
	origin_field.fill(FROM_AIRPORT)
	page.wait_for_timeout(2000)

	print(f"Typing {TO_AIRPORT} in To...")
	destination_field = page.locator('[data-testid="to-testID-destination"] input')
	destination_field.focus()
	destination_field.fill(TO_AIRPORT)
	page.wait_for_timeout(5000)

	departure_day = str(DEPARTURE_DATE.day)
	print(f"Calendar opened. Clicking {DEPARTURE_DATE}...")
	calendar_days = page.locator(
		f'[data-testid="undefined-calendar-day-{departure_day}"]'
	)
	selected_day = False
	for index in range(calendar_days.count()):
		calendar_day = calendar_days.nth(index)
		if calendar_day.is_visible():
			calendar_day.click(force=True)
			selected_day = True
			break
	if not selected_day:
		raise RuntimeError(f"Visible date {DEPARTURE_DATE} was not found")
	page.wait_for_timeout(2000)

	print(f"{DEPARTURE_DATE} selected. Clicking Search Flight...")
	search_control = page.locator("text=Search Flight").first
	search_control.wait_for(state="visible", timeout=10000)
	search_box = search_control.bounding_box()
	if not search_box:
		raise RuntimeError("Search Flight button is not visible")
	page.mouse.click(
		search_box["x"] + search_box["width"] / 2,
		search_box["y"] + search_box["height"] / 2,
	)

	page.wait_for_url("**/search?**", timeout=30000)
	page.wait_for_timeout(15000)
	print(f"Results page opened: {page.url}")

	flight_labels = page.get_by_text(re.compile(r"^SG\s+\d+$"), exact=True)
	records = []
	visible_flights = []
	seen_flights = set()
	for index in range(flight_labels.count()):
		candidate = flight_labels.nth(index)
		if not candidate.is_visible():
			continue
		flight_id = candidate.inner_text().strip()
		if flight_id not in seen_flights:
			seen_flights.add(flight_id)
			visible_flights.append(candidate)

	if not visible_flights:
		print("No visible SpiceJet flight results found")
	else:
		print(f"\nFound {len(visible_flights)} visible flight(s)")
		for index, flight_label in enumerate(visible_flights):
			flight_box = flight_label.bounding_box()
			next_flight_y = None
			if index + 1 < len(visible_flights):
				next_box = visible_flights[index + 1].bounding_box()
				if next_box:
					next_flight_y = next_box["y"] + next_box["height"] / 2

			print("\nREAL FLIGHT RESULT")
			print(f"Flight: {flight_label.inner_text().strip()}")
			fare_cards = extract_fare_cards(page, flight_label, next_flight_y)
			for card in fare_cards:
				records.append({
					"search_timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
					"departure_date": DEPARTURE_DATE.isoformat(),
					"origin": FROM_AIRPORT,
					"destination": TO_AIRPORT,
					"carrier": "SG",
					"flight_id": flight_label.inner_text().strip(),
					"fare_name": card["fare_name"],
					"spiceclub_points": card["points"],
					"base_fare": card["price"],
					"taxes": 0,
					"fees": 0,
					"total_fare": card["price"],
					"currency": "INR",
					"source": "SpiceJet-Portal",
				})
				print(
					f"{card['fare_name']}: ₹{card['price']:,} "
					f"({card['points'] or 0} SpiceClub points)"
				)
			if not fare_cards:
				print("No fare cards extracted for this flight")

	save_records(records)
	if records:
		append_first_observation(records[0])

	print("Inspection complete. Stopping here.")
	browser.close()

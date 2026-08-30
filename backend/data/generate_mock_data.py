import json
import random
from datetime import date, timedelta

random.seed(26056)

airports = {
    "DEL": {"code": "DEL", "city": "New Delhi", "state": "Delhi", "lat": 28.6139, "lng": 77.2090, "region": "North"},
    "BOM": {"code": "BOM", "city": "Mumbai", "state": "Maharashtra", "lat": 19.0760, "lng": 72.8777, "region": "West"},
    "BLR": {"code": "BLR", "city": "Bengaluru", "state": "Karnataka", "lat": 12.9716, "lng": 77.5946, "region": "South"},
    "HYD": {"code": "HYD", "city": "Hyderabad", "state": "Telangana", "lat": 17.3850, "lng": 78.4867, "region": "South"},
    "MAA": {"code": "MAA", "city": "Chennai", "state": "Tamil Nadu", "lat": 13.0827, "lng": 80.2707, "region": "South"},
    "CCU": {"code": "CCU", "city": "Kolkata", "state": "West Bengal", "lat": 22.5726, "lng": 88.3639, "region": "East"},
    "PNQ": {"code": "PNQ", "city": "Pune", "state": "Maharashtra", "lat": 18.5204, "lng": 73.8567, "region": "West"},
    "AMD": {"code": "AMD", "city": "Ahmedabad", "state": "Gujarat", "lat": 23.0225, "lng": 72.5714, "region": "West"},
    "GOI": {"code": "GOI", "city": "Goa", "state": "Goa", "lat": 15.4989, "lng": 73.8278, "region": "West"},
    "COK": {"code": "COK", "city": "Kochi", "state": "Kerala", "lat": 9.9312, "lng": 76.2673, "region": "South"},
    "JAI": {"code": "JAI", "city": "Jaipur", "state": "Rajasthan", "lat": 26.9124, "lng": 75.7873, "region": "North"},
    "LKO": {"code": "LKO", "city": "Lucknow", "state": "Uttar Pradesh", "lat": 26.8467, "lng": 80.9462, "region": "North"},
    "IXC": {"code": "IXC", "city": "Chandigarh", "state": "Chandigarh", "lat": 30.7333, "lng": 76.7794, "region": "North"},
    "GAU": {"code": "GAU", "city": "Guwahati", "state": "Assam", "lat": 26.1445, "lng": 91.7362, "region": "North-East"},
    "IXB": {"code": "IXB", "city": "Bagdogra", "state": "West Bengal", "lat": 26.6831, "lng": 88.3251, "region": "North-East"},
    "VNS": {"code": "VNS", "city": "Varanasi", "state": "Uttar Pradesh", "lat": 25.3176, "lng": 82.9739, "region": "North"},
    "PAT": {"code": "PAT", "city": "Patna", "state": "Bihar", "lat": 25.6154, "lng": 85.1013, "region": "East"},
    "RPR": {"code": "RPR", "city": "Raipur", "state": "Chhattisgarh", "lat": 21.2514, "lng": 81.6296, "region": "Central"},
    "TRV": {"code": "TRV", "city": "Thiruvananthapuram", "state": "Kerala", "lat": 8.5241, "lng": 76.9366, "region": "South"},
    "NAG": {"code": "NAG", "city": "Nagpur", "state": "Maharashtra", "lat": 21.1458, "lng": 79.0882, "region": "Central"},
}

routes = [
    ("DEL", "BOM", 15), ("DEL", "BLR", 14), ("MAA", "DEL", 10), ("BLR", "HYD", 8), ("BOM", "BLR", 8),
    ("DEL", "CCU", 7), ("BOM", "MAA", 6), ("DEL", "HYD", 6), ("BOM", "CCU", 5), ("BLR", "COK", 5),
    ("DEL", "PNQ", 4), ("DEL", "AMD", 4), ("BOM", "GOI", 3), ("BLR", "MAA", 3), ("DEL", "JAI", 3),
    ("DEL", "LKO", 3), ("BOM", "PNQ", 2), ("DEL", "IXC", 2), ("CCU", "GAU", 2), ("DEL", "GAU", 2),
    ("BLR", "GOI", 2), ("MAA", "COK", 2), ("DEL", "VNS", 2), ("CCU", "IXB", 2), ("BOM", "AMD", 2),
    ("PAT", "DEL", 2), ("RPR", "BOM", 2), ("TRV", "BLR", 2), ("NAG", "DEL", 2), ("DEL", "PAT", 2),
]

airlines = [
    {"code": "6E", "name": "Indigo", "color": "#14b8a6", "marketShare": 35},
    {"code": "AI", "name": "Air India", "color": "#ef4444", "marketShare": 25},
    {"code": "IX", "name": "Air India Express", "color": "#f59e0b", "marketShare": 18},
    {"code": "QP", "name": "Akasa Air", "color": "#8b5cf6", "marketShare": 12},
    {"code": "SG", "name": "SpiceJet", "color": "#3b82f6", "marketShare": 7},
    {"code": "UK", "name": "Vistara", "color": "#ec4899", "marketShare": 3},
]

booking_windows = [1, 7, 15, 30, 45]
travel_classes = ["Economy", "Premium Economy", "Business"]
sources = ["Mock-OTA-Aggregator", "Mock-Airline-Portal", "Mock-GDS-Feed", "Mock-Price-Observer"]

base_date = date(2026, 1, 1)
month_mult = [1.0, 1.024, 0.998, 1.061, 1.094, 1.112, 1.089, 1.127]

holiday_dates = {
    "2026-01-26",
    "2026-03-18",
    "2026-08-15",
    "2026-03-28",
    "2026-04-14",
    "2026-07-06",
}

route_info = []
for origin, destination, weight in routes:
    o = airports[origin]
    d = airports[destination]
    lat1, lng1 = o['lat'], o['lng']
    lat2, lng2 = d['lat'], d['lng']
    import math
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    km = int(round(2 * R * math.asin(math.sqrt(a))))
    if km < 700:
        category = "short"
    elif km < 1400:
        category = "medium"
    else:
        category = "long"
    route_info.append({"id": f"{origin}-{destination}", "origin": origin, "destination": destination, "weight": weight, "distanceKm": km, "category": category})

observations = []
obs_id = 1
for route in route_info:
    origin = route["origin"]
    destination = route["destination"]
    base_fare = {"short": 2800, "medium": 4500, "long": 7500}[route["category"]]
    for month_index in range(12):
        travel_month = base_date.month + month_index
        year = 2026
        while travel_month > 12:
            travel_month -= 12
            year += 1
        for day in range(1, 31):
            travel_day = date(year, travel_month, min(day, 30))
            for booking_window in booking_windows:
                airline = random.choice(airlines)
                travel_class = random.choice(travel_classes)
                duration = random.randint(1, 5)
                travel_date = travel_day + timedelta(days=duration)
                travel_date_str = travel_date.isoformat()
                collection_date = travel_date - timedelta(days=booking_window)
                collection_date_str = collection_date.isoformat()
                weekend_factor = 1.18 if travel_date.weekday() >= 5 else 1.0
                holiday_factor = 1.35 if travel_date_str in holiday_dates else 1.0
                class_factor = {"Economy": 1.0, "Premium Economy": 1.55, "Business": 2.8}[travel_class]
                bw_factor = {1: 2.35, 7: 1.78, 15: 1.42, 30: 1.12, 45: 1.0}[booking_window]
                airline_factor = {"6E": 0.92, "AI": 1.08, "IX": 0.88, "QP": 0.95, "SG": 0.98, "UK": 1.12}[airline["code"]]
                fare = base_fare * month_mult[month_index] * bw_factor * class_factor * airline_factor * weekend_factor * holiday_factor
                fare *= random.uniform(0.92, 1.08)
                fare = max(1400, fare)
                base_part = fare * 0.78
                taxes = fare * 0.15
                fees = fare * 0.07
                total = base_part + taxes + fees
                status = "valid"
                roll = random.random()
                if roll < 0.04:
                    status = "invalid"
                elif roll < 0.065:
                    status = "duplicate"
                obs = {
                    "id": f"OBS-{obs_id:06d}",
                    "collectionDate": collection_date_str,
                    "origin": origin,
                    "destination": destination,
                    "airline": airline["code"],
                    "travelDate": travel_date_str,
                    "bookingWindow": booking_window,
                    "travelClass": travel_class,
                    "baseFare": round(base_part),
                    "taxes": round(taxes),
                    "fees": round(fees),
                    "totalFare": round(total),
                    "currency": "INR",
                    "source": random.choice(sources),
                    "status": status,
                }
                observations.append(obs)
                obs_id += 1

# Create a few invalid and duplicate entries to keep realism
for i in range(12):
    route = random.choice(route_info)
    obs = {
        "id": f"OBS-{obs_id:06d}",
        "collectionDate": "2026-08-12",
        "origin": route["origin"],
        "destination": route["destination"],
        "airline": random.choice([a['code'] for a in airlines]),
        "travelDate": "2026-08-20",
        "bookingWindow": 7,
        "travelClass": "Economy",
        "baseFare": 2500,
        "taxes": 600,
        "fees": 200,
        "totalFare": 3300,
        "currency": "INR",
        "source": "Mock-Data-Repair",
        "status": "invalid" if i % 2 == 0 else "duplicate",
    }
    observations.append(obs)
    obs_id += 1

payload = {
    "users": [
        {"role": "Administrator", "name": "Admin User", "email": "admin@aeroindex.gov.in", "password": "admin123"},
        {"role": "Analyst", "name": "Analyst User", "email": "analyst@aeroindex.gov.in", "password": "analyst123"},
        {"role": "Viewer", "name": "Viewer User", "email": "viewer@aeroindex.gov.in", "password": "viewer123"},
    ],
    "airports": [
        airports[code] for code in sorted(airports.keys())
    ],
    "routes": route_info,
    "airlines": airlines,
    "observations": observations,
}

with open("backend/data/mockData.json", "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2)
    f.write("\n")

print(f"Generated {len(payload['observations'])} observations for {len(payload['routes'])} routes.")

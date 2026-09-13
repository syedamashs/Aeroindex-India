# AeroIndex Calculation Methodology

## 1. Dataset Summary

The current local dataset contains:

- **30 monitored routes**
- **54,762 total observations**
- **51,212 valid observations**
- **2,138 invalid observations**
- **1,412 duplicate observations**
- **Total route weight: 132**

Each observation contains fields such as:

- Route: origin and destination
- Airline
- Travel date
- Booking window
- Travel class
- Base fare
- Taxes
- Fees
- Total fare
- Observation status

The index uses `totalFare` as the price value.

---

## 2. Route Metadata

Each route contains:

```text
id
origin
destination
weight
distanceKm
category
```

Example:

```json
{
  "id": "DEL-BOM",
  "origin": "DEL",
  "destination": "BOM",
  "weight": 15,
  "distanceKm": 1148,
  "category": "medium"
}
```

### Distance and category

Route distance is calculated from the origin and destination airport coordinates using the Haversine formula.

Routes are categorized as:

- **Short:** distance below 700 km
- **Medium:** distance from 700 km up to 1,399 km
- **Long:** distance of 1,400 km or more

`distanceKm` and `category` do not directly appear in the national index formula. They influence the generated fare model, which then affects the index indirectly.

The mock fare generator uses these category base fares:

- Short route: ₹2,800
- Medium route: ₹4,500
- Long route: ₹7,500

---

## 3. Observation Validation

The frontend calculation starts with valid observations only:

```text
valid observations = observations where status == "valid"
```

Invalid and duplicate records are excluded by the frontend analytics implementation.

The backend currently behaves differently: unless a status filter is supplied, it can include valid, invalid, and duplicate records in the index calculation. This is an implementation difference that should eventually be aligned.

---

## 4. Fare Used in the Index

The price used for each observation is:

```text
totalFare = baseFare + taxes + fees
```

For the generated data, the fare is divided approximately as follows:

```text
base fare portion = 78% of generated fare
taxes             = 15% of generated fare
fees              = 7% of generated fare
```

Therefore:

$$
\text{totalFare}
=
\text{baseFare}
+
\text{taxes}
+
\text{fees}
$$

All observations are grouped by their `travelDate` month.

---

## 5. Route-Level Monthly Average

For a route $r$ and month $m$, the average fare is calculated as:

$$
\text{RouteMonthlyAverage}_{r,m}
=
\frac{
\sum \text{totalFare observations for route }r\text{ in month }m
}{
\text{number of observations for route }r\text{ in month }m
}
$$

Example:

Suppose DEL-BOM has three valid observations in August:

```text
₹10,000, ₹11,000, ₹12,000
```

Then:

$$
\text{RouteMonthlyAverage}_{\text{DEL-BOM, Aug}}
=
\frac{10{,}000+11{,}000+12{,}000}{3}
=
₹11{,}000
$$

The implementation is in `frontend/src/data/analytics.ts`, in `routeMonthlyAverages()`.

---

## 6. Route-Level Index

January 2026 is the base period. January has an index value of 100.

For each route, its January average fare becomes its route-specific base:

$$
\text{RouteBase}_r
=
\text{RouteMonthlyAverage}_{r,\text{Jan 2026}}
$$

The route index for month $m$ is:

$$
\text{RouteIndex}_{r,m}
=
\frac{
\text{RouteMonthlyAverage}_{r,m}
}{
\text{RouteBase}_r
}
\times100
$$

### Example

Assume DEL-BOM has:

```text
January average fare = ₹10,000
August average fare  = ₹11,500
```

Then:

$$
\text{RouteIndex}_{\text{DEL-BOM, Aug}}
=
\frac{11{,}500}{10{,}000}\times100
=115
$$

Interpretation:

> DEL-BOM fares are 15% above the route's January 2026 level.

The route-level index is used in route statistics and in the route basket shown on the Airfare Index page.

---

## 7. National Airfare Index: Intended Weighted Calculation

The intended national index is a weighted average of route-level price relatives.

First, convert each route index into a relative value:

$$
\text{RouteRelative}_{r,m}
=
\frac{\text{RouteMonthlyAverage}_{r,m}}
{\text{RouteBase}_r}
$$

For each route, multiply the relative by its route weight:

$$
\text{WeightedRouteValue}_{r,m}
=
\text{RouteRelative}_{r,m}
\times
\text{RouteWeight}_r
$$

Then calculate the national index:

$$
\text{NationalIndex}_m
=
\frac{
\sum_r
\left(
\text{RouteRelative}_{r,m}
\times
\text{RouteWeight}_r
\right)
}{
\sum_r \text{RouteWeight}_r
}
\times100
$$

The current default route-weight total is:

```text
15 + 14 + 10 + ... = 132
```

### Example

| Route | Route relative | Weight |
|---|---:|---:|
| DEL-BOM | 1.15 | 15 |
| DEL-BLR | 1.08 | 14 |
| BLR-HYD | 1.20 | 8 |

The weighted index for this simplified basket is:

$$
\frac{
(1.15\times15)+(1.08\times14)+(1.20\times8)
}{15+14+8}
\times100
=113.0
$$

Interpretation:

> The combined airfare level is approximately 13% above the January 2026 base.

The frontend implementation of this weighted calculation is in `frontend/src/data/analytics.ts`, in `computeIndex()`.

---

## 8. Homepage Display

The dashboard homepage displays the latest value returned by:

```text
GET /api/index
```

The latest monthly index is shown as **Current Airfare Index**.

The homepage also displays the month-over-month change:

$$
\text{MoM Change}_m
=
\frac{
\text{Index}_m-\text{Index}_{m-1}
}{
\text{Index}_{m-1}
}
\times100
$$

For January 2026, the change is set to zero because it is the base period.

---

## 9. Current Backend Implementation Difference

The current Express backend does not yet use the intended weighted route-relative calculation for its displayed `indexValue`.

The backend currently:

1. Filters observations using the request query.
2. Groups all filtered observations by month.
3. Calculates one overall average fare per month.
4. Uses the first available filtered month as the baseline.
5. Divides each month average by that baseline average.

Its current formula is:

$$
\text{BackendIndex}_m
=
\frac{
\text{OverallAverageFare}_m
}{
\text{OverallAverageFare}_{\text{first filtered month}}
}
\times100
$$

This is different from the intended formula because:

- It is not route-weighted.
- It does not calculate a separate January baseline for every route.
- The baseline can change when the date filter changes.
- It may include invalid and duplicate records unless a status filter is supplied.
- Route weights are loaded by the backend, but the resulting `weightedIndex` field is not used as the displayed `indexValue`.

The backend implementation is in `backend/server.js`, in `computeIndex()`.

### Important result

There are currently two behaviors:

```text
Airfare Index page:
valid observations -> route monthly averages -> January route baselines -> weighted route index
```

```text
Dashboard homepage through backend:
filtered observations -> overall monthly averages -> first filtered month baseline -> unweighted index
```

For consistent results, the backend should be changed to use the same route-level weighted methodology as the frontend.

---

## 10. Booking Window Calculation

The booking window describes how many days before departure the fare was observed:

- `T+45`: 45 days before departure
- `T+30`: 30 days before departure
- `T+15`: 15 days before departure
- `T+7`: 7 days before departure
- `T+1`: 1 day before departure

For each booking window $w$, the average fare is:

$$
\text{AverageFare}_w
=
\frac{
\sum \text{totalFare observations where bookingWindow}=w
}{
\text{number of observations where bookingWindow}=w
}
$$

### Example comparison

To compare booking one day before departure with booking 45 days before departure:

$$
\text{LateBookingIncrease}
=
\frac{
\text{AverageFare}_{T+1}
-
\text{AverageFare}_{T+45}
}{
\text{AverageFare}_{T+45}
}
\times100
$$

If:

```text
T+45 average fare = ₹5,000
T+1 average fare  = ₹8,000
```

Then:

$$
\frac{8{,}000-5{,}000}{5{,}000}\times100
=60\%
$$

The result means that fares observed one day before departure are 60% higher than fares observed 45 days before departure in that comparison set.

Booking-window statistics are implemented in `computeBookingWindowStats()` in `frontend/src/data/analytics.ts` and in the corresponding backend function.

---

## 11. Date Time-Window Filtering

The app also has date filters such as:

- Today
- 7 days
- 30 days
- 90 days
- 180 days
- Custom date range

These filters operate on the observation's **travel date**, not its collection date.

For a selected date range:

$$
\text{Keep observation if}
\quad
\text{startDate}
\le
\text{travelDate}
\le
\text{endDate}
$$

For a custom range, the selected `customStart` and `customEnd` values are used.

For a preset such as `30d`, the backend calculates a start date by subtracting 30 days from the maximum travel date in the dataset, then keeps observations through that maximum date.

The backend date filtering is implemented in `filterObservations()` in `backend/server.js`.

### Effect on the index

With the current backend behavior, changing the date window changes:

- Which observations are included.
- The monthly averages.
- The first available baseline month.
- The displayed index values.

With the intended route-relative methodology, the date filter should select the observations used for current-period averages while preserving a stable January 2026 route baseline whenever enough baseline data is available.

---

## 12. Complete Intended Data Flow

The intended calculation pipeline is:

```text
Raw observations
        |
        v
Validate and remove invalid/duplicate records
        |
        v
Apply route, airline, class, booking-window, and date filters
        |
        v
Group valid observations by route and travel month
        |
        v
Calculate average total fare per route and month
        |
        v
Use January 2026 average as each route's base
        |
        v
Calculate each route's price relative
        |
        v
Multiply each relative by the route weight
        |
        v
Sum weighted relatives and divide by total weight
        |
        v
National Airfare Index, January 2026 = 100
```

The central formulas are:

$$
\text{RouteRelative}_{r,m}
=
\frac{\text{AverageFare}_{r,m}}
{\text{AverageFare}_{r,\text{Jan 2026}}}
$$

and:

$$
\text{NationalIndex}_m
=
\frac{\sum_r(\text{RouteRelative}_{r,m}\times\text{Weight}_r)}
{\sum_r\text{Weight}_r}
\times100
$$

This means:

- `totalFare` provides the price.
- The route and month provide the comparison group.
- January 2026 provides the base.
- Route `weight` determines national importance.
- `distanceKm` and `category` affect fare generation but are not direct index weights.
- Booking window and date filters determine which observations are included.

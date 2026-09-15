# AeroIndex India

## SIH 2026 Submission

AeroIndex India is an airfare intelligence and price-indexing platform for India's domestic aviation market. It turns flight-fare observations into a transparent, auditable set of indicators for analysts, policymakers, airlines, and informed travellers.

The platform connects the complete journey from collection to decision support:

```text
Route configuration
        |
        v
Scraping and raw-response capture
        |
        v
Airline-specific normalization
        |
        v
Canonical SQLite observations
        |
        +--> Data-quality and integrity controls
        |
        +--> Fare-state and transition analytics
        |
        +--> Price relatives and index engine
                         |
                         v
              Express API + React dashboard
```

## Why AeroIndex

Airfare is not a single number. It changes by route direction, carrier, travel date, booking lead time, fare family, availability, and collection timestamp. A useful public indicator therefore needs more than a dashboard of averages. It needs:

- A repeatable collection pipeline.
- A common fare representation across sources.
- Explicit identity and comparability rules.
- Protection against duplicate, invalid, sold-out, and incomplete observations.
- A declared index methodology with route weights and a visible base period.
- Coverage and quality diagnostics alongside every headline result.
- Drill-down views that explain the movement behind the national number.

AeroIndex is designed around those principles. Every layer is separated so that collection, validation, estimation, storage, and presentation can be reviewed independently.

## What The Platform Delivers

### National airfare index

The index engine produces a headline national airfare index from route-level movements. The base period is declared as 100, and the headline estimator is a route-weighted Jevons index. The system also exposes route coverage, represented weight, missing routes, and estimator status so a number is never presented without its context.

### Route and airline intelligence

Users can compare routes, directional markets, airlines, fare levels, volatility, minimum and maximum fares, and month-over-month or year-over-year movement. Route detail pages connect the aggregate result to monthly trends, airline comparisons, and booking-window behaviour.

### Booking-window analysis

The platform keeps lead-time buckets separate:

- `T+1` - one day before departure
- `T+7` - seven days before departure
- `T+15` - fifteen days before departure
- `T+30` - thirty days before departure
- `T+45` - forty-five days before departure

This shows how fare levels change as departure approaches without mixing incomparable booking windows.

### Fare-state analytics

Repeated collection runs are matched using flight, route, timing, fare identity, passenger type, source, and lead-time rules. Matched snapshots produce transitions such as price increase, price decrease, unchanged fare, becoming available, and becoming unavailable. The fare-state layer also reports matching coverage and the Fare Event Probability (FEP), which measures the share of comparable observations that experienced an upward fare transition.

### Data-quality governance

The data-quality engine checks schema integrity, fare arithmetic, date and time validity, flight identity, duplicates, sold-out handling, outliers, and cross-source consistency. Results are summarized with statuses, hard errors, warnings, flagged records, limitations, and an audit timestamp.

## End-to-End Architecture

### 1. Route configuration and collection planning

Reference files define airports, cities, routes, route direction, and route weights. The scheduler builds collection tasks for a route, airline/source, departure date, and target lead-time bucket. Each collection run receives a unique run identifier, and each task records its lifecycle, attempts, errors, and timestamps.

### 2. Scraping and raw-response capture

The scraper layer contains source-specific collectors for Air India, IndiGo, and SpiceJet, together with a dispatcher and shared scraper utilities. The collection process records the requested route, source, departure, lead time, URL, search timestamp, response metadata, storage path, checksum, and extraction status.

Raw responses are kept separate from canonical observations. This preserves provenance and makes it possible to investigate a normalized value without losing the original collection context.

### 3. Normalization into a canonical contract

Each source has different field names and response structures. The normalizers convert those responses into one canonical observation model containing:

- Observation and collection identifiers.
- Source and source URL.
- Search timestamp and departure/arrival times.
- Origin, destination, route, flight, carrier, and journey identity.
- Fare product, fare class, fare family, and offer identity.
- Passenger type, currency, base fare, taxes, fees, and total fare.
- Sold-out and availability signals.
- Target and actual lead time.
- Extraction status and collection provenance.

The canonical consumer price is `total_fare`. Component fields remain available for arithmetic validation and explanation.

### 4. SQLite storage

The database schema separates reference data, collection management, raw responses, canonical observations, fare-state snapshots, transitions, and index outputs. Foreign keys connect observations to collection tasks and route definitions. This provides a traceable path from a dashboard number back to the run and task that produced it.

The primary observation table is `apix_observations`. Important supporting tables include:

| Area | Tables | Purpose |
|---|---|---|
| Reference data | `dgca_route_master`, `apix_route_basket`, `airport_city_master` | Route coverage, weights, and airport metadata |
| Collection | `collection_runs`, `collection_tasks` | Run/task lifecycle and error tracking |
| Provenance | `raw_scrape_responses` | Raw response metadata and storage references |
| Canonical data | `apix_observations` | Normalized, queryable fare observations |
| Fare state | Snapshot and transition tables | Comparable repeated-run changes |
| Indexing | Index output tables | Reproducible route and national results |

### 5. Data quality and validation

Quality checks run before analytical results are trusted. The validators address:

- Schema and required-field integrity.
- `total_fare = base_fare + taxes + total_fees` arithmetic.
- Positive, finite, usable prices.
- Date/time consistency and lead-time boundaries.
- Flight and journey identity completeness.
- Duplicate observations and repeated records.
- Sold-out and missing-fare treatment.
- Suspicious outliers.
- Cross-source consistency for comparable flight groups.

Invalid or incomplete records are not silently converted into zero prices. Sold-out or missing-fare records remain useful for availability analysis but do not become price observations. Duplicate counts and rejected records remain visible in diagnostics.

### 6. Fare-state matching and transitions

The fare-state layer compares two successful collection runs. Comparability is established using a hierarchy that preserves source, route direction, departure date, lead time, carrier, flight number, timing, passenger type, and fare identity.

Fare identity uses the strongest available key:

1. `fare_availability_key`.
2. `source_offer_id`.
3. Fare product, fare class, and fare family.

If an observation cannot be compared reliably, it is excluded from the transition calculation and counted as a coverage limitation. The system does not invent missing fares, lead times, passenger types, or route movements.

### 7. Index calculation

The index engine is composed of small, testable modules for price relatives, Jevons, Laspeyres, Paasche, Fisher, route indices, national aggregation, lead-time indices, inflation, sampling, persistence, and confidence.

The production headline is the route-weighted Jevons index. Laspeyres, Paasche, and Fisher are robustness estimators and are reported for comparison when their required weights are available.

## Index Methodology

### Eligible price observations

An observation can contribute to a price-relative calculation only when it has:

- A valid route and direction.
- A usable positive finite `total_fare`.
- Sufficient flight, fare, source, and temporal identity.
- A valid comparison observation in the adjacent period.
- A compatible lead-time bucket when lead time is populated.

Repeated records from the same collection run are not treated as independent time periods. Search or observation timestamps establish temporal order; scheduler completion time does not replace observation time.

### Elementary price relative

For comparable fare identity $i$ between periods $t-1$ and $t$:

$$
r_{i,t} = \frac{p_{i,t}}{p_{i,t-1}}
$$

where $p$ is the positive, finite `total_fare`. Missing, non-positive, or non-finite prices produce no price relative and are recorded in quality coverage.

### Jevons primary estimator

For $n$ comparable price relatives in a period:

$$
J_t = \left(\prod_{i=1}^{n} r_{i,t}\right)^{1/n}
$$

The implementation uses the logarithmic form for numerical stability:

$$
\ln J_t = \frac{1}{n}\sum_{i=1}^{n}\ln(r_{i,t})
$$

Jevons measures proportional movement and prevents a few high-value fares from dominating through absolute additions.

### Route-level index

For route $r$, direction $d$, lead-time bucket $b$, and period $t$, the route relative is calculated from eligible comparable fares in that slice. The route index is chained from the declared base:

$$
I_{r,d,b,t} = I_{r,d,b,t-1} \times J_{r,d,b,t}
$$

with the selected base period set to 100. Direction is preserved: `DEL -> BOM` and `BOM -> DEL` are separate markets.

### National AeroIndex

The national index aggregates available route-level indices using the configured route or passenger-traffic weights:

$$
APIx_t =
\frac{\sum_{r \in R_t} W_r I_{r,t}}
{\sum_{r \in R_t} W_r}
$$

Only routes with valid required data participate in $R_t$. The result reports the number of represented routes, represented weight share, missing routes, quality flag, and base-period definition. A missing route is not assigned zero movement or copied movement.

### Robustness estimators

When defensible base and current weights exist, the same eligible population can be evaluated with:

- Laspeyres for previous-period weighting.
- Paasche for current-period weighting.
- Fisher as the geometric mean of Laspeyres and Paasche.

These are diagnostics for estimator stability. They do not replace the declared Jevons headline merely because one produces a preferred result.

### Inflation and lead-time series

Index levels and inflation rates are distinct. Month-over-month movement is calculated from adjacent index levels:

$$
MoM_t = \left(\frac{I_t}{I_{t-1}} - 1\right) \times 100
$$

Year-over-year movement requires the declared historical comparison period:

$$
YoY_t = \left(\frac{I_t}{I_{t-12}} - 1\right) \times 100
$$

Each lead-time bucket has its own series when data exists. A missing bucket is reported as unavailable rather than filled from another bucket.

## Product Experience

The React and TypeScript frontend provides the following workflows:

| View | Purpose |
|---|---|
| Dashboard | National index, route coverage, freshness, quality, alerts, and current KPIs |
| Airfare Index | Base period, route basket, weights, national trend, and contributions |
| Route Analysis | Search, sort, risk, volatility, export, and route drill-down |
| Route Detail | Fare trend, airline comparison, booking-window curve, and daily movement |
| Airline Analysis | Carrier-level fare, index, range, and volatility comparison |
| Booking Window | Fare behaviour from T+1 through T+45 |
| India Map | Geographic route movements, airports, and regional summary |
| Data Explorer | Filterable and exportable canonical observations |
| Alerts | Price spikes, drops, thresholds, volatility, and quality events |
| Policy Insights | Plain-language interpretation of current indicators |
| Fare State | Comparable snapshot transitions and fare-event measures |
| Data Quality | Integrity checks, coverage, and validation status |
| Methodology | Public explanation of the measurement approach |
| System/API | Pipeline status, processing controls, and endpoint view |
| Audit Log | Session activity and governance visibility |

Shared filters support date ranges, origin, destination, airline, travel class, and booking window. Route tables and observation tables can be exported as CSV for review.

## API Layer

The Express backend exposes the dashboard's operational data and health surface. It reads canonical observations and analytical tables from SQLite, normalizes airline and airport metadata for presentation, and returns route, airline, index, fare-state, alerts, insights, map, and dashboard summaries.

The API layer is intentionally kept separate from the React presentation layer. The frontend communicates through the API client, while the Python calculation modules remain reusable for scheduled processing, diagnostics, and reproducible analysis.

## Repository Structure

```text
.
├── backend/
│   ├── server.js                 Express API and SQLite read layer
│   ├── alert.py                  Alert generation support
│   ├── config/                   Airport, route, and runtime configuration
│   ├── database/                 Connection helpers and schema
│   ├── data_quality/             Validators, scoring, and DQE orchestration
│   ├── fare_state/               Snapshot matching and transition analytics
│   ├── index_engine/             Price relatives, estimators, indices, and inflation
│   ├── normalizers/              Source-to-canonical fare normalization
│   ├── scheduler/                Collection task planning and execution
│   ├── scrapers/                 Source adapters and dispatcher
│   └── storage/                  Observation and collection persistence
├── frontend/
│   ├── src/pages/                Dashboard and analysis workflows
│   ├── src/components/           Shared layout, filters, charts, and UI primitives
│   ├── src/context/              Auth, filters, updates, and notifications
│   └── src/data/                 Frontend types, API client, and formatting helpers
├── requirements.txt              Python dependencies
└── README.md                     Project and methodology documentation
```

## Local Setup

### Requirements

- Node.js 18 or later.
- npm.
- Python 3.10 or later.
- A local SQLite database at `backend/data/apix.db` containing the schema and required observation tables.

The runtime database and generated collection files are intentionally excluded from Git. They should be supplied through the deployment environment or initialized locally before starting the backend.

### Install dependencies

From the project root:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

cd backend
npm install

cd ..\frontend
npm install
```

### Start the backend

```bash
cd backend
npm start
```

The Express server listens on port `4002` by default.

### Start the frontend

In a second terminal:

```bash
cd frontend
npm run dev
```

Vite serves the frontend at `http://localhost:5173` by default. The backend health endpoint is available at `http://localhost:4002/api/health`.

### Frontend commands

```bash
npm run typecheck
npm run lint
npm run build
npm run preview
```

## Demonstration Access

The interface includes role-oriented demonstration accounts:

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@aeroindex.gov.in` | `admin123` |
| Analyst | `analyst@aeroindex.gov.in` | `analyst123` |
| Viewer | `viewer@aeroindex.gov.in` | `viewer123` |

Authentication and audit history are implemented for the demonstration experience. A production deployment should replace these credentials with managed identity, server-side authorization, and durable audit storage.

## Responsible Data Collection

The scraper architecture is designed for permitted sources and controlled collection. Any deployment connected to external airline, OTA, GDS, or licensed feeds must respect applicable terms of service, robots.txt rules, rate limits, API licences, privacy requirements, and data-retention obligations.

## Submission Scope

The Git repository contains the application source, configuration, schema, frontend, calculation modules, and operational documentation required to review the solution. Local databases, raw collection output, generated reports, test modules, diagnostic runners, and superseded standalone methodology files are excluded through `.gitignore`.

This keeps the submission focused on the reproducible product and its core implementation while allowing runtime storage and engineering diagnostics to remain local or deployment-managed.

## Future Production Enhancements

- Deploy permitted source connectors with scheduling, retries, rate limiting, and monitoring.
- Move secrets and credentials to managed configuration.
- Add server-side authentication, authorization, and audit persistence.
- Add versioned methodology and calculation snapshots for each published index.
- Persist quality reports and expose signed provenance for published values.
- Add automated CI for normalization contracts, database migrations, index calculations, and API contracts.
- Add observability for collection latency, source availability, matching coverage, and index confidence.

## License

No license is currently specified for this submission.

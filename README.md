# AeroIndex India

AeroIndex India is a prototype airfare price intelligence platform for monitoring domestic airfares across India. It converts airfare observations into a national price index, route-level analysis, airline comparisons, booking-window insights, alerts, maps, and policy-oriented summaries.

The project is presented as a prototype for **SIH 2026, Problem Statement SIH26056**.

> Important: the current application uses deterministic mock airfare data. It does not scrape live airline or OTA websites.

## What The Project Does

AeroIndex India models the complete flow from airfare observation to decision support:

1. Generate or receive airfare observations.
2. Validate, clean, and deduplicate those observations.
3. Normalize fare components such as base fare, taxes, and fees.
4. Calculate route-level statistics and a weighted national airfare index.
5. Compare routes, airlines, travel classes, and booking windows.
6. Display movements through charts, tables, alerts, and an India map.
7. Present plain-English insights for analysts and policymakers.

The application is a client-side React prototype. Its data source is designed behind a `DataSource` interface so a permitted live API or feed can be connected later.

## Main Technologies

- React 18 with TypeScript
- Vite for development and production builds
- React Router for page navigation
- Tailwind CSS for styling
- Recharts for charts
- React Leaflet and Leaflet for the India route map
- Lucide React for icons
- In-memory deterministic mock data
- Session storage for demo login and audit history

## Getting Started

### Requirements

- Node.js 18 or newer
- npm

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

### Other commands

```bash
npm run typecheck
npm run build
npm run preview
npm run lint
```

`typecheck` validates TypeScript. `build` creates the production bundle. `preview` serves the production build locally. `lint` checks the entire project with ESLint.

## First-Time User Flow

1. Open `/` to see the public landing page.
2. Select **Enter Dashboard** to open the demo login page.
3. Use one of the demo accounts below.
4. After login, the protected dashboard opens at `/dashboard`.
5. Use the desktop sidebar or mobile menu to move between modules.
6. Use **Simulate Update** to append mock observations and refresh the analytics.
7. Select **Logout** from the sidebar or mobile menu to return to the landing page.

## Demo Accounts

| Role | Email | Password | Intended use |
|---|---|---|---|
| Administrator | `admin@aeroindex.gov.in` | `admin123` | Full prototype exploration |
| Analyst | `analyst@aeroindex.gov.in` | `analyst123` | Analytics and exports |
| Viewer | `viewer@aeroindex.gov.in` | `viewer123` | Read-only demonstration |

The current prototype uses these accounts for authentication. The role labels are displayed in the interface, but fine-grained permission enforcement is not yet implemented for every action.

## Navigation And Pages

The protected application uses a fixed desktop sidebar and a collapsible mobile navigation menu. The following pages are available from the side tabs.

### 1. Dashboard

**Path:** `/dashboard`

**Sidebar label:** Dashboard

The Dashboard is the main overview of the platform. It combines the current national airfare situation with the most important route and data-quality signals.

It contains:

- Current Airfare Index, using January 2026 as the base period with a value of 100.
- Monthly index movement compared with the previous month.
- Number of monitored routes.
- Number of monitored airlines.
- Total price observations and the currently filtered observation count.
- Number of high-price routes with a monthly increase greater than 5%.
- Data freshness indicator.
- Data quality percentage and valid-record count.
- A monthly India Airfare Price Index area chart.
- A monthly history table containing index, change percentage, and average fare.
- A Top Monitored Routes table with links to route detail pages.
- A Recent Alerts preview with a link to the complete Alerts page.

The shared filter bar appears here and lets users filter the observation summary by date preset, custom date range, origin, destination, airline, travel class, and booking window.

### 2. Airfare Index

**Path:** `/index`

**Sidebar label:** Airfare Index

This page explains and exposes the national index calculation. It is intended for users who need to understand how the headline number is produced.

It contains:

- A plain-English explanation of route price relatives.
- The January 2026 base-period definition: `January 2026 = 100`.
- A monthly line chart of the composite index.
- A button to show or hide the route basket and weight controls.
- Editable route weights for testing index sensitivity.
- Weight percentage, average fare, route index, and contribution for each route.
- A Reset button that restores the default route weights.
- Monthly index history with month-over-month changes and average fares.

Changing weights recalculates the index in the browser. This is useful for explaining how route importance affects the national result.

### 3. Route Analysis

**Path:** `/routes`

**Sidebar label:** Route Analysis

This page provides a sortable, searchable table for all monitored domestic routes.

Users can:

- Search by city name or airport code.
- Sort by average fare.
- Sort by route index.
- Sort by month-over-month change.
- Sort by year-over-year change.
- Sort by observation count.
- Sort by volatility.
- Review minimum and maximum observed fare.
- Review route risk classification: low, medium, or high.
- Export the currently filtered route table as `route-analysis.csv`.
- Select any row to open the detailed route page.

The table uses directional indicators and color badges to distinguish fare increases, decreases, and stable movements.

#### Route Detail

**Path:** `/routes/:routeId`

This is the drill-down page opened from Route Analysis or selected route links elsewhere in the application.

It contains:

- Route name, airport codes, distance, and route category.
- Current average fare.
- Route airfare index.
- Cheapest and highest observed fares.
- Price volatility.
- Observation count.
- Month-over-month change.
- Median fare.
- Monthly average-fare trend chart.
- Airline comparison bar chart for the selected route.
- Booking-window fare curve for the selected route.
- Daily fare trend chart.
- Back to Routes navigation.

If an unknown route ID is entered, the page shows a route-not-found message and a button back to the route list.

### 4. Airline Analysis

**Path:** `/airlines`

**Sidebar label:** Airline Analysis

This page compares monitored carriers across the domestic network.

Users can:

- Select or deselect individual airlines.
- Compare average and median fare in a bar chart.
- Review a detailed comparison table.
- Compare minimum fare, maximum fare, volatility, observation count, and average index.
- View the national index trend for context.

Airline colors are defined in the project data and are reused in the selectors and charts.

### 5. Booking Window

**Path:** `/booking-window`

**Sidebar label:** Booking Window

This page explains how the observed fare changes according to the number of days between booking and departure.

The available windows are:

- `T+1`: one day before departure
- `T+7`: seven days before departure
- `T+15`: fifteen days before departure
- `T+30`: thirty days before departure
- `T+45`: forty-five days before departure

It contains:

- A definition of the booking-window concept.
- Shared filters for route and airline selection.
- A key insight comparing T+1 and T+45 prices.
- A booking-window versus average-fare line chart.
- A bar-chart comparison of each window.
- A detailed table with average fare and observation count.

The page is designed to show the premium associated with booking closer to departure.

### 6. India Map

**Path:** `/map`

**Sidebar label:** India Map

This page shows the geographic distribution of the monitored airfare network.

It contains:

- A Leaflet map centered on India.
- Airport indicators for monitored airports.
- Route lines connecting origin and destination airports.
- Green lines for decreasing or stable movements.
- Yellow lines for moderate increases.
- Red lines for significant increases.
- Route tooltips showing route name, average fare, and monthly change.
- Airport popups showing city, airport code, state, and region.
- Clickable route lines that open a route summary in the side panel.
- A regional summary counting routes by trend category.

The map uses OpenStreetMap and CARTO tiles. It requires network access to load the map tiles in a browser.

### 7. Data Explorer

**Path:** `/explorer`

**Sidebar label:** Data Explorer

This page exposes the underlying airfare observations instead of only the aggregated results.

Users can:

- Search by observation ID, origin, destination, or airline.
- Filter by origin airport.
- Filter by destination airport.
- Filter by airline.
- Filter by observation status.
- Sort by ID, collection date, route, airline, travel date, booking window, total fare, or status.
- Move through paginated results, with 20 records per page.
- Export the filtered observations as `observations.csv`.

Each row displays collection date, route, airline, travel date, booking window, travel class, total fare, source, and status.

Possible observation statuses are `valid`, `invalid`, `duplicate`, and `pending`.

### 8. Alerts

**Path:** `/alerts`

**Sidebar label:** Alerts

This page lists significant movements detected by the analytics layer.

It contains:

- Counts for high, medium, and low severity alerts.
- Severity filter buttons for All, High, Medium, and Low.
- Alert type labels.
- Alert dates.
- Route information when an alert is route-specific.
- Color-coded alert icons and left borders.

Alert types include price spikes, price drops, index thresholds, volatility, and data-quality events.

### 9. Policy Insights

**Path:** `/insights`

**Sidebar label:** Policy Insights

This page converts calculated metrics into short, plain-English observations.

It contains:

- A prototype-data disclaimer.
- Current national index.
- Monthly movement.
- Route with the highest increase.
- Route with the largest decrease.
- Most volatile route.
- Lowest and highest average-fare routes.
- Cheapest monitored airline.
- Automatically generated key observations grouped by category.
- Booking-window impact comparing fares booked one day and 45 days before departure.

These statements are generated from the mock dataset and should not be treated as official government findings.

### 10. Methodology

**Path:** `/methodology`

**Sidebar label:** Methodology

This page explains how the platform works for non-technical readers. It is also available publicly from the landing page and does not require login.

The explanation is organized into four phases:

1. **Foundation**: the problem, why airfare is difficult to measure, and data collection.
2. **Data Processing**: validation, cleaning, fare normalization, route selection, and index calculation.
3. **Analysis**: route analysis, airline analysis, and booking-window analysis.
4. **Decision Support**: geographic visualization, alerts, policy insights, and future live-data integration.

The page also shows a future production flow from airline or OTA sources through automated collection, validation, database storage, and index calculation. It clearly states that the current prototype does not scrape live sources.

### 11. System/API

**Path:** `/system`

**Sidebar label:** System/API

This page documents and demonstrates the technical architecture behind the application.

It contains:

- The active data source name and whether it is live.
- A visual data pipeline from source to dashboard.
- A **Run Data Processing** button that simulates a processing cycle.
- Counts for collected, processed, duplicate, invalid, and valid records.
- Last update time and data-quality percentage.
- A layered system architecture view.
- Cross-cutting modules such as Alerts, Maps, Policy Insights, and Exports.
- A table of simulated REST API endpoints.

The listed endpoint groups include index, routes, airlines, booking window, observations, alerts, insights, map, and dashboard statistics.

In the current prototype, these endpoints are represented by functions in `src/data/api.ts`. They are not served by a separate HTTP server.

### 12. Audit Log

**Path:** `/audit`

**Sidebar location:** Below the main navigation, with the shield icon

The Audit Log provides session-level governance information.

It contains:

- The current user name, email, and role.
- Descriptions of Administrator, Analyst, and Viewer roles.
- A chronological activity table.
- Login and logout events.
- Action, module, user, and timestamp fields.

Audit entries are stored in browser session storage and are limited to the current browser session. They are not yet stored in a server database.

## Shared Controls And Behavior

### Sidebar navigation

On desktop, the sidebar stays fixed on the left. On smaller screens, the navigation is available through the menu button in the mobile header. The active page is highlighted.

### Simulate Price Update

The **Simulate Price Update** control is available in the sidebar and top bar after login. It appends mock observations, updates the application timestamp, refreshes calculated metrics, and displays a success toast.

### Toast notifications

Toast messages appear for actions such as simulated updates, weight resets, and data-processing runs.

### Filters

The shared filter bar supports:

- Date presets: Today, Last 7 Days, Last 30 Days, Last 3 Months, Last 6 Months, and Custom Range.
- Custom start and end dates.
- Origin airport.
- Destination airport.
- Airline.
- Travel class.
- Booking window.
- Reset to defaults.

Not every page uses every filter. Each page applies the filters relevant to its analysis.

## Data And Analytics

### Mock observations

The mock generator creates deterministic observations from a seeded random process. It models:

- 25 representative domestic routes.
- Major Indian airports and regions.
- Multiple airlines.
- Economy, Premium Economy, and Business travel classes.
- T+1, T+7, T+15, T+30, and T+45 booking windows.
- Base fare, taxes, fees, total fare, source, and status.
- Seasonal and holiday effects.
- Airline, travel-class, route, and booking-window price multipliers.

The generated data covers January 2026 through August 2026 in the current prototype.

### Main calculations

The analytics layer calculates:

- National monthly airfare index.
- Route average, median, minimum, maximum, and volatility.
- Month-over-month and year-over-year movement.
- Route trend and risk classifications.
- Airline fare and index comparisons.
- Booking-window averages.
- Data pipeline quality statistics.
- Alerts and policy insights.

The national index compares route averages with January 2026 base-period averages and combines them using route weights.

## Project Structure

```text
src/
  App.tsx                         Application routes and providers
  main.tsx                        React entrypoint and global imports
  index.css                       Tailwind layers and shared styles
  components/
    Layout.tsx                    Protected app shell and sidebar
    FilterBar.tsx                 Shared analytics filters
    chartFormatters.ts             Chart tooltip formatters
    ui/                           Reusable cards, KPI cards, and toasts
  context/
    AppContext.tsx                Filters, updates, demo mode, and toasts
    AuthContext.tsx               Demo authentication and audit history
  data/
    airlines.ts                   Airline definitions
    airports.ts                   Airport definitions
    analytics.ts                  Aggregation and insight calculations
    api.ts                        In-memory API-style data functions
    datasource.ts                  Mock/live data-source abstraction
    generator.ts                  Deterministic observation generation
    random.ts                     Seeded random values and formatters
    routes.ts                     Monitored route definitions
    types.ts                      Shared TypeScript types
  pages/                          Public, dashboard, analysis, and system pages
public/                            Static assets
```

## Data Source Architecture

The `DataSource` interface defines two operations:

- `fetchObservations()` for retrieving observations.
- `simulateUpdate(count)` for update simulation.

The current implementation is `MockAirfareDataSource`. A `LiveAirfareDataSource` placeholder is included for future integration, but it intentionally throws an error until a permitted source is configured.

Any future live integration must follow applicable website terms, robots.txt rules, rate limits, API licensing, privacy requirements, and ethical data-collection practices.

## Important Prototype Limitations

- Data is generated in memory and is not persistent.
- The live data source is not configured.
- The API endpoint list is documentation for a future backend, not an active HTTP API.
- Authentication is demo-only and uses hard-coded accounts.
- Role-based access restrictions are not fully enforced.
- Audit history is stored only in session storage.
- Map tiles require external network access.
- CSV export is generated in the browser.
- The displayed analytics are for demonstration and must not be interpreted as official statistics.

## Production Direction

A production implementation could add:

- Permitted airline, OTA, GDS, or licensed API connectors.
- A backend service and persistent normalized database.
- Scheduled collection jobs and monitoring.
- Real authentication and role-based authorization.
- Server-side audit logs.
- API pagination, caching, rate limiting, and validation.
- Versioned index methodology and reproducible calculation snapshots.
- Automated tests for data quality, calculations, exports, and access control.

## License

No license is currently specified for this prototype.

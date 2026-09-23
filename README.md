<div align="center">

# ✈️ AeroIndex India (VayuYaan)
### Real-Time National Airfare Price Index & Algorithmic Tariff Surveillance Platform

[![SIH 2026](https://img.shields.io/badge/Smart%20India%20Hackathon-2026%20Finalist-FF9933?style=for-the-badge&logo=target)](https://sih.gov.in)
[![Problem Statement](https://img.shields.io/badge/Problem%20Statement-SIH26056-138808?style=for-the-badge)](https://sih.gov.in)
[![Ministry](https://img.shields.io/badge/Ministry-MoSPI%20%26%20DGCA-000080?style=for-the-badge)](https://www.mospi.gov.in/)
[![Live App](https://img.shields.io/badge/Live%20Console-vayuyaan--india.vercel.app-blueviolet?style=for-the-badge&logo=vercel)](https://vayuyaan-india.vercel.app/)
[![Dataset](https://img.shields.io/badge/HuggingFace%20Dataset-aeroindex--db-FFD21E?style=for-the-badge&logo=huggingface)](https://huggingface.co/datasets/amashtce/aeroindex-db)

<br/>

**A mathematically robust, automated, end-to-end airfare intelligence pipeline designed to replace manual airfare sampling in India's Consumer Price Index (CPI) with high-frequency observations, advance booking window curves, and statutory tariff surveillance under DGCA Rule 135(2).**

<br/>

[🚀 **Access Live Production Web App**](https://vayuyaan-india.vercel.app/) • [📂 **GitHub Repository**](https://github.com/syedamashs/Aeroindex-India) • [📊 **Automated Database Hub**](https://huggingface.co/datasets/amashtce/aeroindex-db) • [📑 **Solution Architecture & Deck**](./vimaan-airfare-index-main/26RBU142_SIH26056_BharatBytes.pdf)

---

</div>

## 📌 Executive Summary & Hackathon Context

| Parameter | Details |
|---|---|
| **Event** | **Smart India Hackathon (SIH 2026)** |
| **Problem Statement ID** | **SIH26056** |
| **Theme / Category** | Smart Automation / E-Governance / National Economic Indicators |
| **Nodal Ministries / Stakeholders** | **Ministry of Statistics and Programme Implementation (MoSPI)** & **Directorate General of Civil Aviation (DGCA)** |
| **Live Deployed Web App** | **[https://vayuyaan-india.vercel.app/](https://vayuyaan-india.vercel.app/)** |
| **Team / Project Identifier** | **T_Humble Hackers** |
| **Codebase Repository** | [https://github.com/syedamashs/Aeroindex-India](https://github.com/syedamashs/Aeroindex-India) |

---

## 🎯 The Core Problem & Motivation

### Why India's Present Airfare CPI Measurement Fails

In India's official Consumer Price Index (CPI 2024 basket), **Transport and Communication accounts for 9.43%** of the consumer weight. Yet, the airfare sub-component is compiled using an antiquated manual process:

1. **Severe Under-sampling**: The DGCA Tariff Monitoring Unit manually checks fares for only **78 selected routes once a month**.
2. **Dynamic Pricing Blindness**: In modern civil aviation, airlines employ automated revenue management algorithms. A single route does not possess "one price"—its price varies drastically across **booking lead times ($T+1, T+7, T+15, T+30, T+45$)**, carriers, time of departure, baggage allowances, and cabin tiers.
3. **Publication Lag of ~60 Days**: Hand-collected fare quotes reach MoSPI and the Central Statistics Office approximately two months after flight completion, making real-time monetary policy analysis impossible.
4. **Zero Regulatory Surveillance**: The Ministry and DGCA lack automated, real-time alerts to enforce **Rule 135(2) of the Aircraft Rules, 1937** (which mandates that airfares must have reasonable relation to cost of operation, reasonable profit, and prevailing market conditions, prohibiting predatory or surge price-gouging).

### The AeroIndex (VayuYaan) Solution

| Capability | Current MoSPI / DGCA Method | AeroIndex India (VayuYaan) |
|---|---|---|
| **Route Coverage** | 78 domestic routes | **500+ domestic city-pair corridors** across all Tier-1, 2, and 3 airports |
| **Sampling Frequency** | Once a month (manual check) | **High-frequency automated daily runs** |
| **Observation Volume** | ~78 data points/month | **1,440+ verified fare observations per route/month** |
| **Lead-Time Decomposition** | Single arbitrary spot check | **5 Distinct Advance Windows**: $T+1, T+7, T+15, T+30, T+45$ |
| **Statistical Estimator** | Naive arithmetic average (upward biased) | **Route-Weighted Jevons Index** (chain-drift proof, multilateral GEKS verified) |
| **Publication Lag** | ~60 days publication delay | **Same-day real-time index computation & dashboard refresh** |
| **Data Quality Verification** | Ad-hoc manual transcription | **Automated 9-Layer Data Quality Engine (DQE)** with 98.4%+ verification rate |
| **Regulatory Alerts** | Retrospective passenger complaints | **Real-time DGCA Rule 135(2) surge and predatory pricing detection** |
| **AI Decision Support** | None | **AeroBot**: Gemini 2.5 Flash GenAI assistant with live database context injection |

---

## ⚡ Key Platform Capabilities & Innovations

```text
 ┌────────────────────────────────────────────────────────────────────────────────┐
 │                              AEROINDEX INDIA                                   │
 ├────────────────────────────────────────────────────────────────────────────────┤
 │  🌐 LIVE FRONTEND (Vercel)            │  ⚡ BACKEND & CALCULATION ENGINE       │
 │  https://vayuyaan-india.vercel.app/   │  Node.js (Node 22) + Python Core       │
 ├───────────────────────────────────────┴────────────────────────────────────────┤
 │  🤖 AEROBOT: Google Gemini 2.5 Flash In-App AI Policy Analyst                  │
 │  🛡️ DQE: 9-Layer Automated Data Quality & Arithmetic Validation (98.4%+)        │
 │  📊 INDEX ENGINE: Jevons Geometric Mean, Laspeyres, Paasche, Fisher & GEKS     │
 │  🗺️ GEOSPATIAL MAP: Leaflet Interactive Flight Corridor Route Network          │
 │  👁️ LIVE VIEWPORT: Real-Time Playwright Browser Scraping Stream in Web UI       │
 │  ⚖️ DGCA COMPLIANCE: Statutory Rule 135(2) Anti-Surge Surveillance              │
 └────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Headline National Airfare Index Engine
- **Base Period**: Declared base January 2026 = 100.0.
- **Elementary Aggregator**: Chained Jevons Geometric Mean ($\ln J_t = \frac{1}{n} \sum \ln r_{i,t}$) adhering to UN and IMF Consumer Price Index Manual guidelines. Prevents sample churn and extreme ticket outliers from distorting national inflation indicators.
- **Passenger Traffic Basket Weighting**: Aggregated using DGCA city-pair traffic volumes ($W_r$) ensuring high-density trunks (DEL-BOM, BLR-DEL) and regional connectivity routes (UDAN) receive precise economic representation.
- **Robustness Triangulation**: Live cross-verification with Laspeyres, Paasche, and Fisher ideal indices.

### 2. AeroBot — Gemini 2.5 Flash AI Intelligence Assistant
- Deeply integrated conversational intelligence powered by Google's **Gemini 2.5 Flash**.
- Injects live database context (current national index level, MoM/YoY inflation rate, monitored corridor counts, active airlines, top surge routes, and DQE integrity rates) directly into prompt synthesis.
- Answers regulatory inquiries regarding **Rule 135(2) of the Aircraft Rules, 1937**, dynamic pricing surge multipliers, and statistical methodology in natural language.

### 3. Data Quality Engine (DQE) & Reliability Control Center
- Automated 9-tier gatekeeper that guarantees zero corrupted observations enter the index calculation:
  - **Schema Validation**: Mandatory fields, data typing, and null safety.
  - **Arithmetic Audit**: Enforces $Total Fare = Base Fare + Taxes + Other Fees$.
  - **Temporal Integrity**: Ensures departure timestamp > collection timestamp and validates $T+N$ advance purchase windows.
  - **Duplicate De-duplication**: Filters identical carrier, flight number, fare-family, and seat availability matches within the same epoch.
  - **Sold-Out vs Missing Fares**: Explicitly isolates zero-inventory states for capacity utilization analytics rather than treating them as zero prices.
  - **Extreme Outlier Detection**: Flags fares exceeding $5\sigma$ deviation within comparable route buckets.

### 4. Advance Purchase Window Curve Decomposition
- Keeps advance purchase windows rigorously separated to study booking behavior without mixing un-comparable seats:
  - **$T+1$**: Last-minute distress/business traveler fares (highest surge volatility).
  - **$T+7$**: One-week tactical pricing.
  - **$T+15$**: Mid-range leisure booking.
  - **$T+30$**: Standard advance planning.
  - **$T+45$**: Baseline early-bird capacity opening.

### 5. Live Browser Scraping Engine & Viewport Streaming
- Headless **Playwright / Chromium** scrapers with source-specific resilience adapters for **IndiGo (6E)**, **Air India (AI)**, and **SpiceJet (SG)**.
- **Live Scraper Modal**: Operators can watch the real-time browser canvas directly inside the web UI as the bot solves navigation flows, selects departure dates, and harvests fare matrices.

### 6. Interactive Geospatial Flight Corridor Map
- Full-screen **Leaflet & React-Leaflet** interactive visualizer of the Indian domestic airspace.
- Renders bidirectional routes between all major metro airports (DEL, BOM, BLR, MAA, CCU, HYD) and regional nodes.
- Corridors color-coded by real-time fare surge and price-volatility index.

---

## 🏛️ End-to-End System Architecture

```mermaid
flowchart TD
    subgraph S1["1. Collection & Web Scraper Layer"]
        A1["IndiGo Adapter (6E)"]
        A2["Air India Adapter (AI)"]
        A3["SpiceJet Adapter (SG)"]
        PV["Playwright Headless Browser & Live UI Viewport Frame Stream"]
        A1 --> PV
        A2 --> PV
        A3 --> PV
    end

    subgraph S2["2. Ingestion & Normalization"]
        RAW[("Raw Scrape Responses Store")]
        NORM["Canonical Normalizer Contract (apix_observations)"]
        PV --> RAW
        RAW --> NORM
    end

    subgraph S3["3. Governance & Quality Gate (DQE)"]
        DQE{"9-Layer Data Quality Engine"}
        VAL1["Arithmetic Audit: Base + Taxes + Fees == Total"]
        VAL2["Temporal & Lead-Time Boundary Check (T+1 to T+45)"]
        VAL3["Duplicate & Outlier Detection"]
        NORM --> DQE
        DQE --> VAL1
        DQE --> VAL2
        DQE --> VAL3
    end

    subgraph S4["4. Persistence & Cloud Storage"]
        SQLITE[("Canonical SQLite Database (apix.db)")]
        HF[("Hugging Face Hub: amashtce/aeroindex-db")]
        VAL1 --> SQLITE
        VAL2 --> SQLITE
        VAL3 --> SQLITE
        SQLITE <-->|Bi-directional Sync| HF
    end

    subgraph S5["5. Mathematical Index & Analytics Engine"]
        REL["Elementary Price Relatives (r_it)"]
        JEV["Logarithmic Jevons Geometric Mean (ln J_t)"]
        DGCA["DGCA Passenger Volume Basket Weighting (W_r)"]
        NAT["National AeroIndex Aggregation"]
        TRANS["Fare-State Transition Matrix (FEP)"]
        SQLITE --> REL
        REL --> JEV
        JEV --> DGCA
        DGCA --> NAT
        SQLITE --> TRANS
    end

    subgraph S6["6. Application Server"]
        API["Node.js / Express REST API (Port 4002)"]
        CHAT_PROXY["Gemini 2.5 Flash Proxy & Context Injector"]
        NAT --> API
        TRANS --> API
        API --> CHAT_PROXY
    end

    subgraph S7["7. User Interface & Intelligence Console"]
        UI["React 18 + Vite + TypeScript Dashboard"]
        VAP["Live Deployment: vayuyaan-india.vercel.app"]
        BOT["AeroBot AI Policy Assistant"]
        MAP["Interactive Leaflet Air Corridor Map"]
        API --> UI
        CHAT_PROXY --> BOT
        UI --> VAP
        UI --> MAP
    end
```

---

## 📐 Mathematical & Statistical Methodology

The AeroIndex measurement methodology implements the international guidelines laid out in the **ILO/IMF/OECD Consumer Price Index Manual** to eradicate chain drift and substitution bias.

### 1. Eligible Price Observations & Relatives
For any flight observation to enter index calculation, it must possess a confirmed positive finite consumer fare $p_{i,t} > 0$, strict route direction ($DEL \rightarrow BOM \neq BOM \rightarrow DEL$), and a matched counterpart in the adjacent base or reference period $t-1$:

$$r_{i,t} = \frac{p_{i,t}}{p_{i,t-1}}$$

### 2. Jevons Primary Elementary Aggregate
To calculate the unweighted price relative across $n$ comparable flight quotes within a route-direction-leadtime cell, AeroIndex uses the **Jevons Geometric Mean**:

$$J_t = \left(\prod_{i=1}^{n} r_{i,t}\right)^{1/n} = \exp\left(\frac{1}{n} \sum_{i=1}^{n} \ln r_{i,t}\right)$$

> **Why Jevons?** Arithmetic formulations (like the Carli index) suffer from upward bias and fail the time-reversal test. Under price bouncing (typical in dynamic airline pricing), Jevons exhibits zero chain drift.

### 3. Route Index Chaining
Each directional route $r$, lead-time window $b$, and period $t$ is chained sequentially from the declared base period ($I_{r,b,0} = 100.0$):

$$I_{r,b,t} = I_{r,b,t-1} \times J_{r,b,t}$$

### 4. Route-Weighted National AeroIndex ($APIx_t$)
The national headline indicator aggregates individual route indices using historical DGCA passenger traffic volume weights $W_r$:

$$APIx_t = \frac{\sum_{r \in R_t} W_r \cdot I_{r,t}}{\sum_{r \in R_t} W_r}$$

Where $R_t$ is the active set of routes meeting minimum sample size thresholds. If a route has insufficient data in period $t$, it is excluded from $R_t$ and its weight is re-allocated proportionally, avoiding artificial zero-price distortions.

### 5. Multi-Estimator Robustness Triangulation
When base-period quantities ($q_0$) and current quantities ($q_t$) are modeled, the platform computes:

$$\text{Laspeyres}: L_t = \frac{\sum p_t q_0}{\sum p_0 q_0}, \quad \text{Paasche}: P_t = \frac{\sum p_t q_t}{\sum p_0 q_t}, \quad \text{Fisher Ideal}: F_t = \sqrt{L_t \cdot P_t}$$

### 6. Inflation Rate Formulations
- **Month-over-Month (MoM)**:

$$MoM_t = \left(\frac{APIx_t}{APIx_{t-1}} - 1\right) \times 100$$

- **Year-over-Year (YoY)**:

$$YoY_t = \left(\frac{APIx_t}{APIx_{t-12}} - 1\right) \times 100$$

---

## 🔑 Role-Based Access Control (RBAC) & Test Accounts

Evaluators and hackathon judges can log into the live console at **[https://vayuyaan-india.vercel.app/](https://vayuyaan-india.vercel.app/)** using the following role-based profiles:

| Role | Email | Password | Permissions & Scope |
|---|---|---|---|
| **Administrator** | `admin@aeroindex.gov.in` | `admin123` | Full system access: Live scraper execution, database sync, threshold tuning, and audit logs |
| **Analyst** | `analyst@aeroindex.gov.in` | `analyst123` | Data explorer, export CSV, index engine, route drill-downs, and policy insight briefs |
| **Viewer** | `viewer@aeroindex.gov.in` | `viewer123` | Read-only national index dashboards, India map, and public methodology pages |

---

## 💻 Step-by-Step Local Setup & Execution Guide

### Prerequisites
- **Node.js**: `v22.5.0` or higher (uses native `node:sqlite`).
- **Python**: `v3.10` or higher.
- **npm**: `v10+`.
- **Git**.

### 1. Clone the Repository
```bash
git clone https://github.com/syedamashs/Aeroindex-India.git
cd Aeroindex-India
```

### 2. Backend Setup & Automated Database Sync
The backend comes equipped with an automated database synchronizer (`download_db.py`). You do **not** need to manually generate or hunt for SQLite files—it automatically downloads the latest verified dataset directly from Hugging Face!

```bash
# Navigate to backend directory
cd backend

# Create virtual environment and install python dependencies
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
python -m playwright install chromium

# Install Node dependencies
npm install

# Start the Express API server (port 4002)
# This will automatically trigger download_db.py and verify apix.db!
npm start
```
*The backend server will launch at `http://localhost:4002`.* Verify via `http://localhost:4002/api/health`.

### 3. Frontend Setup
In a separate terminal window:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# (Optional) Create .env from template
cp .env.example .env

# Start Vite development server
npm run dev
```
*The React application will be accessible at `http://localhost:5173`.*

---

## 🌐 Environment Variables Configuration

### Backend (`backend/.env`)
```env
PORT=4002
APIX_HEADLESS=true
APIX_BROWSER_TIMEOUT_MS=120000
APIX_DB_PATH=./data/apix.db
GEMINI_API_KEY=your_gemini_api_key_here
HF_TOKEN=your_huggingface_write_token_optional
```

### Frontend (`frontend/.env`)
```env
VITE_API_BASE=http://localhost:4002
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```
*(On the live production Vercel deployment, `VITE_API_BASE` points to the hosted API service, and requests are gracefully proxied).*

---

## 🛠️ REST API Specification

The Express backend exposes a comprehensive set of REST endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status, database connection, and system timestamp |
| `GET` | `/api/index` | Headline National Airfare Index series, base periods, and basket contributions |
| `GET` | `/api/routes` | All monitored corridors with average fares, volatility, and MoM price relative |
| `GET` | `/api/routes/:routeId` | Route drill-down: historical trend, airline price dispersion, and booking curves |
| `GET` | `/api/airlines` | Carrier metrics (IndiGo, Air India, SpiceJet, Akasa) with market shares |
| `GET` | `/api/booking-window` | Lead-time price curves ($T+1$ through $T+45$) across domestic markets |
| `GET` | `/api/map` | Geospatial nodes, airport coordinates, passenger volume weights, and routes |
| `GET` | `/api/observations` | Filterable canonical observation records (paginated, with CSV export) |
| `GET` | `/api/alerts` | Anomaly feed: dynamic pricing surges, sharp drops, and volatility breaches |
| `GET` | `/api/insights` | Policy interpretations and DGCA Rule 135(2) compliance briefs |
| `GET` | `/api/dqe/summary` | Real-time Data Quality Engine metrics, rejection logs, and integrity rates |
| `GET` | `/api/fare-state/summary` | Matched-run fare transitions and Fare Event Probability (FEP) |
| `POST` | `/api/chat` | AeroBot conversational endpoint with Gemini 2.5 Flash context injection |
| `POST` | `/api/login` | Role-based authentication endpoint returning JWT-compatible session token |
| `POST` | `/api/scheduler/run` | Triggers on-demand Playwright scraper collection task |
| `GET` | `/api/scheduler/progress`| Real-time task progress, extracted flight count, and active airline |
| `GET` | `/api/scheduler/preview` | Live base64 JPEG screenshot stream from the active Playwright browser |
| `ALL` | `/api/db/sync` | Force refreshes `apix.db` from the official Hugging Face dataset repository |

---

## 🗂️ Project Directory Structure

```text
Aeroindex/
├── backend/
│   ├── config/                     Airport, route, and runtime configurations
│   ├── data/                       Local SQLite storage (apix.db - auto-fetched)
│   ├── database/                   Database connection helpers and DDL schemas
│   ├── data_quality/               9-tier Data Quality Engine (DQE) validators
│   ├── download_db.py              Automated Hugging Face SQLite dataset downloader
│   ├── fare_state/                 Matched-run transition matrix & FEP analysis
│   ├── index_engine/               Statistical index estimators (Jevons, Laspeyres, Fisher)
│   ├── normalizers/                Source-to-canonical schema normalizers
│   ├── scheduler/                  Collection task planning and scraper dispatcher
│   ├── scrapers/                   Playwright browser scrapers (6E, AI, SG) with live viewport
│   ├── upload_db.py                Automated dataset uploader to Hugging Face
│   ├── server.js                   Express REST API server & database read layer
│   ├── package.json                Node.js backend dependencies & scripts
│   └── requirements.txt            Python dependencies (playwright, pandas, etc.)
│
├── frontend/
│   ├── public/                     Static brand assets, icons, and logos
│   ├── src/
│   │   ├── components/             Shared UI components, navigation, modals, ticker tape
│   │   ├── context/                Authentication, date filters, alerts, and theme context
│   │   ├── data/                   Type interfaces, mock fallback data, and API clients
│   │   ├── lib/
│   │   │   ├── api.ts              Axios/Fetch REST API connector to backend
│   │   │   └── gemini.ts           Google Gemini 2.5 Flash SDK client for AeroBot
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx     Public SIH 2026 landing and presentation portal
│   │   │   ├── DashboardPage.tsx   Executive National Airfare Index command center
│   │   │   ├── IndexPage.tsx       Detailed index methodology and basket weight breakdown
│   │   │   ├── RoutesPage.tsx      Corridor comparison table with volatility rankings
│   │   │   ├── RouteDetailPage.tsx Granular single-route drill-down and booking curves
│   │   │   ├── AirlinesPage.tsx    Carrier price dispersion and market share metrics
│   │   │   ├── BookingWindowPage.tsx Advance booking curves (T+1 to T+45)
│   │   │   ├── MapPage.tsx         Interactive Leaflet geospatial Indian airspace map
│   │   │   ├── DataExplorerPage.tsx Filterable canonical observations with CSV export
│   │   │   ├── AlertsPage.tsx      Regulatory surge and anomaly detection feed
│   │   │   ├── InsightsPage.tsx    Plain-language policy and economic briefs
│   │   │   ├── FareStatePage.tsx   Snapshot transition matrix and event probability
│   │   │   ├── DqePage.tsx         Data Quality Engine control center and audit status
│   │   │   ├── MethodologyPage.tsx Public mathematical documentation and formulas
│   │   │   ├── SystemPage.tsx      Live scraper console & browser viewport stream
│   │   │   ├── AuditLogPage.tsx    Governance action trail and session activity logs
│   │   │   └── LoginPage.tsx       Role-based login authentication view
│   │   ├── App.tsx                 Top-level routing, query providers, and layout wrapper
│   │   └── index.css               Tailwind CSS custom styling tokens & animations
│   ├── package.json                Frontend dependencies (React 18, Vite, Lucide, Recharts)
│   ├── tailwind.config.js          Tailwind design system configuration
│   └── vercel.json                 Vercel single-page application (SPA) rewrite rules
│
├── vimaan-airfare-index-main/      Official SIH submission deck (PPTX/PDF) & research documents
├── RENDER.md                       Cloud backend deployment guide for Render
├── vercel.json                     Root deployment configuration
└── README.md                       Comprehensive SIH 2026 submission documentation
```

---

## 🏆 Smart India Hackathon (SIH 2026) Evaluation Alignment

| Evaluation Criteria | How AeroIndex (VayuYaan) Excels |
|---|---|
| **Novelty & Innovation** | First platform in India to introduce **high-frequency web scraping for official national statistics**, replacing a 60-day manual process with real-time SDMX-compatible price indices and live browser scraper streaming. |
| **Statistical & Technical Rigor** | Uses **chain-drift resistant Jevons geometric estimators** combined with **DGCA passenger volume weighting**, completely avoiding the upward bias plaguing ordinary arithmetic averages. Cross-validated against Laspeyres, Paasche, and Fisher models. |
| **Data Quality & Integrity (DQE)** | Implements a strict **9-layer automated validation engine** enforcing arithmetic balance ($Base + Taxes + Fees = Total$), temporal sanity, and duplicate prevention with a verified 98.4%+ data health score. |
| **Statutory & Policy Impact** | Empowers the **Ministry of Civil Aviation and DGCA** to proactively enforce **Rule 135(2) of the Aircraft Rules, 1937**, detecting predatory fare drops and gouging surges during peak holiday travel. |
| **Generative AI Integration** | Features **AeroBot (Gemini 2.5 Flash)** with dynamic database context injection, allowing non-technical policymakers to ask plain-language questions and receive cited, data-backed answers. |
| **Production Readiness & UX** | Fully functional and live at **[https://vayuyaan-india.vercel.app/](https://vayuyaan-india.vercel.app/)** with responsive layouts, accessible dark/light modes, role-based security, interactive maps, and automated cloud dataset syncing. |

---

## 👥 Team & Submission Information

- **Submission Team**: T_Humble Hackers (SIH 2026)
- **Problem Statement**: SIH26056
- **Lead Developer & Contributor**: Syed Amash ([@syedamashs](https://github.com/syedamashs))
- **Primary Repository**: [https://github.com/syedamashs/Aeroindex-India](https://github.com/syedamashs/Aeroindex-India)
- **Live Vercel Application**: [https://vayuyaan-india.vercel.app/](https://vayuyaan-india.vercel.app/)
- **Hugging Face Dataset Hub**: [https://huggingface.co/datasets/amashtce/aeroindex-db](https://huggingface.co/datasets/amashtce/aeroindex-db)

---

<div align="center">

**Built with dedication for Smart India Hackathon 2026 • Empowering Data-Driven Governance in Indian Civil Aviation**

</div>

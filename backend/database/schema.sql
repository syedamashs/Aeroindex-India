PRAGMA foreign_keys = ON;

-- ============================================================
-- APIx DATABASE SCHEMA
-- Real-time Airfare Price Index for India
-- ============================================================


-- ============================================================
-- 1. REFERENCE DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS dgca_route_master (
    route_id TEXT PRIMARY KEY,
    rank INTEGER NOT NULL,
    city1 TEXT NOT NULL,
    city2 TEXT NOT NULL,
    route_traffic INTEGER NOT NULL,
    route_weight_pct REAL NOT NULL,
    cumulative_coverage_pct REAL NOT NULL,
    source_document TEXT,
    source_year TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS apix_route_basket (
    route_id TEXT PRIMARY KEY,
    basket_rank INTEGER NOT NULL,
    route_weight_pct REAL NOT NULL,
    cumulative_coverage_pct REAL NOT NULL,
    is_core_route INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (route_id)
        REFERENCES dgca_route_master(route_id)
);


CREATE TABLE IF NOT EXISTS airport_city_master (
    airport_code TEXT PRIMARY KEY,
    airport_name TEXT NOT NULL,
    city_name TEXT NOT NULL,
    market_name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 2. COLLECTION MANAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS collection_runs (
    run_id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL,
    total_tasks INTEGER NOT NULL DEFAULT 0,
    successful_tasks INTEGER NOT NULL DEFAULT 0,
    failed_tasks INTEGER NOT NULL DEFAULT 0,
    notes TEXT
);


CREATE TABLE IF NOT EXISTS collection_tasks (
    task_id TEXT PRIMARY KEY,

    run_id TEXT NOT NULL,

    route_id TEXT NOT NULL,

    source TEXT NOT NULL,

    origin TEXT NOT NULL,
    destination TEXT NOT NULL,

    departure_date TEXT NOT NULL,

    target_lead_days INTEGER NOT NULL,

    actual_lead_days INTEGER,

    status TEXT NOT NULL DEFAULT 'pending',

    started_at TEXT,
    completed_at TEXT,

    attempts INTEGER NOT NULL DEFAULT 0,

    error_type TEXT,
    error_message TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (run_id)
        REFERENCES collection_runs(run_id),

    FOREIGN KEY (route_id)
        REFERENCES dgca_route_master(route_id)
);


-- ============================================================
-- 3. RAW SCRAPER RESPONSES
-- ============================================================

CREATE TABLE IF NOT EXISTS raw_scrape_responses (
    raw_response_id TEXT PRIMARY KEY,

    run_id TEXT NOT NULL,
    task_id TEXT NOT NULL,

    source TEXT NOT NULL,

    source_url TEXT,

    search_timestamp TEXT NOT NULL,

    origin TEXT,
    destination TEXT,

    departure_date TEXT,

    http_status INTEGER,

    content_type TEXT,

    response_size_bytes INTEGER,

    storage_path TEXT NOT NULL,

    sha256_hash TEXT,

    extraction_status TEXT NOT NULL DEFAULT 'success',

    error_message TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (run_id)
        REFERENCES collection_runs(run_id),

    FOREIGN KEY (task_id)
        REFERENCES collection_tasks(task_id)
);


-- ============================================================
-- 4. CANONICAL APIx OBSERVATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS apix_observations (

    observation_id TEXT PRIMARY KEY,

    source TEXT NOT NULL,

    source_url TEXT,

    search_timestamp TEXT NOT NULL,

    extraction_status TEXT NOT NULL,

    currency TEXT,

    origin TEXT NOT NULL,
    destination TEXT NOT NULL,

    origin_city TEXT,
    destination_city TEXT,

    departure_datetime TEXT,
    arrival_datetime TEXT,

    departure_utc TEXT,
    arrival_utc TEXT,

    duration_minutes INTEGER,

    flight_number TEXT,

    carrier_code TEXT,

    marketing_airline TEXT,
    operating_airline TEXT,

    flight_id TEXT,

    journey_id TEXT,

    aircraft_code TEXT,

    stops INTEGER,

    flight_type TEXT,

    departure_terminal TEXT,
    arrival_terminal TEXT,

    code_share_indicator TEXT,

    schedule_service_type TEXT,

    fare_product_class TEXT,

    fare_class TEXT,

    fare_family TEXT,

    source_offer_id TEXT,

    fare_availability_key TEXT,

    base_fare REAL,

    taxes REAL,

    total_fees REAL,

    total_fare REAL,

    is_cheapest_offer INTEGER,

    is_sold INTEGER,

    filling_fast INTEGER,

    service_charges TEXT,

    original_fare_amount REAL,

    original_published_amount REAL,

    original_total_discount REAL,

    passenger_type TEXT,

    -- Collection provenance
    run_id TEXT,

    task_id TEXT,

    route_id TEXT,

    target_lead_days INTEGER,

    actual_lead_days INTEGER,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (run_id)
        REFERENCES collection_runs(run_id),

    FOREIGN KEY (task_id)
        REFERENCES collection_tasks(task_id),

    FOREIGN KEY (route_id)
        REFERENCES dgca_route_master(route_id)
);


-- ============================================================
-- 5. AIR INDIA SOURCE-SPECIFIC DETAILS
-- ============================================================

CREATE TABLE IF NOT EXISTS airindia_details (

    observation_id TEXT PRIMARY KEY,

    air_bound_id TEXT,

    air_offer_id TEXT,

    fare_info_id TEXT,

    fare_family_hierarchy INTEGER,

    commercial_fare_family TEXT,

    fare_type TEXT,

    booking_class TEXT,

    quota TEXT,

    status_code TEXT,

    baggage_kg REAL,

    change_fee REAL,

    cancel_refund_fee REAL,

    service_ids TEXT,

    raw_fare_payload TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (observation_id)
        REFERENCES apix_observations(observation_id)
        ON DELETE CASCADE
);


-- ============================================================
-- 6. INDIGO SOURCE-SPECIFIC DETAILS
-- ============================================================

CREATE TABLE IF NOT EXISTS indigo_details (

    observation_id TEXT PRIMARY KEY,

    product_class TEXT,

    fare_availability_key TEXT,

    fare_class TEXT,

    passenger_fare_index INTEGER,

    total_fare_amount REAL,

    total_publish_fare REAL,

    total_tax REAL,

    service_charges_json TEXT,

    journey_key TEXT,

    segment_count INTEGER,

    raw_fare_payload TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (observation_id)
        REFERENCES apix_observations(observation_id)
        ON DELETE CASCADE
);


-- ============================================================
-- 7. SPICEJET SOURCE-SPECIFIC DETAILS
-- ============================================================

CREATE TABLE IF NOT EXISTS spicejet_details (

    observation_id TEXT PRIMARY KEY,

    fare_code TEXT,

    class_of_service TEXT,

    fare_sequence TEXT,

    fare_status TEXT,

    segment_key TEXT,

    operating_flight_number TEXT,

    capacity INTEGER,

    adjusted_capacity INTEGER,

    sold INTEGER,

    unit_sold INTEGER,

    lid TEXT,

    prbc_code TEXT,

    ticket_codes TEXT,

    travel_class_code TEXT,

    raw_fare_payload TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (observation_id)
        REFERENCES apix_observations(observation_id)
        ON DELETE CASCADE
);


-- ============================================================
-- 8. FARE-STATE SNAPSHOTS
-- ============================================================

CREATE TABLE IF NOT EXISTS fare_state_snapshots (

    snapshot_id TEXT PRIMARY KEY,

    observation_id TEXT NOT NULL,

    snapshot_timestamp TEXT NOT NULL,

    route_id TEXT NOT NULL,

    origin TEXT NOT NULL,
    destination TEXT NOT NULL,

    departure_datetime TEXT NOT NULL,

    flight_id TEXT,

    journey_id TEXT,

    flight_number TEXT,

    carrier_code TEXT,

    cabin TEXT,

    fare_family TEXT,

    fare_class TEXT,

    fare_product_class TEXT,

    total_fare REAL,

    fare_rank INTEGER,

    availability_status TEXT,

    state_label TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (observation_id)
        REFERENCES apix_observations(observation_id)
        ON DELETE CASCADE,

    FOREIGN KEY (route_id)
        REFERENCES dgca_route_master(route_id)
);


-- ============================================================
-- 9. FARE-STATE TRANSITIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS fare_state_transitions (

    transition_id TEXT PRIMARY KEY,

    route_id TEXT NOT NULL,

    flight_id TEXT,

    journey_id TEXT,

    flight_number TEXT,

    carrier_code TEXT,

    departure_datetime TEXT NOT NULL,

    from_snapshot_id TEXT NOT NULL,

    to_snapshot_id TEXT NOT NULL,

    from_state TEXT,

    to_state TEXT,

    from_fare REAL,

    to_fare REAL,

    fare_change REAL,

    fare_change_pct REAL,

    state_direction TEXT,

    transition_timestamp TEXT NOT NULL,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (route_id)
        REFERENCES dgca_route_master(route_id),

    FOREIGN KEY (from_snapshot_id)
        REFERENCES fare_state_snapshots(snapshot_id),

    FOREIGN KEY (to_snapshot_id)
        REFERENCES fare_state_snapshots(snapshot_id)
);


-- ============================================================
-- 10. CROSS-SOURCE FARE MATCHING
-- ============================================================

CREATE TABLE IF NOT EXISTS cross_source_matches (

    match_id TEXT PRIMARY KEY,

    observation_id_a TEXT NOT NULL,
    observation_id_b TEXT NOT NULL,

    source_a TEXT NOT NULL,
    source_b TEXT NOT NULL,

    match_timestamp TEXT NOT NULL,

    match_method TEXT,

    match_confidence REAL,

    same_route INTEGER,
    same_departure INTEGER,
    same_flight INTEGER,
    same_cabin INTEGER,
    same_fare_family INTEGER,
    same_fare_class INTEGER,

    fare_a REAL,
    fare_b REAL,

    fare_difference REAL,
    fare_difference_pct REAL,

    match_status TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (observation_id_a)
        REFERENCES apix_observations(observation_id)
        ON DELETE CASCADE,

    FOREIGN KEY (observation_id_b)
        REFERENCES apix_observations(observation_id)
        ON DELETE CASCADE
);


-- ============================================================
-- 11. ROUTE-LEVEL PRICE INDEX
-- ============================================================

CREATE TABLE IF NOT EXISTS route_price_indices (

    index_id TEXT PRIMARY KEY,

    route_id TEXT NOT NULL,

    index_date TEXT NOT NULL,

    lead_time_days INTEGER,

    index_value REAL,

    previous_index_value REAL,

    daily_change_pct REAL,

    observation_count INTEGER,

    flight_count INTEGER,

    carrier_count INTEGER,

    coverage_pct REAL,

    methodology TEXT,

    quality_flag TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (route_id)
        REFERENCES dgca_route_master(route_id)
);


-- ============================================================
-- 12. LEAD-TIME INDEX
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_time_indices (

    lead_time_index_id TEXT PRIMARY KEY,

    route_id TEXT NOT NULL,

    index_date TEXT NOT NULL,

    lead_time_days INTEGER NOT NULL,

    index_value REAL,

    median_fare REAL,

    mean_fare REAL,

    observation_count INTEGER,

    coverage_pct REAL,

    quality_flag TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (route_id)
        REFERENCES dgca_route_master(route_id)
);


-- ============================================================
-- 13. NATIONAL APIx
-- ============================================================

CREATE TABLE IF NOT EXISTS national_apix (

    national_index_id TEXT PRIMARY KEY,

    index_date TEXT NOT NULL,

    index_value REAL NOT NULL,

    previous_index_value REAL,

    daily_change_pct REAL,

    weekly_change_pct REAL,

    monthly_change_pct REAL,

    route_count INTEGER,

    observation_count INTEGER,

    coverage_pct REAL,

    methodology TEXT,

    quality_flag TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 14. INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tasks_run
ON collection_tasks(run_id);

CREATE INDEX IF NOT EXISTS idx_tasks_route
ON collection_tasks(route_id);

CREATE INDEX IF NOT EXISTS idx_tasks_source
ON collection_tasks(source);

CREATE INDEX IF NOT EXISTS idx_tasks_status
ON collection_tasks(status);


CREATE INDEX IF NOT EXISTS idx_raw_task
ON raw_scrape_responses(task_id);

CREATE INDEX IF NOT EXISTS idx_raw_source
ON raw_scrape_responses(source);

CREATE INDEX IF NOT EXISTS idx_raw_timestamp
ON raw_scrape_responses(search_timestamp);


CREATE INDEX IF NOT EXISTS idx_obs_route
ON apix_observations(route_id);

CREATE INDEX IF NOT EXISTS idx_obs_source
ON apix_observations(source);

CREATE INDEX IF NOT EXISTS idx_obs_departure
ON apix_observations(departure_datetime);

CREATE INDEX IF NOT EXISTS idx_obs_search_time
ON apix_observations(search_timestamp);

CREATE INDEX IF NOT EXISTS idx_obs_flight
ON apix_observations(flight_id);

CREATE INDEX IF NOT EXISTS idx_obs_journey
ON apix_observations(journey_id);

CREATE INDEX IF NOT EXISTS idx_obs_route_departure
ON apix_observations(route_id, departure_datetime);


CREATE INDEX IF NOT EXISTS idx_snapshot_route
ON fare_state_snapshots(route_id);

CREATE INDEX IF NOT EXISTS idx_snapshot_flight
ON fare_state_snapshots(flight_id);

CREATE INDEX IF NOT EXISTS idx_snapshot_timestamp
ON fare_state_snapshots(snapshot_timestamp);


CREATE INDEX IF NOT EXISTS idx_transition_route
ON fare_state_transitions(route_id);

CREATE INDEX IF NOT EXISTS idx_transition_timestamp
ON fare_state_transitions(transition_timestamp);


CREATE INDEX IF NOT EXISTS idx_route_index_date
ON route_price_indices(route_id, index_date);

CREATE INDEX IF NOT EXISTS idx_national_index_date
ON national_apix(index_date);


-- ============================================================
-- END OF APIx SCHEMA
-- ============================================================
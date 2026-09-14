from __future__ import annotations

import sqlite3

from index_engine.run_index_demo import (
    DEMO_LEAD_TIMES,
    DEMO_ROUTES,
    create_demo_database,
    generate_synthetic_observations,
    run_demo,
)


def test_synthetic_generation_is_deterministic_and_complete():
    first = generate_synthetic_observations()
    second = generate_synthetic_observations()

    assert first == second
    assert set(first) == {"P0", "P1", "P2"}
    assert all(len(values) == 15 for values in first.values())
    assert {item.route_id for item in first["P0"]} == set(DEMO_ROUTES)
    assert {
        item.target_lead_days for item in first["P0"]
    } == set(DEMO_LEAD_TIMES)


def test_synthetic_history_contains_increases_and_decreases():
    periods = generate_synthetic_observations()
    p0 = {item.route_id: item.previous_price for item in periods["P0"] if item.target_lead_days == 1}
    p1 = {item.route_id: item.previous_price for item in periods["P1"] if item.target_lead_days == 1}

    changes = [p1[route_id] / p0[route_id] for route_id in p0]
    assert any(change > 1 for change in changes)
    assert any(change < 1 for change in changes)


def test_end_to_end_demo_uses_isolated_persistence_and_passes():
    connection = create_demo_database()
    result = run_demo(connection)

    assert result["status"] == "PASS"
    assert result["observation_count"] == 45
    assert result["period_count"] == 3
    assert result["route_count"] == 3
    assert result["lead_time_count"] == 5
    assert len(result["route_estimator_rows"]) == 24
    assert len(result["lead_time_results"]) == 30
    assert len(result["national_results"]) == 2
    assert result["yoy_inflation"] is not None
    assert result["persistence_counts"] == {
        "route_price_indices": 24,
        "lead_time_indices": 30,
        "national_apix": 2,
    }

    assert connection.execute(
        "SELECT COUNT(*) FROM route_price_indices"
    ).fetchone()[0] == 24
    assert connection.execute(
        "SELECT COUNT(*) FROM lead_time_indices"
    ).fetchone()[0] == 30
    assert connection.execute(
        "SELECT COUNT(*) FROM national_apix"
    ).fetchone()[0] == 2


def test_demo_is_deterministic_across_isolated_databases():
    first = run_demo(create_demo_database())
    second = run_demo(create_demo_database())

    assert first == second


def test_demo_does_not_require_or_open_production_database():
    connection = create_demo_database()
    result = run_demo(connection)

    assert isinstance(connection, sqlite3.Connection)
    assert result["demo_mode"] == "DETERMINISTIC_SYNTHETIC_IN_MEMORY"
    assert connection.execute(
        "SELECT COUNT(*) FROM national_apix"
    ).fetchone()[0] == 2

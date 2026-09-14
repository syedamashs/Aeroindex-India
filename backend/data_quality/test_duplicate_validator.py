from duplicate_validator import (
    build_duplicate_key,
    find_duplicates,
    summarize_by_source,
)


def base_observation():
    return {
        "observation_id": "obs_001",
        "source": "indigo",
        "search_timestamp": "2026-09-13T10:00:00+05:30",
        "origin": "DEL",
        "destination": "BOM",
        "departure_datetime": "2026-09-20T10:00:00+05:30",
        "arrival_datetime": "2026-09-20T12:10:00+05:30",
        "carrier_code": "6E",
        "flight_number": "6E1234",
        "flight_id": "6E1234_DEL_BOM",
        "journey_id": "journey_001",
        "source_offer_id": "offer_001",
        "fare_availability_key": "fare_key_001",
        "fare_product_class": "R",
        "fare_class": "R",
        "fare_family": "Regular",
        "base_fare": 4000,
        "taxes": 700,
        "total_fees": 100,
        "total_fare": 4800,
        "is_sold": 0,
    }


def test_identical_observations_have_same_key():
    obs1 = base_observation()
    obs2 = base_observation()

    assert build_duplicate_key(obs1) == build_duplicate_key(obs2)


def test_different_search_times_are_not_duplicates():
    obs1 = base_observation()
    obs2 = base_observation()

    obs2["search_timestamp"] = "2026-09-13T14:00:00+05:30"

    result = find_duplicates([obs1, obs2])

    assert result["duplicate_group_count"] == 0
    assert result["extra_duplicate_rows"] == 0


def test_different_fares_are_not_duplicates():
    obs1 = base_observation()
    obs2 = base_observation()

    obs2["total_fare"] = 5200
    obs2["base_fare"] = 4400

    result = find_duplicates([obs1, obs2])

    assert result["duplicate_group_count"] == 0


def test_different_journeys_are_not_duplicates():
    obs1 = base_observation()
    obs2 = base_observation()

    obs2["journey_id"] = "journey_002"
    obs2["arrival_datetime"] = "2026-09-20T12:30:00+05:30"

    result = find_duplicates([obs1, obs2])

    assert result["duplicate_group_count"] == 0


def test_exact_duplicate_is_detected():
    obs1 = base_observation()
    obs2 = base_observation()

    obs2["observation_id"] = "obs_002"

    result = find_duplicates([obs1, obs2])

    assert result["duplicate_group_count"] == 1
    assert result["duplicate_rows"] == 2
    assert result["extra_duplicate_rows"] == 1


def test_three_identical_rows_create_one_group():
    obs1 = base_observation()
    obs2 = base_observation()
    obs3 = base_observation()

    obs2["observation_id"] = "obs_002"
    obs3["observation_id"] = "obs_003"

    result = find_duplicates([obs1, obs2, obs3])

    assert result["duplicate_group_count"] == 1
    assert result["duplicate_rows"] == 3
    assert result["extra_duplicate_rows"] == 2


def test_duplicate_summary_by_source():
    obs1 = base_observation()
    obs2 = base_observation()

    obs2["observation_id"] = "obs_002"

    spice = base_observation()
    spice["observation_id"] = "obs_003"
    spice["source"] = "spicejet"

    summary = summarize_by_source(
        [obs1, obs2, spice]
    )

    assert summary["indigo"]["observations"] == 2
    assert summary["indigo"]["duplicate_groups"] == 1
    assert summary["indigo"]["extra_duplicate_rows"] == 1

    assert summary["spicejet"]["observations"] == 1
    assert summary["spicejet"]["duplicate_groups"] == 0


if __name__ == "__main__":
    print("DUPLICATE VALIDATOR TESTS PASSED ✓")
from flight_identity_validator import (
    validate_observation,
    summarize_results,
)


def base_observation() -> dict:
    return {
        "observation_id": "test_001",
        "origin": "DEL",
        "destination": "BOM",
        "departure_datetime": "2026-09-20T10:00:00+05:30",
        "carrier_code": "6E",
        "flight_number": "6E1234",
        "flight_id": "6E1234_DEL_BOM",
        "journey_id": "journey_001",
        "source_offer_id": "offer_001",
        "fare_availability_key": "fare_key_001",
        "fare_product_class": "R",
        "fare_class": "R",
        "fare_family": "Regular",
        "stops": 0,
    }


def test_valid_observation():
    result = validate_observation(base_observation())

    assert result.status == "VALID"
    assert result.errors == []
    assert result.warnings == []


def test_missing_origin_is_invalid():
    obs = base_observation()
    obs["origin"] = None

    result = validate_observation(obs)

    assert result.status == "INVALID"
    assert "MISSING_ORIGIN" in result.errors


def test_missing_destination_is_invalid():
    obs = base_observation()
    obs["destination"] = ""

    result = validate_observation(obs)

    assert result.status == "INVALID"
    assert "MISSING_DESTINATION" in result.errors


def test_same_origin_destination_is_invalid():
    obs = base_observation()
    obs["destination"] = "DEL"

    result = validate_observation(obs)

    assert result.status == "INVALID"
    assert "ORIGIN_EQUALS_DESTINATION" in result.errors


def test_missing_departure_is_invalid():
    obs = base_observation()
    obs["departure_datetime"] = None

    result = validate_observation(obs)

    assert result.status == "INVALID"
    assert "MISSING_DEPARTURE_DATETIME" in result.errors


def test_missing_carrier_is_invalid():
    obs = base_observation()
    obs["carrier_code"] = None

    result = validate_observation(obs)

    assert result.status == "INVALID"
    assert "MISSING_CARRIER_CODE" in result.errors


def test_missing_flight_number_is_warning():
    obs = base_observation()
    obs["flight_number"] = None

    result = validate_observation(obs)

    assert result.status == "VALID_WITH_WARNINGS"
    assert "MISSING_FLIGHT_NUMBER" in result.warnings
    assert result.errors == []


def test_missing_journey_id_is_warning():
    obs = base_observation()
    obs["journey_id"] = None

    result = validate_observation(obs)

    assert result.status == "VALID_WITH_WARNINGS"
    assert "MISSING_JOURNEY_ID" in result.warnings


def test_invalid_negative_stops():
    obs = base_observation()
    obs["stops"] = -1

    result = validate_observation(obs)

    assert result.status == "INVALID"
    assert "NEGATIVE_STOPS" in result.errors


def test_invalid_stops_text():
    obs = base_observation()
    obs["stops"] = "abc"

    result = validate_observation(obs)

    assert result.status == "INVALID"
    assert "INVALID_STOPS" in result.errors


def test_missing_fare_identity_generates_warnings():
    obs = base_observation()

    obs["source_offer_id"] = None
    obs["fare_availability_key"] = None
    obs["fare_product_class"] = None
    obs["fare_class"] = None
    obs["fare_family"] = None

    result = validate_observation(obs)

    assert result.status == "VALID_WITH_WARNINGS"

    assert "MISSING_SOURCE_OFFER_ID" in result.warnings
    assert "MISSING_FARE_AVAILABILITY_KEY" in result.warnings
    assert "MISSING_FARE_PRODUCT_CLASS" in result.warnings
    assert "MISSING_FARE_CLASS" in result.warnings
    assert "MISSING_FARE_FAMILY" in result.warnings


def test_summary():
    valid = validate_observation(base_observation())

    warning_obs = base_observation()
    warning_obs["flight_number"] = None
    warning = validate_observation(warning_obs)

    invalid_obs = base_observation()
    invalid_obs["origin"] = None
    invalid = validate_observation(invalid_obs)

    summary = summarize_results([valid, warning, invalid])

    assert summary["total"] == 3
    assert summary["valid"] == 1
    assert summary["valid_with_warnings"] == 1
    assert summary["invalid"] == 1

    assert summary["error_counts"]["MISSING_ORIGIN"] == 1
    assert summary["warning_counts"]["MISSING_FLIGHT_NUMBER"] == 1


if __name__ == "__main__":
    print("FLIGHT / JOURNEY IDENTITY TESTS PASSED ✓")
from soldout_validator import validate_sold_out_status


def base_observation():
    return {
        "observation_id": "obs_001",
        "is_sold": 0,
        "total_fare": 5000,
        "extraction_status": "SUCCESS",
    }


def test_available_fare():

    obs = base_observation()

    result = validate_sold_out_status(obs)

    assert result.status == "AVAILABLE"
    assert result.reason == "AVAILABLE_WITH_FARE"
    assert result.warnings == []


def test_sold_out_fare():

    obs = base_observation()

    obs["is_sold"] = 1
    obs["total_fare"] = None

    result = validate_sold_out_status(obs)

    assert result.status == "SOLD_OUT"
    assert result.reason == "EXPLICIT_SOLD_FLAG"


def test_sold_with_fare_generates_warning():

    obs = base_observation()

    obs["is_sold"] = 1
    obs["total_fare"] = 5000

    result = validate_sold_out_status(obs)

    assert result.status == "SOLD_OUT"

    assert (
        "SOLD_BUT_HAS_TOTAL_FARE"
        in result.warnings
    )


def test_available_without_fare_is_invalid():

    obs = base_observation()

    obs["is_sold"] = 0
    obs["total_fare"] = None

    result = validate_sold_out_status(obs)

    assert result.status == "INVALID"

    assert (
        result.reason
        == "AVAILABLE_BUT_MISSING_TOTAL_FARE"
    )


def test_unknown_sold_status_with_fare():

    obs = base_observation()

    obs["is_sold"] = None
    obs["total_fare"] = 5000

    result = validate_sold_out_status(obs)

    assert result.status == "NOT_CHECKABLE"

    assert (
        result.reason
        == "NO_INTERPRETABLE_SOLD_FLAG"
    )


def test_unknown_sold_status_without_fare():

    obs = base_observation()

    obs["is_sold"] = None
    obs["total_fare"] = None

    result = validate_sold_out_status(obs)

    assert result.status == "NOT_CHECKABLE"

    assert (
        result.reason
        == "NO_SOLD_FLAG_NO_FARE"
    )


def test_string_sold_flag():

    obs = base_observation()

    obs["is_sold"] = "true"
    obs["total_fare"] = None

    result = validate_sold_out_status(obs)

    assert result.status == "SOLD_OUT"


def test_string_available_flag():

    obs = base_observation()

    obs["is_sold"] = "false"
    obs["total_fare"] = 4500

    result = validate_sold_out_status(obs)

    assert result.status == "AVAILABLE"


if __name__ == "__main__":
    print(
        "SOLD-OUT VALIDATOR TESTS PASSED ✓"
    )